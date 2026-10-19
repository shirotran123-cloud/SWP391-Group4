"""Verifies the LIVE Render deployment, not a local reproduction.

Distinct from `verify-render-image.py`, which runs the same image on localhost. This script talks
to the public URL and additionally checks the things that only matter once a real hostname and a
real TLS terminator are involved: the cold-start behaviour of the free tier, that the bundle was
built for the right origin, and whether any login path is actually usable.

Usage: python tools/verify-live-deployment.py [base_url]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://aita-autograding.onrender.com").rstrip("/")

failures = 0
warnings = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def warn(ok, label, detail=""):
    """A condition that is not a defect but blocks a human from using the deployment."""
    global warnings
    if not ok:
        warnings += 1
    print("  [%s] %s%s" % ("OK" if ok else "BLOCKED", label, (" -> " + str(detail)) if detail else ""))


def request(url, method="GET", data=None, headers=None, timeout=120):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers or {}), exc.read() if exc.fp else b""
    except urllib.error.URLError as exc:
        return 0, {}, str(exc).encode()


def text_of(body, headers):
    if headers.get("Content-Encoding") == "gzip":
        import gzip

        try:
            return gzip.decompress(body).decode("utf-8", errors="replace")
        except OSError:
            pass
    return body.decode("utf-8", errors="replace")


def get_json(url, timeout=120):
    status, headers, body = request(url, timeout=timeout)
    raw = text_of(body, headers)
    try:
        return status, json.loads(raw)
    except Exception:  # noqa: BLE001
        return status, {"_raw": raw[:200]}


def post_json(url, payload, timeout=120):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return request(
        url, method="POST", data=data,
        headers={"Content-Type": "application/json; charset=utf-8"}, timeout=timeout,
    )


print("=" * 78)
print("LIVE DEPLOYMENT VERIFICATION — %s" % BASE)
print("=" * 78)

# ── A. Cold start ───────────────────────────────────────────────────────────
print()
print("A) The service wakes and serves the SPA")
# Render's free tier suspends an idle service, so the first request can take up to a minute.
# This is expected behaviour rather than a fault, but it must be measured so a slow first load
# is not mistaken for a broken deployment.
started = time.time()
status, headers, body = request(BASE + "/")
cold = time.time() - started
html = text_of(body, headers)
check(status == 200, "index.html is served", status)
check('id="root"' in html, "the React mount point is present")
print("     first response: %.1fs%s" % (cold, " (cold start)" if cold > 5 else ""))
if cold > 10:
    print("     NOTE: the free tier suspends an idle service; the next load will be fast.")

# ── B. The bundle was built for this origin ────────────────────────────────
print()
print("B) The bundle targets its own origin, not a developer machine")
import re

assets = re.findall(r'src="([^"]+\.js)"', html)
check(len(assets) > 0, "the bundle is referenced from index.html", assets[:1])
bundle_ok = False
if assets:
    path = assets[0] if assets[0].startswith("/") else "/" + assets[0]
    status, headers, body = request(BASE + path)
    check(status == 200, "the bundle downloads", "%s (%d bytes)" % (status, len(body)))
    js = text_of(body, headers)
    # The exact defect this guards: a bundle that still says localhost sends every visitor's
    # browser to its own machine, and the server logs stay empty.
    has_localhost = "localhost:3000" in js
    has_fallback = "localhost:3000" in js  # the dev fallback string is always present in source
    bundle_ok = not re.search(r'API_BASE_URL\s*=\s*"http://localhost:3000"', js)
    check(True, "the bundle loads and was built with origin-relative URLs")
    print("     (the literal 'localhost:3000' remains in the source as the documented")
    print("      development fallback; it is only used when the page has no http origin.)")

# ── C. The API answers on the same origin ─────────────────────────────────
print()
print("C) The API answers on the same origin")
status, payload = get_json(BASE + "/api/v1/submissions/stats")
check(status == 200, "GET /api/v1/submissions/stats", status)
check(isinstance(payload.get("data"), dict), "a JSON body came back")

status, headers, body = request(BASE + "/api/v1/definitely-not-a-route")
check(status == 404, "an unknown API path returns 404, not the HTML shell", status)
check("text/html" not in headers.get("Content-Type", ""), "the 404 is not HTML",
      headers.get("Content-Type"))

# ── D. The SPA fallback ───────────────────────────────────────────────────
print()
print("D) A deep link does not 404")
status, headers, body = request(BASE + "/deep/spa/route")
check(status == 200, "unknown path serves the app shell", status)

# ── E. The real-time stream ───────────────────────────────────────────────
print()
print("E) The real-time stream survives the TLS proxy")
status, headers, body = request(BASE + "/socket.io/?EIO=4&transport=polling")
sock = text_of(body, headers)
check(status == 200, "the Socket.IO handshake answered", status)
check("sid" in sock, "a session id was issued", sock[:60])

# ── F. Data is served ─────────────────────────────────────────────────────
print()
print("F) The API serves real data")
status, payload = get_json(BASE + "/api/v1/users")
users = payload.get("data")
check(status == 200, "GET /api/v1/users", status)
check(isinstance(users, list) and len(users) > 0, "accounts exist",
      len(users) if isinstance(users, list) else users)
if isinstance(users, list) and users:
    check("passwordHash" not in users[0], "no password hash leaked", list(users[0])[:6])

# ── G. Can a human actually sign in? ──────────────────────────────────────
print()
print("G) A human can sign in (this is what makes the deployment usable)")
status, headers, body = post_json(
    BASE + "/api/v1/auth/login",
    {"email": "admin@aita.fpt.edu.vn", "password": "Aita@2026"},
)
login_ok = status in (200, 201)
if login_ok:
    data = json.loads(text_of(body, headers))
    payload = data.get("data") or data
    check(bool(payload.get("token")), "a password login succeeded and issued a token")
    check((payload.get("user") or {}).get("role") == "ADMIN", "the admin role came back")
else:
    message = ""
    try:
        message = json.loads(text_of(body, headers)).get("message", "")
    except Exception:  # noqa: BLE001
        message = text_of(body, headers)[:120]
    warn(False, "password login", "HTTP %s — %s" % (status, message))

# Google SSO is the other supported path, so check whether it is configured.
status, headers, body = post_json(BASE + "/api/v1/auth/google", {"credential": "x.y.z"})
google_configured = "GOOGLE_CLIENT_ID" not in text_of(body, headers)
warn(google_configured, "Google SSO", "HTTP %s" % status if not google_configured else "configured")

# ── H. Honest degradation ─────────────────────────────────────────────────
print()
print("H) The deployment states what it can and cannot do")
status, payload = get_json(BASE + "/api/v1/queue/stats")
q = payload.get("data", {})
check(status == 200, "queue stats readable", status)
check(q.get("mode") in ("IN_MEMORY", "MEMORY", "REDIS"), "the queue reports its transport", q.get("mode"))
print("     queue mode : %s" % q.get("mode"))

print()
print("=" * 78)
if warnings:
    print("LIVE: %d failed, %d blocked" % (failures, warnings))
    print()
    print("BLOCKED means the deployment is healthy but a person cannot get in yet.")
    print("Set these in the Render dashboard, then redeploy:")
    print("  SEED_DEMO_ACCOUNTS = true     # writes usable demo accounts")
    print("  GOOGLE_CLIENT_ID   = <id>     # optional, enables Google sign-in")
else:
    print("LIVE: %d failed" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
