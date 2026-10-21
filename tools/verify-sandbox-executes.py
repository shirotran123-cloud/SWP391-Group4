"""Does the sandbox actually EXECUTE submitted code, or merely report that it did?

This exists because a security test can pass for the wrong reason. If the sandbox never runs the
submitted program, then every attack "fails" trivially — a fork bomb that is never executed
cannot exhaust anything — and an 8/8 "DEFENDED" result would be worthless.

The check is direct: submit a program whose correct output is known and non-trivial, and confirm
(a) the test cases actually pass, (b) a program that prints the WRONG answer actually fails, and
(c) the two get different scores. If a deliberately wrong program scores the same as a correct
one, the sandbox is not executing code.

Usage: python tools/verify-sandbox-executes.py
"""
import json
import os
import sys
import tempfile
import time
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def post_json(url, payload, timeout=60):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url, timeout=30):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def submit(code, assignment_id, student_id):
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "Solution.py")
    with open(src, "w", encoding="utf-8") as fh:
        fh.write(code)
    archive = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(src, "Solution.py")

    boundary = "----aitaexec"
    with open(archive, "rb") as fh:
        blob = fh.read()

    parts = []
    for field, value in (
        ("studentId", student_id), ("assignmentId", assignment_id), ("language", "python"),
    ):
        parts.append(
            ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (boundary, field, value)).encode()
        )
    parts.append(
        ('--%s\r\nContent-Disposition: form-data; name="file"; filename="sub.zip"\r\n'
         'Content-Type: application/zip\r\n\r\n' % boundary).encode()
    )
    parts.append(blob)
    parts.append(("\r\n--%s--\r\n" % boundary).encode())

    req = urllib.request.Request(
        BASE + "/api/v1/submissions", data=b"".join(parts),
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))["data"]["submissionId"]


def wait_done(submission_id, limit=50):
    for _ in range(limit):
        time.sleep(3)
        detail = get_json("%s/api/v1/submissions/%s" % (BASE, submission_id)).get("data", {})
        if detail.get("status") in ("COMPLETED", "FAILED"):
            return detail
    return None


# The task: read N then N integers, print the sum then the maximum.
CORRECT = """import sys

data = sys.stdin.read().split()
if data:
    n = int(data[0])
    values = [int(x) for x in data[1:1 + n]]
    print(sum(values))
    print(max(values) if values else 0)
"""

# Prints deliberately wrong output. If the sandbox runs this, the test case MUST fail.
WRONG = """import sys

data = sys.stdin.read().split()
if data:
    n = int(data[0])
    values = [int(x) for x in data[1:1 + n]]
    print(sum(values) + 999)
    print(max(values) if values else 0)
"""

# Emits a marker on stdout that cannot appear unless the interpreter really ran.
MARKER = """print("SANDBOX_EXECUTED_MARKER_7f3a9b2c")
"""


def main():
    print("=" * 78)
    print("DOES THE SANDBOX ACTUALLY EXECUTE CODE?")
    print("=" * 78)
    print("  A security test is only meaningful if the payload really runs. This proves the")
    print("  sandbox executes, so the attack results in the sibling script mean something.\n")

    ts = int(time.time())
    assignment = "ASM-EXEC-%d" % ts
    post_json(BASE + "/api/v1/assignments", {
        "assignmentId": assignment, "courseId": "CRS-SWP391",
        "title": "Xac minh sandbox co chay code that", "allowedLanguages": ["python"],
        "deadline": "2030-01-01T00:00:00.000Z",
    })
    post_json(BASE + "/api/v1/test-cases", {
        "assignmentId": assignment, "inputData": "5\n4 2 5 1 3",
        "expectedOutput": "15\n5", "isHidden": False, "weight": 1.0, "timeLimitMs": 5000,
    })
    post_json(BASE + "/api/v1/test-cases", {
        "assignmentId": assignment, "inputData": "3\n10 20 30",
        "expectedOutput": "60\n30", "isHidden": True, "weight": 1.0, "timeLimitMs": 5000,
    })
    print("  assignment: %s\n" % assignment)

    # A) A correct program must pass.
    sid_ok = submit(CORRECT, assignment, "SE170001")
    detail_ok = wait_done(sid_ok)
    if not detail_ok:
        check(False, "correct submission finished")
        sys.exit(1)

    d_ok = detail_ok.get("details") or {}
    passed_ok = d_ok.get("passedTestcases")
    total_ok = d_ok.get("totalTestcases")
    score_ok = detail_ok.get("score")
    print("A) CORRECT PROGRAM")
    print("   status=%s passed=%s/%s score=%s executedInContainer=%s" % (
        detail_ok.get("status"), passed_ok, total_ok, score_ok, d_ok.get("executedInContainer")))
    check(d_ok.get("executedInContainer") is True, "reported as executed in a container")
    check(passed_ok == total_ok and total_ok, "every test case passed", "%s/%s" % (passed_ok, total_ok))
    check((score_ok or 0) > 0, "a correct program earns marks", score_ok)

    # B) A wrong program must FAIL. This is the discriminating test.
    sid_bad = submit(WRONG, assignment, "SE170002")
    detail_bad = wait_done(sid_bad)
    if not detail_bad:
        check(False, "wrong submission finished")
        sys.exit(1)

    d_bad = detail_bad.get("details") or {}
    passed_bad = d_bad.get("passedTestcases")
    score_bad = detail_bad.get("score")
    print()
    print("B) DELIBERATELY WRONG PROGRAM (adds 999 to the sum)")
    print("   status=%s passed=%s/%s score=%s" % (
        detail_bad.get("status"), passed_bad, d_bad.get("totalTestcases"), score_bad))
    check(passed_bad == 0 or passed_bad is None, "the wrong program fails its test cases", passed_bad)
    check(
        score_bad is None or score_bad < (score_ok or 0),
        "the wrong program scores strictly below the correct one",
        "%s vs %s" % (score_bad, score_ok),
    )

    # C) The interpreter really ran: a marker printed by the program must reach the report.
    sid_marker = submit(MARKER, assignment, "SE170003")
    detail_marker = wait_done(sid_marker)
    d_marker = (detail_marker or {}).get("details") or {}
    stdout = str(d_marker.get("stdout") or "")
    joined = json.dumps(d_marker)
    print()
    print("C) STDOUT MARKER PROGRAM")
    print("   stdout field: %r" % stdout[:120])
    check(
        "SANDBOX_EXECUTED_MARKER_7f3a9b2c" in joined,
        "the marker the program printed appears in the stored result",
    )

    print()
    print("=" * 78)
    print("SANDBOX EXECUTION: %d failed" % failures)
    print("=" * 78)
    sys.exit(1 if failures else 0)


main()
