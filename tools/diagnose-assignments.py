"""Diagnoses why students see fewer assignments and why HOD grants nothing.

Checks, in order:
  1. how many assignments exist and how many have executable test cases;
  2. which roles the frontend/backend actually branch on (does HOD do anything?);
  3. how many assignments the student-facing endpoint returns.
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(REPO, "api-gateway", "data")

def load(name):
    # Read bytes then decode, so a leftover file handle cannot leak between calls.
    with open(os.path.join(DATA, name), "rb") as fh:
        return json.loads(fh.read().decode("utf-8-sig"))


asm = load("assignments_store.json")
tcs = load("test_cases_store.json")
courses = load("courses_store.json")

per_assignment = {}
for tc in tcs:
    key = tc.get("assignmentId")
    per_assignment[key] = per_assignment.get(key, 0) + 1

with_tc = [a for a in asm if per_assignment.get(a.get("assignmentId"))]
without_tc = [a for a in asm if not per_assignment.get(a.get("assignmentId"))]

print("=" * 70)
print("1. ASSIGNMENTS AND THEIR TEST CASES")
print("=" * 70)
print("  assignments total      : %d" % len(asm))
print("  assignments WITH tc    : %d" % len(with_tc))
print("  assignments WITHOUT tc : %d  <-- these cannot be graded" % len(without_tc))
print()

from collections import Counter

print("  isActive distribution  :", dict(Counter(a.get("isActive") for a in asm)))
print("  courseId distribution  :", Counter(a.get("courseId") for a in asm).most_common(8))
print("  language distribution  :", dict(Counter(a.get("language") for a in asm)))
print()

print("  --- the assignments that ARE usable (have test cases) ---")
for a in with_tc[:25]:
    print("     %-56s tc=%d  active=%s" % (a.get("assignmentId")[:56], per_assignment[a["assignmentId"]], a.get("isActive")))
print()

print("  --- sample of assignments WITHOUT test cases ---")
for a in without_tc[:10]:
    print("     %-56s lang=%s" % (a.get("assignmentId")[:56], a.get("language")))
print()

print("=" * 70)
print("2. COURSES")
print("=" * 70)
print("  courses total:", len(courses))
for c in courses[:20]:
    n = len([a for a in asm if a.get("courseId") == c.get("courseId")])
    usable = len([a for a in with_tc if a.get("courseId") == c.get("courseId")])
    print("     %-16s %-42s assignments=%-3d usable=%d" % (
        c.get("courseCode") or c.get("courseId"), (c.get("courseName") or "")[:42], n, usable))
