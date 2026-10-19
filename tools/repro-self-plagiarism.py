"""Reproduces the "student flagged for plagiarising themselves" report.

Hypothesis: the same student submits twice (a common, legitimate action — resubmitting after
a fix). Both submissions belong to one student, but the engine compares every submission in
the assignment against every other, so submission #2 is compared with submission #1 of the
same person and reported as plagiarism against their own name.

This script creates one assignment, submits two different versions of the same code under the
SAME student, and inspects the resulting plagiarism match.
"""
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
STUDENT = "SE170000"

CODE_V1 = """import sys


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

# A trivially different version of the same program: renamed helper, reordered statements.
CODE_V2 = """import sys


def parse(text):
    chunks = text.split()
    if not chunks:
        return []
    count = int(chunks[0])
    return [int(v) for v in chunks[1:1 + count]]


def compute(items):
    biggest = None
    summed = 0
    for item in items:
        summed = summed + item
        if biggest is None or item > biggest:
            biggest = item
    return summed, biggest


def main():
    data = parse(sys.stdin.read())
    summed, biggest = compute(data)
    print(summed)
    print(biggest if biggest is not None else 0)


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


def submit(code, assignment_id, student_id, filename="Solution.py"):
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, filename)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(code)
    archive = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(path, filename)

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
assignment_id = "ASM-SELFPLAG-%d" % ts

print("=" * 78)
print("SETUP: one assignment, two submissions from the SAME student")
print("=" * 78)
post_json("/api/v1/assignments", {
    "assignmentId": assignment_id,
    "courseId": "CRS-SWP391",
    "title": "Kiem tra tu dao van ban than",
    "allowedLanguages": ["python"],
    "deadline": "2030-01-01T00:00:00.000Z",
})
post_json("/api/v1/test-cases", {
    "assignmentId": assignment_id,
    "inputData": "5\n4 2 5 1 3",
    "expectedOutput": "15\n5",
    "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
})
print("  assignment: %s" % assignment_id)

first = submit(CODE_V1, assignment_id, STUDENT)
print("  submission 1 (%s): %s" % (STUDENT, first))
wait_done(first)

second = submit(CODE_V2, assignment_id, STUDENT)
print("  submission 2 (%s): %s  (same student, different code)" % (STUDENT, second))
result = wait_done(second)

print()
print("=" * 78)
print("RESULT for the second submission")
print("=" * 78)
if not result:
    print("  submission did not finish in time")
    sys.exit(1)

details = result.get("details") or {}
match = details.get("plagiarismMatch") or {}
similarity = match.get("similarityRate")
matched_name = match.get("matchedStudentName")
matched_id = match.get("matchedStudentId")
flagged = match.get("isFlagged")
score = result.get("score")

print("  score              : %s" % score)
print("  similarity         : %s%%" % similarity)
print("  matched student id : %s" % matched_id)
print("  matched name       : %s" % matched_name)
print("  flagged            : %s" % flagged)

print()
if matched_id == STUDENT or (matched_name and STUDENT in str(matched_id or "")):
    print("  VERDICT: SELF-PLAGIARISM REPORTED — the student matched their own submission.")
    print("           This is the bug to fix.")
else:
    print("  VERDICT: no self-match (matched against a different student, or nothing).")

# Also confirm the first submission was not flagged against itself.
first_detail = get_json("/api/v1/submissions/%s" % first).get("data", {})
first_match = (first_detail.get("details") or {}).get("plagiarismMatch") or {}
print()
print("  submission 1 matched : %s (%s%%)" % (
    first_match.get("matchedStudentId"), first_match.get("similarityRate")))
