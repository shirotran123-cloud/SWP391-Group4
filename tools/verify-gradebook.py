"""Verifies the gradebook collapses multiple attempts into one authoritative row.

A student may submit the same assignment several times. The gradebook must show exactly one row
per student+assignment, chosen by the policy:

  LAST   the most recent graded attempt (default)
  BEST   the highest-scoring attempt
  FIRST  the earliest attempt

It also checks that every attempt is still listed inside the row, flagged so the lecturer can
see which one counts.

Usage: python tools/verify-gradebook.py
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
STUDENT = "SE170000"

# Three versions, deliberately different so their scores can differ.
CORRECT = """import sys

data = sys.stdin.read().split()
if data:
    n = int(data[0])
    values = sorted(int(x) for x in data[1:1 + n])
    print(" ".join(str(v) for v in values))
"""

# Reverses the order, so the output no longer matches -> a lower score.
WRONG = """import sys

data = sys.stdin.read().split()
if data:
    n = int(data[0])
    values = sorted((int(x) for x in data[1:1 + n]), reverse=True)
    print(" ".join(str(v) for v in values))
"""

# Same as CORRECT but reformatted, so it scores like the correct one.
CORRECT_V2 = """import sys


def main():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    count = int(tokens[0])
    numbers = sorted(int(t) for t in tokens[1:1 + count])
    print(" ".join(str(n) for n in numbers))


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
assignment_id = "ASM-GRADEBOOK-%d" % ts

print("=" * 78)
print("SETUP: three submissions by the same student on one assignment")
print("=" * 78)
post_json("/api/v1/assignments", {
    "assignmentId": assignment_id, "courseId": "CRS-SWP391",
    "title": "Kiem tra bang diem chot", "allowedLanguages": ["python"],
    "deadline": "2030-01-01T00:00:00.000Z",
})
post_json("/api/v1/test-cases", {
    "assignmentId": assignment_id, "inputData": "5\n4 2 5 1 3",
    "expectedOutput": "1 2 3 4 5", "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
})

attempts = []
for label, code in (("attempt 1 (wrong)", WRONG), ("attempt 2 (correct)", CORRECT), ("attempt 3 (correct, reformatted)", CORRECT_V2)):
    sid = submit(code, assignment_id, STUDENT)
    detail = wait_done(sid)
    score = detail.get("score") if detail else None
    attempts.append({"label": label, "id": sid, "score": score, "at": time.time()})
    print("  %-38s %s  score=%s" % (label, sid, score))
    time.sleep(1)

print()
print("=" * 78)
print("A) ONE ROW PER STUDENT AND ASSIGNMENT")
print("=" * 78)
gb = get_json("/api/v1/submissions/gradebook?assignmentId=%s&policy=LAST" % assignment_id)["data"]
rows = gb["entries"]
print("  rows returned      : %d" % len(rows))
check(len(rows) == 1, "exactly one row for the student+assignment pair", len(rows))
if rows:
    row = rows[0]
    print("  attemptsCount      : %s" % row["attemptsCount"])
    print("  counted submission : %s" % row["countedSubmissionId"])
    print("  counted score      : %s" % row["score"])
    check(row["attemptsCount"] == 3, "all three attempts are recorded", row["attemptsCount"])
    check(len(row["attempts"]) == 3, "all three attempts are visible in the row", len(row["attempts"]))
    check(
        sum(1 for a in row["attempts"] if a["counts"]) == 1,
        "exactly one attempt is marked as counting",
    )

print()
print("=" * 78)
print("B) POLICY LAST = the newest graded attempt")
print("=" * 78)
last_row = rows[0] if rows else {}
newest = max(attempts, key=lambda a: a["at"])
print("  newest attempt id  : %s (score %s)" % (newest["id"], newest["score"]))
print("  gradebook counted  : %s (score %s)" % (last_row.get("countedSubmissionId"), last_row.get("score")))
check(
    last_row.get("countedSubmissionId") == newest["id"],
    "LAST selects the newest attempt",
    last_row.get("countedSubmissionId"),
)

print()
print("=" * 78)
print("C) POLICY BEST = the highest-scoring attempt")
print("=" * 78)
gb_best = get_json("/api/v1/submissions/gradebook?assignmentId=%s&policy=BEST" % assignment_id)["data"]
best_row = gb_best["entries"][0] if gb_best["entries"] else {}
scored = [a for a in attempts if a["score"] is not None]
top_score = max(a["score"] for a in scored)
# When two attempts tie on the top score, either is a correct answer — assert the SCORE, not
# the id, and only assert the id when the best score is unique.
top_ids = [a["id"] for a in scored if a["score"] == top_score]
print("  top score among attempts : %s (achieved by %d attempt(s))" % (top_score, len(top_ids)))
print("  gradebook counted        : %s (score %s)" % (best_row.get("countedSubmissionId"), best_row.get("score")))
check(best_row.get("score") == top_score, "BEST row carries the highest score", best_row.get("score"))
if len(top_ids) == 1:
    check(best_row.get("countedSubmissionId") == top_ids[0], "BEST selects the unique top attempt", best_row.get("countedSubmissionId"))
else:
    check(
        best_row.get("countedSubmissionId") in top_ids,
        "BEST selects an attempt with the top score",
        best_row.get("countedSubmissionId"),
    )

print()
print("=" * 78)
print("D) POLICY FIRST = the earliest attempt")
print("=" * 78)
gb_first = get_json("/api/v1/submissions/gradebook?assignmentId=%s&policy=FIRST" % assignment_id)["data"]
first_row = gb_first["entries"][0] if gb_first["entries"] else {}
oldest = min(attempts, key=lambda a: a["at"])
print("  oldest attempt id  : %s (score %s)" % (oldest["id"], oldest["score"]))
print("  gradebook counted  : %s (score %s)" % (first_row.get("countedSubmissionId"), first_row.get("score")))
check(
    first_row.get("countedSubmissionId") == oldest["id"],
    "FIRST selects the earliest attempt",
    first_row.get("countedSubmissionId"),
)

print()
print("=" * 78)
print("E) THE RULE HOLDS ACROSS THE WHOLE DATABASE")
print("=" * 78)
all_gb = get_json("/api/v1/submissions/gradebook")["data"]
total_rows = all_gb["totalRows"]
considered = all_gb["totalSubmissionsConsidered"]
print("  submissions considered : %d" % considered)
print("  gradebook rows         : %d" % total_rows)
print("  superseded attempts    : %d" % all_gb["supersededCount"])
check(total_rows < considered, "rows are fewer than submissions (attempts collapsed)", "%d < %d" % (total_rows, considered))
check(
    total_rows + all_gb["supersededCount"] == considered,
    "rows + superseded equals the total considered",
    "%d + %d vs %d" % (total_rows, all_gb["supersededCount"], considered),
)
keys = ["%s::%s" % (e["studentId"], e["assignmentId"]) for e in all_gb["entries"]]
check(len(keys) == len(set(keys)), "no duplicate student+assignment pair in the gradebook", len(keys))

print()
print("=" * 78)
print("FAILURES: %d" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
