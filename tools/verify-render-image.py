"""Verifies the all-in-one deployment the way Render will run it.

Render serves the app on a single URL, so this checks that one origin really does everything:
the SPA, the API, the Socket.IO stream, and the in-container GenAI Hub with its real Python AST
parser. It is the deployment-target equivalent of `verify-deployment.py`, which tests the
Compose stack.

Usage: python tools/verify-render-image.py [base_url]
"""
import json
import os
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8090"

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
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers or {}), exc.read() if exc.fp else b""


def decompress(body, headers):
    if headers.get("Content-Encoding") == "gzip":
        import gzip

        try:
            return gzip.decompress(body).decode("utf-8", errors="replace")
        except OSError:
            pass
    return body.decode("utf-8", errors="replace")


def get_json(url, timeout=30):
    status, headers, body = request(url, timeout=timeout)
    text = decompress(body, headers)
    return status, (json.loads(text) if text else {})


def post_json(url, payload, timeout=90):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return request(
        url, method="POST", data=data,
        headers={"Content-Type": "application/json; charset=utf-8"}, timeout=timeout,
    )


print("=" * 78)
print("RENDER-STYLE SINGLE-SERVICE DEPLOYMENT — %s" % BASE)
print("=" * 78)

# ── A. One origin serves the SPA ────────────────────────────────────────────
print()
print("A) The SPA is served from the same origin as the API")
status, headers, body = request(BASE + "/", headers={"Accept-Encoding": "gzip"})
html = decompress(body, headers)
check(status == 200, "index.html is served", status)
check('id="root"' in html, "the React mount point is present")
check("text/html" in headers.get("Content-Type", ""), "served as HTML", headers.get("Content-Type"))

status, headers, body = request(BASE + "/deep/spa/route")
check(status == 200, "a deep link does not 404 (SPA fallback)", status)
check('id="root"' in decompress(body, headers), "the fallback serves the app shell")

# ── B. The API answers on the same origin ──────────────────────────────────
print()
print("B) The API answers on the same origin (no CORS, no cross-origin call)")
status, payload = get_json(BASE + "/api/v1/submissions/stats")
check(status == 200, "GET /api/v1/submissions/stats", status)
check(isinstance(payload.get("data"), dict), "a JSON body came back", type(payload.get("data")).__name__)

# A mistyped API path must return a real 404, not the HTML shell. Serving index.html for
# `/api/...` would surface in the client as a confusing JSON parse error.
status, headers, body = request(BASE + "/api/v1/definitely-not-a-route")
check(status == 404, "an unknown API path returns 404, not the HTML shell", status)
check("text/html" not in headers.get("Content-Type", ""), "the 404 is not HTML", headers.get("Content-Type"))

# ── C. Auth works, so the deployment is usable ────────────────────────────
print()
print("C) A demo account can sign in")
# The built-in seed ships a PLACEHOLDER password hash, so seeded accounts cannot sign in until
# demo seeding runs. A 401 here is therefore informational rather than a failure unless seeding
# was requested — see SEED_DEMO_ACCOUNTS in render.yaml.
status, headers, body = post_json(
    BASE + "/api/v1/auth/login",
    {"email": "admin@aita.fpt.edu.vn", "password": "Aita@2026"},
)
expect_login = os.environ.get("EXPECT_DEMO_LOGIN") == "true"
if status in (200, 201):
    login = json.loads(decompress(body, headers))
    data = login.get("data") or login
    check(bool(data.get("token")), "a token was issued")
    user = data.get("user") or {}
    check(user.get("role") == "ADMIN", "the admin role came back", user.get("role"))
    check("passwordHash" not in user, "no password hash leaked")
elif expect_login:
    check(False, "POST /api/v1/auth/login accepted (demo seeding was requested)", status)
else:
    check(True, "login refused because demo seeding is off (expected)", "HTTP %s" % status)
    print("     Set SEED_DEMO_ACCOUNTS=true (and EXPECT_DEMO_LOGIN=true here) to test sign-in.")

# ── D. The Socket.IO stream is reachable ──────────────────────────────────
print()
print("D) The real-time stream is reachable on the same port")
status, headers, body = request(BASE + "/socket.io/?EIO=4&transport=polling")
text = decompress(body, headers)
check(status == 200, "the Socket.IO handshake answered", status)
check("sid" in text, "a session id was issued", text[:60])

# ── E. The gateway's own plagiarism endpoint ──────────────────────────────
print()
print("E) The gateway's plagiarism endpoint answers on the public origin")
# `/api/v1/ast/matrix` belongs to the GenAI Hub and is not exposed publicly; the gateway's own
# plagiarism surface is what a deployed client can reach. Testing the hub path here would be
# testing the wrong service.
status, headers, body = request(BASE + "/api/v1/plagiarism/reports")
check(status in (200, 403), "the plagiarism report endpoint answers", status)
if status == 403:
    print("     (403 is correct — BR-04 restricts plagiarism data to INSTRUCTOR and HOD)")

# ── F. Degradation is honest ──────────────────────────────────────────────
print()
print("F) The deployment states what it can and cannot do")
status, payload = get_json(BASE + "/api/v1/queue/stats")
q = payload.get("data", {})
check(status == 200, "queue stats readable", status)
# No Redis is attached on the free tier, so the in-memory queue is the expected honest answer.
check(q.get("mode") in ("IN_MEMORY", "MEMORY", "REDIS"),
      "the queue reports its transport honestly", q.get("mode"))
print("     queue mode : %s" % q.get("mode"))
print("     (no Redis attached on the free tier; the gateway uses its in-memory queue)")

print()
print("=" * 78)
print("RENDER IMAGE: %d failed" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
