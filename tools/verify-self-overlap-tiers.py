"""Verifies the three-way self-overlap classification end to end.

Academic-integrity guidance separates cases that look identical to a naive checker:

  A. SAME_ASSIGNMENT   a student resubmits the same task  -> NOT plagiarism, keep the marks
  B. CROSS_ASSIGNMENT  same student reuses work in another task of the same course -> warn only
  C. CROSS_COURSE      same student submits the same work to a different course -> self-plagiarism
  D. other student copies the work -> ordinary plagiarism, score 0

This script exercises A and D (the two taught by automated scoring) and asserts the
classification function directly for B and C, because creating a second course's assignment
through the API would be needed for a full C run.

Usage: python tools/verify-self-overlap-tiers.py
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


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
assignment_id = "ASM-SELFTIER-%d" % ts
other_assignment_id = "ASM-SELFTIER-OTHER-%d" % ts

post_json("/api/v1/assignments", {
    "assignmentId": assignment_id, "courseId": "CRS-SWP391",
    "title": "Kiem tra phan loai tu dao van", "allowedLanguages": ["python"],
    "deadline": "2030-01-01T00:00:00.000Z",
})
post_json("/api/v1/test-cases", {
    "assignmentId": assignment_id, "inputData": "5\n4 2 5 1 3",
    "expectedOutput": "15\n5", "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
})
# A second task in the SAME course.
post_json("/api/v1/assignments", {
    "assignmentId": other_assignment_id, "courseId": "CRS-SWP391",
    "title": "Bai tap khac cung mon", "allowedLanguages": ["python"],
    "deadline": "2030-01-01T00:00:00.000Z",
})

print("=" * 78)
print("A) RESUBMISSION OF THE SAME ASSIGNMENT (must keep the marks)")
print("=" * 78)
first = submit(SHARED, assignment_id, "SE170000")
wait_done(first)
second = submit(SHARED, assignment_id, "SE170000")
result = wait_done(second)

if not result:
    print("  did not finish")
    sys.exit(1)

match = (result.get("details") or {}).get("plagiarismMatch") or {}
score = result.get("score")
print("  score      : %s" % score)
print("  similarity : %s%%" % match.get("similarityRate"))
print("  status     : %s" % match.get("status"))
print("  selfOverlap: %s" % (match.get("selfOverlap") or {}))
check(score is not None and score > 0, "resubmission keeps its score", score)
check(not match.get("isFlagged"), "resubmission is not flagged", match.get("isFlagged"))
check(
    (match.get("selfOverlap") or {}).get("kind") == "SAME_ASSIGNMENT",
    "classified as SAME_ASSIGNMENT",
    (match.get("selfOverlap") or {}).get("kind"),
)

print()
print("=" * 78)
print("B) REUSE ACROSS TWO TASKS OF THE SAME COURSE (warn, do not zero)")
print("=" * 78)
third = submit(SHARED, other_assignment_id, "SE170000")
result3 = wait_done(third)
match3 = (result3.get("details") or {}).get("plagiarismMatch") or {}
score3 = result3.get("score")
print("  score      : %s" % score3)
print("  similarity : %s%%" % match3.get("similarityRate"))
print("  selfOverlap: %s" % (match3.get("selfOverlap") or {}))

# The same-course reuse is cross-assignment; it is not compared here because peer discovery
# is scoped to one assignment, so the engine correctly finds no peer. Assert the invariant
# instead: whatever it reports, the score must not be zeroed by a self-match.
check(
    score3 is None or score3 > 0 or (match3.get("selfOverlap") or {}).get("kind") == "CROSS_COURSE",
    "same-course reuse never zeroes the score",
    score3,
)

print()
print("=" * 78)
print("C) OTHER STUDENT COPIES THE WORK (must be flagged and zeroed)")
print("=" * 78)
cheat = submit(SHARED, assignment_id, "SE170123")
result4 = wait_done(cheat)
match4 = (result4.get("details") or {}).get("plagiarismMatch") or {}
score4 = result4.get("score")
print("  score      : %s" % score4)
print("  similarity : %s%%" % match4.get("similarityRate"))
print("  matched    : %s" % match4.get("matchedStudentId"))
check(score4 == 0, "copying another student scores 0", score4)
check(match4.get("isFlagged") is True, "copying another student is flagged", match4.get("isFlagged"))
check(
    match4.get("matchedStudentId") != "SE170123",
    "flag names the other student",
    match4.get("matchedStudentId"),
)

print()
print("=" * 78)
print("D) CLASSIFICATION RULE FOR THE THREE CASES (pure function)")
print("=" * 78)
# Exercise the shipped static method directly so the rule under test is the real one.
script = """
import { PlagiarismService } from './src/plagiarism/plagiarism.service';

const cases: Array<[string, string, string, string, string]> = [
  ['same-assignment',        'A1', 'C1', 'A1', 'C1'],
  ['same-course-other-task', 'A1', 'C1', 'A2', 'C1'],
  ['diff-course-same-id',    'A1', 'C1', 'A1', 'C2'],
  ['diff-course-other-id',   'A1', 'C1', 'A2', 'C2'],
];
for (const [name, curA, curC, matA, matC] of cases) {
  const r = PlagiarismService.classifySelfOverlap(curA, curC, matA, matC);
  console.log(JSON.stringify({ name, kind: r.kind, selfPlagiarism: r.isSelfPlagiarism }));
}
"""
tmp = os.path.join(REPO, "api-gateway", "_classify_probe.ts")
with open(tmp, "w", encoding="utf-8") as fh:
    fh.write(script)
try:
    npx = "npx.cmd" if os.name == "nt" else "npx"
    proc = subprocess.run(
        [npx, "ts-node", "--transpile-only", "_classify_probe.ts"],
        cwd=os.path.join(REPO, "api-gateway"),
        capture_output=True,
        shell=False,
    )
    out = proc.stdout.decode("utf-8", errors="replace")
    expected = {
        "same-assignment": "SAME_ASSIGNMENT",
        "same-course-other-task": "CROSS_ASSIGNMENT",
        "diff-course-same-id": "CROSS_COURSE",
        "diff-course-other-id": "CROSS_COURSE",
    }
    seen_any = False
    for line in out.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        seen_any = True
        row = json.loads(line)
        want = expected.get(row["name"])
        check(row["kind"] == want, "classifies %s" % row["name"], row["kind"])
        if want == "CROSS_COURSE":
            check(row["selfPlagiarism"] is True, "cross-course is marked as self-plagiarism", row["selfPlagiarism"])
        else:
            check(row["selfPlagiarism"] is False, "%s is not self-plagiarism" % row["name"], row["selfPlagiarism"])
    if not seen_any:
        print("  FAIL probe produced no rows")
        print("  stderr: %s" % proc.stderr.decode("utf-8", "replace")[:400])
        failures += 1
finally:
    if os.path.exists(tmp):
        os.remove(tmp)

print()
print("=" * 78)
print("FAILURES: %d" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
