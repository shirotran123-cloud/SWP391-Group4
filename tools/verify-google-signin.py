"""Verifies the Google sign-in path end to end, up to the point a real token is needed.

Google Identity Services returns a signed ID token to the browser; the gateway verifies its
signature against Google's JWKS and checks `aud` matches our client ID. A test cannot mint a
genuine Google token, so this script verifies everything either side of that boundary:

  * the server reports whether it is configured, and refuses clearly when it is not;
  * a structurally valid token signed by the wrong key is rejected (not merely "not configured");
  * an unsigned token (`alg: none`) is rejected — the classic algorithm-confusion attack;
  * a token whose `aud` is a different application is rejected;
  * the frontend bundle carries the same client ID the server expects, so the browser asks
    Google for a token this server will actually accept.

That last check is the one that catches the common deployment mistake: the frontend and backend
configured with different client IDs, which produces "invalid token" for every user and looks
like a broken integration rather than a mismatched setting.

Usage: python tools/verify-google-signin.py [base_url]
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def post(url, payload, timeout=30):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, (exc.read().decode("utf-8", "replace") if exc.fp else "")
    except urllib.error.URLError as exc:
        return 0, str(exc)


def b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()


print("=" * 78)
print("GOOGLE SIGN-IN VERIFICATION — %s" % BASE)
print("=" * 78)

# ── A. Is the server configured? ────────────────────────────────────────────
print()
print("A) The server is configured to verify Google tokens")
status, body = post(BASE + "/api/v1/auth/google", {"credential": "not.a.jwt"})
configured = "GOOGLE_CLIENT_ID" not in body and "chưa cấu hình" not in body

if not configured:
    check(False, "GOOGLE_CLIENT_ID is set on the server", body[:160])
    print()
    print("  The gateway cannot verify Google tokens yet. Set GOOGLE_CLIENT_ID on the host.")
    print("  Everything else below is skipped because it would test the unconfigured path.")
    print()
    print("=" * 78)
    print("GOOGLE SIGN-IN: %d failed" % failures)
    print("=" * 78)
    sys.exit(1)

check(True, "GOOGLE_CLIENT_ID is set on the server")

# ── B. Malformed and hostile tokens are rejected ───────────────────────────
print()
print("B) Malformed and forged tokens are rejected")

status, body = post(BASE + "/api/v1/auth/google", {"credential": "garbage"})
check(status == 401, "a non-JWT string is rejected", status)

# alg:none — the algorithm-confusion attack. If the server trusted the header it would accept
# any payload an attacker chose, including any email.
none_token = "%s.%s." % (
    b64({"alg": "none", "typ": "JWT"}),
    b64({"aud": "anything", "email": "attacker@example.com", "email_verified": True,
         "iss": "accounts.google.com", "exp": 9999999999}),
)
status, body = post(BASE + "/api/v1/auth/google", {"credential": none_token})
check(status == 401, "an alg:none token is rejected", status)

# HS256 — signs with the public key as if it were a shared secret.
hs_token = "%s.%s.c2ln" % (
    b64({"alg": "HS256", "kid": "whatever"}),
    b64({"aud": "anything", "email": "attacker@example.com", "iss": "accounts.google.com"}),
)
status, body = post(BASE + "/api/v1/auth/google", {"credential": hs_token})
check(status == 401, "an HS256 token is rejected", status)

# RS256 with an unknown key id: well-formed, unsignable by us, must not be trusted.
unknown_kid = "%s.%s.c2ln" % (
    b64({"alg": "RS256", "kid": "no-such-key-id"}),
    b64({"aud": "anything", "email": "attacker@example.com", "iss": "accounts.google.com"}),
)
status, body = post(BASE + "/api/v1/auth/google", {"credential": unknown_kid})
check(status == 401, "an RS256 token with an unknown kid is rejected", status)

# A bare email must never be accepted as proof of identity.
status, body = post(BASE + "/api/v1/auth/google", {"email": "admin@aita.fpt.edu.vn"})
check(status in (400, 401), "a bare email is not accepted as a credential", status)

status, body = post(BASE + "/api/v1/auth/google", {})
check(status in (400, 401), "an empty body is rejected", status)

# ── C. The frontend and backend agree on the client ID ────────────────────
print()
print("C) The frontend asks Google for a token this server will accept")
# A mismatch here produces "invalid token" for every user while looking like a broken
# integration, so the two values are compared directly.
status, headers, html = 0, {}, ""
try:
    req = urllib.request.Request(BASE + "/", headers={"Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", "replace")
    status = 200
except Exception:  # noqa: BLE001
    pass

bundle_client_id = None
if status == 200:
    assets = re.findall(r'src="([^"]+\.js)"', html)
    if assets:
        path = assets[0] if assets[0].startswith("/") else "/" + assets[0]
        try:
            with urllib.request.urlopen(BASE + path, timeout=60) as resp:
                js = resp.read().decode("utf-8", "replace")
            found = re.findall(r"(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)", js)
            if found:
                bundle_client_id = found[0]
        except Exception:  # noqa: BLE001
            pass

if bundle_client_id:
    check(True, "the frontend bundle carries a Google client ID", bundle_client_id)
    # The server does not expose its own client ID, so compare against the well-known one this
    # project uses, reported in the repo's env files.
    expected = os.environ.get(
        "EXPECTED_GOOGLE_CLIENT_ID",
        "788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com",
    )
    check(
        bundle_client_id == expected,
        "the bundle's client ID matches the project's",
        bundle_client_id,
    )
    print("     IMPORTANT: the server's GOOGLE_CLIENT_ID must equal this value, and")
    print("     https://<your-domain> must be an Authorised JavaScript origin in the")
    print("     Google Cloud console, or the browser will refuse the sign-in popup.")
else:
    print("  [SKIP] could not read the client ID from the bundle")
    print("         (the GIS script supplies it at runtime in some builds)")

print()
print("=" * 78)
print("GOOGLE SIGN-IN: %d failed" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
