"""Backfills assignments.testcasesCount from the real test_cases rows.

The counter is what the student UI uses to decide whether an assignment is gradable, but it
was never maintained, so all 99 assignments reported a stale value. This recomputes it once
for existing data; `TestCasesService` now keeps it in step for future writes.

Run with the API Gateway UP so the write goes through the repository (which also updates the
JSON store and PostgreSQL together).
"""
import json
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"


def call(method, path, payload=None):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw


print("=== 1. Read every assignment and its test cases ===")
code, body = call("GET", "/api/v1/assignments")
assignments = body.get("data", []) if isinstance(body, dict) else []
print("    assignments:", len(assignments))

# The list endpoint returns the stored counter; the authoritative count comes from the
# per-assignment test-case route.
fixed = 0
already_correct = 0
skipped = 0

for a in assignments:
    aid = a.get("assignmentId")
    current = a.get("testcasesCount") or 0
    code, tc_body = call("GET", "/api/v1/test-cases/assignment/%s" % aid)
    if code != 200:
        skipped += 1
        continue
    cases = tc_body.get("data", []) if isinstance(tc_body, dict) else []
    actual = len(cases)

    if actual == current:
        already_correct += 1
        continue

    code2, _ = call("PUT", "/api/v1/assignments/%s" % aid, {"testcasesCount": actual})
    if code2 == 200:
        fixed += 1
        if fixed <= 12:
            print("    FIXED %-56s %d -> %d" % (aid[:56], current, actual))
    else:
        print("    FAIL  %-56s HTTP %s" % (aid[:56], code2))

print()
print("    already correct : %d" % already_correct)
print("    repaired        : %d" % fixed)
print("    skipped         : %d" % skipped)

print()
print("=== 2. Verify ===")
code, body = call("GET", "/api/v1/assignments")
assignments = body.get("data", []) if isinstance(body, dict) else []
gradable = [a for a in assignments if (a.get("testcasesCount") or 0) > 0]
print("    total assignments      : %d" % len(assignments))
print("    gradable (have testcases): %d" % len(gradable))
print("    not gradable           : %d" % (len(assignments) - len(gradable)))
if gradable:
    print()
    print("    --- gradable assignments (offered to students) ---")
    for a in gradable[:15]:
        print("       %-58s tc=%d" % (a.get("assignmentId")[:58], a.get("testcasesCount")))
