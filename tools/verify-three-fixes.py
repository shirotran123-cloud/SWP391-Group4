"""End-to-end check of the three fixes:

  1. students read assignments from the API (and only gradable ones are offered);
  2. Gemini generation is bounded by a timeout and reports honest timing;
  3. the HOD role can reach the plagiarism reports BR-04 restricts to staff.
"""
import json
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
failures = 0


def check(ok, label, detail=""):
    global failures
    mark = "PASS" if ok else "FAIL"
    if not ok:
        failures += 1
    print("  [%s] %s%s" % (mark, label, (" -> " + str(detail)) if detail else ""))


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


print("=" * 72)
print("1. STUDENT ASSIGNMENT LIST (now served from the API)")
print("=" * 72)
code, body = call("GET", "/api/v1/assignments")
assignments = body.get("data", []) if isinstance(body, dict) else []
check(code == 200, "GET /api/v1/assignments returns 200", code)
check(len(assignments) > 0, "assignments are available to students", len(assignments))

gradable = [a for a in assignments if (a.get("testcasesCount") or 0) > 0]
ungradable = [a for a in assignments if not (a.get("testcasesCount") or 0)]
print("      total=%d gradable=%d hidden-from-students=%d" % (len(assignments), len(gradable), len(ungradable)))
check(len(gradable) > 0, "at least one assignment is gradable", len(gradable))
if ungradable:
    # The UI hides these; confirm the flag the UI relies on is actually populated.
    check(
        all("testcasesCount" in a for a in ungradable),
        "testcasesCount is present so the UI can hide ungradable tasks",
    )

print()
print("=" * 72)
print("2. EXAM GENERATION TIMING (GenAI Hub path used by the UI)")
print("=" * 72)
import time

payload = {
    "topic": "Sap xep va tim kiem nhi phan",
    "courseCode": "SWP391",
    "difficulty": "MEDIUM",
    "language": "python",
    "learningOutcomes": ["Clean Code"],
    "numTestCases": 3,
}
start = time.time()
code, body = call("POST", "/api/v1/exams/generate", payload)
elapsed = time.time() - start
print("      elapsed=%.2fs status=%s" % (elapsed, code))
check(code == 201, "POST /api/v1/exams/generate returns 201", code)
check(elapsed < 10, "generation completes well within the advertised budget", "%.2fs" % elapsed)
if isinstance(body, dict):
    persisted = body.get("data", {}).get("persisted", {})
    check(bool(persisted.get("assignment")), "assignment persisted", persisted)

print()
print("=" * 72)
print("3. HOD ACCESS TO PLAGIARISM REPORTS (BR-04)")
print("=" * 72)
code_hod, body_hod = call("GET", "/api/v1/plagiarism/reports?role=HOD&flaggedOnly=true")
reports = body_hod.get("data", []) if isinstance(body_hod, dict) else []
check(code_hod == 200, "HOD may read plagiarism reports", code_hod)
print("      flagged pairs visible to HOD: %d" % len(reports))

code_student, body_student = call("GET", "/api/v1/plagiarism/reports?role=STUDENT")
check(code_student == 403, "STUDENT is refused (BR-04)", code_student)
if isinstance(body_student, dict):
    print("      student message: %s" % str(body_student.get("message"))[:80])

code_lect, _ = call("GET", "/api/v1/plagiarism/reports?role=INSTRUCTOR")
check(code_lect == 200, "INSTRUCTOR may read plagiarism reports", code_lect)

print()
print("=" * 72)
print("4. HOD ROLE IS ASSIGNABLE AND LOGS IN")
print("=" * 72)
code, body = call("POST", "/api/v1/auth/login", {"email": "hod@fe.edu.vn", "password": "Aita@2026"})
role = body.get("data", {}).get("user", {}).get("role") if isinstance(body, dict) else None
check(code == 200 and role == "HOD", "hod@fe.edu.vn logs in with role=HOD", "%s / %s" % (code, role))

print()
print("=" * 72)
print("FAILURES: %d" % failures)
print("=" * 72)
sys.exit(1 if failures else 0)
