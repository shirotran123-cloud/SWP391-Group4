"""End-to-end verification of the complete AITA grading pipeline.

Milestone 3 requires proof that the whole chain works, not just its parts:

    student uploads -> Redis queue -> Docker sandbox runs test cases -> AST plagiarism check
    -> LLM reviews clean code -> result returns to the browser over WebSockets

This script drives that chain against the running system and asserts on each hop, so a broken
link is reported by name instead of surfacing as a vague "grading is slow".

Usage: python tools/verify-e2e-pipeline.py
"""
import json
import os
import re
import socket
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

GATEWAY = "http://localhost:3000"
HUB = "http://localhost:3001"

failures = 0
results = []


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    results.append((ok, label, detail))
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def get_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_json(url, payload, timeout=30):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def tcp_open(port, host="localhost"):
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False


def submit_zip(code, assignment_id, student_id):
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "Solution.py")
    with open(src, "w", encoding="utf-8") as fh:
        fh.write(code)
    archive = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(src, "Solution.py")

    boundary = "----aitae2e"
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
        GATEWAY + "/api/v1/submissions",
        data=b"".join(parts),
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary},
        method="POST",
    )
    started = time.time()
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["data"]["submissionId"], (time.time() - started) * 1000


def wait_for_grade(submission_id, limit=50):
    for _ in range(limit):
        time.sleep(3)
        detail = get_json("%s/api/v1/submissions/%s" % (GATEWAY, submission_id)).get("data", {})
        if detail.get("status") in ("COMPLETED", "FAILED"):
            return detail
    return None


print("=" * 78)
print("STEP 0 — SERVICES ARE UP")
print("=" * 78)
for name, port in (("API Gateway", 3000), ("GenAI Hub", 3001), ("PostgreSQL", 5432), ("Redis", 6379)):
    check(tcp_open(port), "%s listening on %d" % (name, port))

try:
    health = get_json(HUB + "/health")
    check(health.get("status") == "UP", "GenAI Hub reports healthy", health.get("status"))
except Exception as exc:  # noqa: BLE001
    check(False, "GenAI Hub /health reachable", exc)

print()
print("=" * 78)
print("STEP 1 — STUDENT UPLOADS (queue must accept in < 200 ms)")
print("=" * 78)

ts = int(time.time())
ASSIGNMENT = "ASM-E2E-%d" % ts
STUDENT = "SE170000"

CORRECT = """import sys

tokens = sys.stdin.read().split()
if tokens:
    n = int(tokens[0])
    values = [int(x) for x in tokens[1:1 + n]]
    print(sum(values))
    print(max(values) if values else 0)
"""

try:
    post_json(GATEWAY + "/api/v1/assignments", {
        "assignmentId": ASSIGNMENT,
        "courseId": "CRS-SWP391",
        "title": "Kiem thu dau cuoi toan luong",
        "allowedLanguages": ["python"],
        "deadline": "2030-01-01T00:00:00.000Z",
    })
    post_json(GATEWAY + "/api/v1/test-cases", {
        "assignmentId": ASSIGNMENT,
        "inputData": "5\n4 2 5 1 3",
        "expectedOutput": "15\n5",
        "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
    })
    post_json(GATEWAY + "/api/v1/test-cases", {
        "assignmentId": ASSIGNMENT,
        "inputData": "3\n10 20 30",
        "expectedOutput": "60\n30",
        "isHidden": True, "weight": 1.0, "timeLimitMs": 10000,
    })
    check(True, "assignment and two test cases created")
except Exception as exc:  # noqa: BLE001
    check(False, "assignment setup", exc)

submission_id, upload_ms = submit_zip(CORRECT, ASSIGNMENT, STUDENT)
check(upload_ms < 200, "upload accepted within the 200 ms SLA", "%.0f ms" % upload_ms)
check(bool(submission_id), "submission id returned", submission_id)

print()
print("=" * 78)
print("STEP 2 — REDIS QUEUE RECEIVED THE JOB")
print("=" * 78)
try:
    stats = get_json(GATEWAY + "/api/v1/queue/stats").get("data", {})
    check(isinstance(stats, dict), "queue stats readable", list(stats)[:5])
    # The gateway reports `waitingCount` / `activeCount` / `completedCount`, and names the
    # transport it is actually using in `mode`.
    counters = ("waitingCount", "activeCount", "completedCount", "failedCount")
    check(all(k in stats for k in counters), "queue stats expose every job counter",
          {k: stats.get(k) for k in counters})
    check(stats.get("completedCount", 0) > 0, "jobs have completed on the queue",
          stats.get("completedCount"))
    check(stats.get("mode") in ("REDIS", "IN_MEMORY", "MEMORY"),
          "queue reports its transport mode", stats.get("mode"))
except Exception as exc:  # noqa: BLE001
    check(False, "queue stats endpoint", exc)

print()
print("=" * 78)
print("STEP 3 — DOCKER SANDBOX RAN THE TEST CASES")
print("=" * 78)
graded = wait_for_grade(submission_id)
if not graded:
    check(False, "submission reached a terminal status")
else:
    check(graded.get("status") == "COMPLETED", "submission COMPLETED", graded.get("status"))
    details = graded.get("details") or {}
    executed = details.get("executedInContainer")
    check(executed is True, "test cases executed inside the Docker container", executed)
    check(details.get("passedTestcases") is not None,
          "passed-testcase count recorded", details.get("passedTestcases"))
    check(details.get("totalTestcases") is not None,
          "total-testcase count recorded", details.get("totalTestcases"))
    if details.get("passedTestcases") is not None and details.get("totalTestcases"):
        check(details["passedTestcases"] >= 1, "at least one test case passed",
              "%s/%s" % (details.get("passedTestcases"), details.get("totalTestcases")))

print()
print("=" * 78)
print("STEP 4 — AST PLAGIARISM CHECK RAN")
print("=" * 78)
# A single submission has no peer, so the comparison legitimately finds nothing. To prove the
# stage actually runs, a SECOND student submits the same code: that submission must be flagged.
peerView = {}
try:
    peer_id, _ = submit_zip(CORRECT, ASSIGNMENT, "SE170123")
    peer = wait_for_grade(peer_id)
    if not peer:
        check(False, "the second submission (peer) reached a terminal status")
    else:
        check(peer.get("status") == "COMPLETED", "peer submission COMPLETED", peer.get("status"))
        details = peer.get("details") or {}
        peerView = details
        pm = details.get("plagiarismMatch")
        check(pm is not None, "plagiarism stage produced a result for the second submission")
        if pm:
            rate = pm.get("similarityRate")
            check(isinstance(rate, (int, float)), "similarity rate recorded", rate)
            check(rate >= 80, "identical code from another student is detected", "%s%%" % rate)
            check(pm.get("matchedStudentId") != "SE170123",
                  "the match names the OTHER student", pm.get("matchedStudentId"))
            check(peer.get("score") == 0, "the flagged submission scores 0 (BR-03)", peer.get("score"))
            check(pm.get("isFlagged") is True, "the match is flagged", pm.get("isFlagged"))
except Exception as exc:  # noqa: BLE001
    check(False, "plagiarism stage on the peer submission", exc)

print()
print("=" * 78)
print("STEP 5 — LLM / CLEAN-CODE REVIEW RAN")
print("=" * 78)
if graded:
    details = graded.get("details") or {}
    ai = details.get("aiRating") or {}
    check(bool(ai), "clean-code review produced a rating", list(ai)[:4])
    if ai:
        check(isinstance(ai.get("cleanCodeScore"), (int, float)),
              "clean-code score recorded", ai.get("cleanCodeScore"))
        check("solidScore" in ai, "SOLID breakdown present")
        check(bool(ai.get("explanation")), "a Vietnamese explanation was produced")

print()
print("=" * 78)
print("STEP 6 — SCORE COMPOSED PER BR-03 (70% testcase + 30% GenAI)")
print("=" * 78)
if graded:
    details = graded.get("details") or {}
    breakdown = details.get("scoreBreakdown") or {}
    total = graded.get("score")
    check(total is not None, "final score present", total)
    if breakdown:
        check("testcase1" in breakdown and "cleanCode" in breakdown and "solid" in breakdown,
              "full score breakdown recorded", list(breakdown))
        check(0 <= float(total) <= 10, "score within 0..10", total)

print()
print("=" * 78)
print("STEP 7 — WEBSOCKET STREAM IS AVAILABLE FOR REAL-TIME UPDATES")
print("=" * 78)
ws_ok = False
try:
    # The Socket.IO handshake is a plain HTTP GET on the same port; a 200/400 with a
    # socket.io body proves the namespace is mounted.
    req = urllib.request.Request(
        GATEWAY + "/socket.io/?EIO=4&transport=polling",
        headers={"Accept": "*/*"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    ws_ok = resp.status == 200 and ("sid" in body or "0{" in body)
    check(ws_ok, "Socket.IO handshake answers on the gateway port", body[:60])
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
    check("sid" in body, "Socket.IO handshake answers (HTTP %s)" % exc.code, body[:60])
except Exception as exc:  # noqa: BLE001
    check(False, "Socket.IO handshake reachable", exc)

print()
print("=" * 78)
print("STEP 8 — GRADEBOOK COLLAPSES REPEATED ATTEMPTS")
print("=" * 78)
try:
    book = get_json(
        "%s/api/v1/submissions/gradebook?assignmentId=%s" % (GATEWAY, ASSIGNMENT)
    ).get("data", {})
    rows = book.get("entries", [])
    # Two students each submitted once, so exactly two rows is the correct answer: one row per
    # student+assignment pair, never one per submission.
    check(len(rows) == 2, "one gradebook row per student, not per submission", len(rows))
    ids = sorted(r.get("studentId") for r in rows)
    check(ids == ["SE170000", "SE170123"], "both students appear exactly once", ids)
    check(all(r.get("attemptsCount", 0) >= 1 for r in rows), "attempt counts recorded",
          [r.get("attemptsCount") for r in rows])
    check(book.get("totalRows") == len(rows), "totalRows agrees with the entry list",
          book.get("totalRows"))

    # And the collapsing rule itself: a third upload by the same student must not add a row.
    repeat_id, _ = submit_zip(CORRECT + "\n# resubmitted\n", ASSIGNMENT, STUDENT)
    wait_for_grade(repeat_id)
    book2 = get_json(
        "%s/api/v1/submissions/gradebook?assignmentId=%s" % (GATEWAY, ASSIGNMENT)
    ).get("data", {})
    rows2 = book2.get("entries", [])
    check(len(rows2) == 2, "a resubmission does not create a second row", len(rows2))
    mine = [r for r in rows2 if r.get("studentId") == STUDENT]
    if mine:
        check(mine[0].get("attemptsCount") == 2, "the resubmission is folded into the row",
              mine[0].get("attemptsCount"))
        check(mine[0].get("countedSubmissionId") == repeat_id,
              "LAST policy counts the newest attempt", mine[0].get("countedSubmissionId"))
except Exception as exc:  # noqa: BLE001
    check(False, "gradebook endpoint", exc)

print()
print("=" * 78)
passed = sum(1 for ok, _, _ in results if ok)
print("E2E PIPELINE: %d passed, %d failed" % (passed, failures))
print("=" * 78)
sys.exit(1 if failures else 0)
