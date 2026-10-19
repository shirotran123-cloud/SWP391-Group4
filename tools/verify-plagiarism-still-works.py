"""Confirms that real cross-student plagiarism is STILL detected after the self-match fix.

The fix excludes a student's own resubmissions from comparison. This test makes sure that
exclusion did not weaken the engine: two DIFFERENT students submitting the same code must
still be flagged, and still lose the marks.

Usage: python tools/verify-plagiarism-still-works.py
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

# One shared implementation, submitted verbatim by two different students.
SHARED = """import sys


def read_numbers(text):
    parts = text.split()
    if not parts:
        return []
    n = int(parts[0])
    return [int(x) for x in parts[1:1 + n]]


def solve(values):
    total = 0
    largest = None
    for value in values:
        total += value
        if largest is None or value > largest:
            largest = value
    return total, largest


def main():
    numbers = read_numbers(sys.stdin.read())
    total, largest = solve(numbers)
    print(total)
    print(largest if largest is not None else 0)


main()
"""

# A genuinely independent solution by a third student (must NOT be flagged).
INDEPENDENT = """import sys


def main():
    data = sys.stdin.read().split()
    if not data:
        print(0)
        print(0)
        return
    count = int(data[0])
    values = [int(v) for v in data[1:1 + count]]
    if not values:
        print(0)
        print(0)
        return
    running = 0
    for v in values:
        running += v
    print(running)
    print(max(values))


main()
"""


def post_json(path, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json; charset=utf-8"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path):
    with urllib.request.urlopen(BASE + path, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def submit(code, assignment_id, student_id):
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, "Solution.py")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(code)
    archive = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(path, "Solution.py")

    boundary = "----aitaboundary"
    with open(archive, "rb") as fh:
        blob = fh.read()

    parts = []
    for field, value in (
        ("studentId", student_id),
        ("assignmentId", assignment_id),
        ("language", "python"),
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
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))["data"]["submissionId"]


def wait_done(submission_id, limit=40):
    for _ in range(limit):
        time.sleep(3)
        detail = get_json("/api/v1/submissions/%s" % submission_id).get("data", {})
        if detail.get("status") in ("COMPLETED", "FAILED"):
            return detail
    return None


ts = int(time.time())
assignment_id = "ASM-CROSSPLAG-%d" % ts

post_json("/api/v1/assignments", {
    "assignmentId": assignment_id,
    "courseId": "CRS-SWP391",
    "title": "Kiem tra dao van cheo sinh vien",
    "allowedLanguages": ["python"],
    "deadline": "2030-01-01T00:00:00.000Z",
})
post_json("/api/v1/test-cases", {
    "assignmentId": assignment_id,
    "inputData": "5\n4 2 5 1 3",
    "expectedOutput": "15\n5",
    "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
})

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


print("=" * 78)
print("A) SAME CODE, TWO DIFFERENT STUDENTS (must be flagged)")
print("=" * 78)
first = submit(SHARED, assignment_id, "SE170000")
wait_done(first)
second = submit(SHARED, assignment_id, "SE170123")
result = wait_done(second)

if not result:
    print("  submission did not finish")
    sys.exit(1)

match = (result.get("details") or {}).get("plagiarismMatch") or {}
rate = match.get("similarityRate") or 0
matched_id = match.get("matchedStudentId")
score = result.get("score")

print("  score            : %s" % score)
print("  similarity       : %s%%" % rate)
print("  matched student  : %s" % matched_id)
check(rate >= 80, "identical code from another student is flagged", "%s%%" % rate)
check(matched_id != "SE170123", "flag points at the OTHER student, not the same one", matched_id)
check(score == 0, "the plagiarising submission scores 0", score)

print()
print("=" * 78)
print("B) INDEPENDENT CODE FROM A THIRD STUDENT (must NOT be flagged)")
print("=" * 78)
third = submit(INDEPENDENT, assignment_id, "SE170456")
result3 = wait_done(third)

if not result3:
    print("  submission did not finish")
    sys.exit(1)

match3 = (result3.get("details") or {}).get("plagiarismMatch") or {}
rate3 = match3.get("similarityRate") or 0
score3 = result3.get("score")
print("  score            : %s" % score3)
print("  similarity       : %s%%" % rate3)
print("  matched student  : %s" % match3.get("matchedStudentId"))
check(rate3 < 80, "an independent solution is not flagged as plagiarism", "%s%%" % rate3)
check(score3 and score3 > 0, "an independent solution still earns marks", score3)

print()
print("=" * 78)
print("FAILURES: %d" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
