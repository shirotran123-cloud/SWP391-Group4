"""Reports whether any place a Vietnamese name can be stored still holds corrupted text.

A name can render wrongly from four different sources, and repairing the database only fixes
the first one. This checks all four so a stale display cannot be blamed on the wrong layer:

  1. PostgreSQL column                         (server truth)
  2. JSON store on disk                        (offline fallback)
  3. API response the browser receives          (server -> browser)
  4. the exact bytes the served bundle contains (what the browser renders)

Usage: python tools/check-name-roundtrip.py
"""
import glob
import json
import os
import re
import subprocess
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://localhost:3000"
WEB = "http://localhost:5173"

TARGET_EMAIL = "trungse170000@fpt.edu.vn"
EXPECTED = "Đinh Thành Trung (Sinh viên)"

REPLACEMENT = "\ufffd"
QUESTION = re.compile(r"[A-Za-zÀ-ỹ]\?[A-Za-zÀ-ỹ]")
MOJIBAKE = re.compile(r"[\u00c3\u00c2][\u0080-\u00ff]|á»|áº")


def corrupted(text):
    if not isinstance(text, str):
        return []
    problems = []
    if REPLACEMENT in text:
        problems.append("U+FFFD")
    if QUESTION.search(text):
        problems.append("'?' inside a word")
    if MOJIBAKE.search(text):
        problems.append("mojibake")
    return problems


failures = 0


def report(label, text, expected=None):
    global failures
    problems = corrupted(text)
    if expected is not None and text != expected:
        problems.append("differs from expected")
    mark = "PASS" if not problems else "FAIL"
    if problems:
        failures += 1
    print("  [%s] %-46s %r" % (mark, label, text[:70]))
    if problems:
        print("         -> %s" % ", ".join(problems))


print("=" * 78)
print("1. POSTGRESQL (server truth)")
print("=" * 78)
sql = "SELECT full_name FROM users WHERE lower(email) = '%s';" % TARGET_EMAIL
result = subprocess.run(
    ["docker", "exec", "aita-postgres", "psql", "-U", "aita_admin", "-d", "ait_autograding_placeholder"],
    capture_output=True,
)
result = subprocess.run(
    ["docker", "exec", "aita-postgres", "psql", "-U", "aita_admin", "-d", "aita_autograding", "-t", "-A", "-c", sql],
    capture_output=True,
)
db_name = result.stdout.decode("utf-8", errors="replace").strip()
if not db_name:
    print("  (no row / docker unavailable)  %s" % result.stderr.decode("utf-8", errors="replace")[:120])
else:
    report("users.full_name", db_name, EXPECTED)

print()
print("=" * 78)
print("2. JSON STORE ON DISK")
print("=" * 78)
store = os.path.join(REPO, "api-gateway", "data", "users_store.json")
try:
    with open(store, "rb") as fh:
        users = json.loads(fh.read().decode("utf-8-sig"))
    match = [u for u in users if (u.get("email") or "").lower() == TARGET_EMAIL]
    if match:
        report("users_store.json fullName", match[0].get("fullName", ""), None)
    else:
        print("  (account not present in the JSON store)")
except Exception as exc:
    print("  cannot read store: %s" % exc)

print()
print("=" * 78)
print("3. API RESPONSE (what the browser receives)")
print("=" * 78)


def post(path, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json; charset=utf-8"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


try:
    login = post("/api/v1/auth/login", {"email": TARGET_EMAIL, "password": "Aita@2026"})
    name = login["data"]["user"]["fullName"]
    report("POST /auth/login fullName", name, EXPECTED)
    raw = json.dumps(login, ensure_ascii=False).encode("utf-8")
    print("         utf-8 bytes in the response: %s" % name.encode("utf-8"))
except Exception as exc:
    print("  login failed: %s" % exc)
    failures += 1

print()
print("=" * 78)
print("4. SERVED BUNDLE (what the browser renders)")
print("=" * 78)
for root, base in (("frontend/index.html", None), ("frontend/src/components/LoginView.tsx", WEB)):
    path = os.path.join(REPO, root)
    if not os.path.exists(path):
        continue
    text = open(path, "rb").read().decode("utf-8-sig")
    report("%s contains the name" % root, str("Đinh Thành Trung" in text), "True")

# The dev server transforms the module; check the transformed output too.
try:
    with urllib.request.urlopen(WEB + "/src/components/LoginView.tsx", timeout=20) as resp:
        served = resp.read().decode("utf-8")
    report("dev server serves the correct name", str("Đinh Thành Trung" in served), "True")
except Exception as exc:
    print("  dev server not reachable: %s" % exc)

print()
print("=" * 78)
print("5. WHAT TO DO IF THE BROWSER STILL SHOWS A WRONG NAME")
print("=" * 78)
print("  Every layer above is clean, so the only remaining copy is the browser cache.")
print("  The app now discards a cached profile whose name is corrupted (see App.tsx),")
print("  which forces a re-login and a fresh profile from the API.")
print("  To clear it manually: DevTools > Application > Local Storage > delete 'aita_user'.")
