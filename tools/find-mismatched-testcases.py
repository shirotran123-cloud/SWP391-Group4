"""Finds assignments whose stored test cases do not match their own title.

The offline engine returns the SAME sum-and-max test cases for every topic (measured in
tools/test-offline-engine-quality.py). Those cases were persisted alongside topic-specific
assignment titles, so a student submitting a sorting or graph solution would be graded
against a sum/max checker and score 0 for a correct answer.

This lists every assignment where the title suggests one problem but the test cases are the
sum-and-max pair.
"""
import json
import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

GATEWAY = "http://localhost:3000"

# The offline engine's fixed I/O pair, as produced for every topic.
SUM_MAX_SIGNATURES = [
    ("5\n4 2 5 1 3", "15\n5"),
    ("3\n-1 -2 -3", "-6\n-1"),
    ("1\n42", "42\n42"),
    ("0\n", "0\n0"),
    ("6\n1000000 -1000000 5 5 0 7", "7\n1000000"),
    ("4\n7 7 7 7", "28\n7"),
    ("2\n5 -5", "0\n5"),
]

# Words that indicate the assignment is NOT a sum/max exercise.
OTHER_TOPIC_HINTS = (
    "sap xep", "sắp xếp", "sort", "duong di", "đường đi", "dijkstra", "graph", "do thi",
    "đồ thị", "nguyen to", "nguyên tố", "prime", "sinh vien", "sinh viên", "student",
    "ky tu", "ký tự", "string", "chuoi", "chuỗi", "cay", "cây", "tree", "avl",
    "binary", "nhi phan", "nhị phân", "matrix", "ma tran", "ma trận", "queue", "stack",
)


def get(path):
    with urllib.request.urlopen(GATEWAY + path, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


print("=== 1. Collect assignments that have test cases ===")
assignments = get("/api/v1/assignments").get("data", [])
gradable = [a for a in assignments if (a.get("testcasesCount") or 0) > 0]
print("    assignments with test cases: %d" % len(gradable))

mismatched = []
matched = 0
unknown = 0

for a in gradable:
    aid = a.get("assignmentId")
    title = str(a.get("title") or "")
    try:
        codes = get("/api/v1/test-cases/assignment/%s" % aid)
    except Exception:
        continue
    cases = codes.get("data", [])
    if not cases:
        continue

    stored = [(str(c.get("inputData") or ""), str(c.get("expectedOutput") or "")) for c in cases]
    fixed_pair = sum(
        1 for inp, out in stored
        if any(inp.strip() == si.strip() and out.strip() == so.strip() for si, so in SUM_MAX_SIGNATURES)
    )

    is_other_topic = any(h in title.lower() for h in OTHER_TOPIC_HINTS)

    if fixed_pair >= max(1, len(stored) - 1) and is_other_topic:
        mismatched.append((aid, title, len(stored), fixed_pair))
    elif fixed_pair >= max(1, len(stored) - 1):
        matched += 1
    else:
        # Test cases are genuinely custom to this assignment.
        unknown += 1

print()
print("=== 2. Assignments whose test cases contradict their title ===")
if not mismatched:
    print("    none")
else:
    for aid, title, total, fixed in mismatched:
        print("    %s" % aid[:64])
        print("        title: %s" % title[:88])
        print("        %d/%d test cases are the offline engine's sum-and-max pair" % (fixed, total))

print()
print("    title says sum/max, cases are sum/max : %d" % matched)
print("    cases are genuinely custom          : %d" % unknown)
print("    MISMATCHED (grading would be wrong)  : %d" % len(mismatched))
