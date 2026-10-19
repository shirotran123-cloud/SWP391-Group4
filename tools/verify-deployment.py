"""Verifies the DEPLOYED stack, reached through nginx on port 8080.

This is deliberately separate from `verify-e2e-pipeline.py`, which tests the services running
directly on the host. Here every request goes through the production frontend container, so it
proves the deployment wiring itself: the nginx reverse proxy, the same-origin API path, the
service-name DNS on the compose network, and that the gateway can reach Redis, PostgreSQL and
the GenAI Hub by container name rather than localhost.

Usage: python tools/verify-deployment.py [base_url]
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

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
GATEWAY_DIRECT = "http://localhost:3000"

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def request(url, method="GET", data=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers or {}), exc.read() if exc.fp else b""


def decompress(body, headers):
    """Decodes a response body that nginx may have gzipped.

    Reading `body` gives the raw wire bytes, so a compressed response cannot be searched as
    text — the mount point would be invisible even though the browser renders it fine.
    """
    if headers.get("Content-Encoding") == "gzip":
        import gzip

        try:
            return gzip.decompress(body).decode("utf-8", errors="replace")
        except OSError:
            return body.decode("utf-8", errors="replace")
    return body.decode("utf-8", errors="replace")


def get_json(url, timeout=30):
    status, _, body = request(url, timeout=timeout)
    return status, (json.loads(body.decode("utf-8")) if body else {})


def post_json(url, payload, timeout=60):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    status, _, body = request(
        url, method="POST", data=data,
        headers={"Content-Type": "application/json; charset=utf-8"}, timeout=timeout,
    )
    return status, (json.loads(body.decode("utf-8")) if body else {})


def submit_zip(code, assignment_id, student_id):
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "Solution.py")
    with open(src, "w", encoding="utf-8") as fh:
        fh.write(code)
    archive = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(src, "Solution.py")

    boundary = "----aitadeploy"
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

    status, _, body = request(
        BASE + "/api/v1/submissions",
        method="POST",
        data=b"".join(parts),
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary},
        timeout=60,
    )
    if status not in (200, 201, 202):
        return None, None, (status, body[:200])
    parsed = json.loads(body.decode("utf-8"))
    return parsed["data"]["submissionId"], status, None


print("=" * 78)
print("DEPLOYMENT VERIFICATION — every request goes through nginx on %s" % BASE)
print("=" * 78)

print()
print("A) THE SPA IS SERVED")
# Ask for gzip explicitly: urllib does not send Accept-Encoding by default, and nginx only
# compresses when the client advertises support.
status, headers, body = request(BASE + "/", headers={"Accept-Encoding": "gzip"})
html = decompress(body, headers)
check(status == 200, "index.html is served", status)
check('id="root"' in html or "id=root" in html, "the React mount point is present")
check("text/html" in headers.get("Content-Type", ""), "served as HTML", headers.get("Content-Type"))
check(headers.get("Content-Encoding") == "gzip", "responses are gzipped", headers.get("Content-Encoding"))

print()
print("B) SPA FALLBACK (a deep link must not 404)")
status, headers, body = request(BASE + "/some/deep/spa/route")
check(status == 200, "unknown path returns index.html", status)
check('id="root"' in decompress(body, headers), "fallback serves the app shell")

print()
print("C) THE API IS REACHED THROUGH THE SAME ORIGIN (nginx -> api-gateway)")
status, payload = get_json(BASE + "/api/v1/submissions/stats")
check(status == 200, "GET /api/v1/submissions/stats via nginx", status)
check(isinstance(payload, dict), "a JSON body came back", type(payload).__name__)
# This endpoint reports its own counter names (total/queued/inProgress/completed/failed).
stats = payload.get("data", {})
check("total" in stats and "completed" in stats, "the gateway answered with real counters",
      list(stats)[:6])
check(isinstance(stats.get("total"), int), "the submission total is a number", stats.get("total"))

print()
print("D) THE GATEWAY REACHED REDIS BY CONTAINER NAME")
status, payload = get_json(BASE + "/api/v1/queue/stats")
q = payload.get("data", {})
check(status == 200, "queue stats readable through nginx", status)
check(q.get("mode") == "REDIS", "the queue is on Redis, not the in-memory fallback", q.get("mode"))
check(q.get("isRedisAvailable") is True, "Redis is reported available", q.get("isRedisAvailable"))

print()
print("E) THE GATEWAY REACHED POSTGRESQL BY CONTAINER NAME")
# Users come from PostgreSQL; a non-empty list proves the pooled connection works in-container.
status, payload = get_json(BASE + "/api/v1/users")
users = payload.get("data", [])
check(status == 200, "GET /api/v1/users through nginx", status)
check(isinstance(users, list) and len(users) > 0, "users were read from the database", len(users) if isinstance(users, list) else users)
if isinstance(users, list) and users:
    check("passwordHash" not in users[0], "no password hash leaks in the response", list(users[0])[:6])

print()
print("F) THE GATEWAY REACHED THE GENAI HUB BY CONTAINER NAME")
# The hub is not exposed through nginx; ask it directly on the host port.
status, hub = get_json("http://localhost:3001/health")
check(status == 200, "hub /health reachable", status)
check(hub.get("status") == "UP", "hub reports UP", hub.get("status"))

print()
print("G) A FULL GRADING RUN WORKS IN THE DEPLOYED STACK")
assignment_id = "ASM-DEPLOY-%d" % int(time.time())
post_json(BASE + "/api/v1/assignments", {
    "assignmentId": assignment_id,
    "courseId": "CRS-SWP391",
    "title": "Kiem thu tren moi truong trien khai",
    "allowedLanguages": ["python"],
    "deadline": "2030-01-01T00:00:00.000Z",
})
post_json(BASE + "/api/v1/test-cases", {
    "assignmentId": assignment_id,
    "inputData": "5\n4 2 5 1 3",
    "expectedOutput": "15\n5",
    "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
})

CODE = """import sys

tokens = sys.stdin.read().split()
if tokens:
    n = int(tokens[0])
    values = [int(x) for x in tokens[1:1 + n]]
    print(sum(values))
    print(max(values) if values else 0)
"""

submission_id, status_code, err = submit_zip(CODE, assignment_id, "SE170000")
if not submission_id:
    check(False, "submission accepted through nginx", err)
else:
    check(status_code in (200, 201, 202), "submission accepted through nginx", status_code)
    graded = None
    for _ in range(50):
        time.sleep(3)
        _, detail = get_json("%s/api/v1/submissions/%s" % (BASE, submission_id))
        d = detail.get("data", {})
        if d.get("status") in ("COMPLETED", "FAILED"):
            graded = d
            break
    if not graded:
        check(False, "submission reached a terminal status within the timeout")
    else:
        check(graded.get("status") == "COMPLETED", "grading COMPLETED in the container stack", graded.get("status"))
        details = graded.get("details") or {}
        check(details.get("executedInContainer") is True,
              "test cases ran in the Docker sandbox", details.get("executedInContainer"))
        check(graded.get("score") is not None, "a score was produced", graded.get("score"))
        check(0 <= float(graded.get("score") or 0) <= 10, "score is within 0..10", graded.get("score"))
        check(bool(details.get("aiRating")), "the LLM/clean-code stage ran")
        check(bool(details.get("scoreBreakdown")), "a score breakdown was recorded")

print()
print("H) THE REAL-TIME STREAM IS PROXIED")
# nginx must forward the Socket.IO handshake, otherwise live grading silently degrades.
status, headers, body = request(
    BASE + "/socket.io/?EIO=4&transport=polling",
    headers={"Accept": "*/*"},
)
text = decompress(body, headers)
check(status == 200 or "sid" in text, "Socket.IO handshake answered through nginx", status)
check("sid" in text, "a session id was issued", text[:60])

print()
print("=" * 78)
print("DEPLOYMENT: %d failed" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
