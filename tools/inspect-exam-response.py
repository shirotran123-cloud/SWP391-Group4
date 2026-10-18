"""Inspects exactly what the gateway returns for a generated exam, field by field.

The summary tool reported "test cases: 0" from the exam object while `persisted` said 4 were
saved, so the cases are clearly present under a different key. This prints the real shape.
"""
import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

GATEWAY = "http://localhost:3000"

BODY = {
    "topic": "Sap xep day so bang thuat toan hop nhat",
    "courseCode": "SWP391",
    "difficulty": "MEDIUM",
    "language": "python",
    "learningOutcomes": ["Clean Code"],
    "numTestCases": 3,
}

data = json.dumps(BODY, ensure_ascii=False).encode("utf-8")
req = urllib.request.Request(
    "%s/api/v1/exams/generate" % GATEWAY,
    data=data,
    headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=120) as resp:
    payload = json.loads(resp.read().decode("utf-8"))

print("top-level keys:", sorted(payload.keys()))
print()

data_node = payload.get("data", {})
print("data keys:", sorted(data_node.keys()))
print()

exam = data_node.get("exam", {})
print("exam keys:", sorted(exam.keys()))
print()

for key in ("testCases", "testcases", "test_cases"):
    if key in exam:
        cases = exam[key]
        print("exam.%s -> %d item(s)" % (key, len(cases) if isinstance(cases, list) else -1))
        for tc in (cases or [])[:4]:
            if isinstance(tc, dict):
                print("   input=%r" % str(tc.get("input"))[:44])
                print("   output=%r  weight=%s  hidden=%s" % (
                    str(tc.get("output"))[:40], tc.get("weight"), tc.get("isHidden")))
        break
else:
    print("no test-case key inside exam; dumping exam:")
    print(json.dumps(exam, ensure_ascii=False, indent=2)[:900])

print()
print("persisted:", json.dumps(data_node.get("persisted", {}), ensure_ascii=False))
print("assignmentId:", data_node.get("assignment", {}).get("assignmentId"))
print()

# Confirm the cases really landed in the database via the public route.
aid = data_node.get("assignment", {}).get("assignmentId")
if aid:
    with urllib.request.urlopen(
        "%s/api/v1/test-cases/assignment/%s" % (GATEWAY, aid), timeout=30
    ) as resp:
        stored = json.loads(resp.read().decode("utf-8"))
    rows = stored.get("data", [])
    print("stored test cases for %s: %d" % (aid, len(rows)))
    for row in rows[:4]:
        print("   %r -> %r" % (str(row.get("inputData"))[:40], str(row.get("expectedOutput"))[:30]))
