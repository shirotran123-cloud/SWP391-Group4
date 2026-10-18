"""Creates/repairs the demo accounts and sets one shared password.

Why this replaces the PowerShell script: Windows PowerShell 5.1 encodes
`Invoke-RestMethod -Body <string>` as Latin-1, so Vietnamese names arrived at the API as
`Qu?n Tr? Vi�n AITA`. Every request here is sent with an explicit UTF-8 body, which is what
the original script should have done.

Run it whenever the demo accounts need to exist or their password needs resetting.
"""
import base64
import hashlib
import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

# Resolve the repository root from this file's location so the tool works from any cwd.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASE = "http://localhost:3000"
DEMO_PASSWORD = "Aita@2026"

ACCOUNTS = [
    # ── ADMIN ──
    {"userId": "ADMIN001", "email": "admin@aita.fpt.edu.vn", "fullName": "Quản Trị Viên AITA", "role": "ADMIN"},
    {"userId": "ADMIN002", "email": "admin.aita@gmail.com", "fullName": "Quản Trị Viên AITA (Gmail)", "role": "ADMIN"},
    # ── HOD ──
    {"userId": "HOD001", "email": "hod@fe.edu.vn", "fullName": "Trưởng Bộ Môn CNPM", "role": "HOD"},
    {"userId": "HOD002", "email": "hod.se@gmail.com", "fullName": "Trưởng Bộ Môn (Gmail)", "role": "HOD"},
    # ── LECTURER ──
    {"userId": "GV001", "email": "trungdt@fe.edu.vn", "fullName": "ThS. Đinh Thành Trung", "role": "INSTRUCTOR"},
    {"userId": "GV002", "email": "giangvien.edu@gmail.com", "fullName": "ThS. Giảng Viên AITA", "role": "INSTRUCTOR"},
    {"userId": "GV003", "email": "vinhnh@fe.edu.vn", "fullName": "ThS. Nguyễn Hoàng Vinh", "role": "INSTRUCTOR"},
    # ── STUDENT ──
    {"userId": "SE170000", "email": "trungse170000@fpt.edu.vn", "fullName": "Đinh Thành Trung (Sinh viên)", "role": "STUDENT"},
    {"userId": "SE170123", "email": "nguyentt@fpt.edu.vn", "fullName": "Trần Thanh Nguyên (Sinh viên)", "role": "STUDENT"},
    {"userId": "SE170456", "email": "vinhtt@fpt.edu.vn", "fullName": "Nguyễn Hoàng Vinh (Sinh viên)", "role": "STUDENT"},
    {"userId": "SE170789", "email": "trungvt@fpt.edu.vn", "fullName": "Văn Thái Trung (Sinh viên)", "role": "STUDENT"},
    {"userId": "SE170999", "email": "tientc@fpt.edu.vn", "fullName": "Trần Công Tiến (Sinh viên)", "role": "STUDENT"},
    {"userId": "SE180001", "email": "sinhvien.test@fpt.edu.vn", "fullName": "Sinh viên Kiểm Thử", "role": "STUDENT"},
]


def request(method, path, payload=None):
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw


def scrypt_hash(password):
    """Same format AuthService.hashPassword produces: 'salt:derivedKey' (scrypt, 64 bytes)."""
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=64)
    return salt + ":" + key.hex()


print("=== 1. Create or refresh each account ===")
for acc in ACCOUNTS:
    code, body = request("POST", "/api/v1/users", acc)
    if code == 201:
        print("  CREATED %-30s %s" % (acc["email"], acc["role"]))
        continue
    # Already exists (409) or the email belongs to another id (400): update instead.
    code2, listing = request("GET", "/api/v1/users")
    users = listing.get("data", []) if isinstance(listing, dict) else []
    match = next(
        (u for u in users
         if (u.get("email") or "").lower() == acc["email"].lower()
         or u.get("userId") == acc["userId"]),
        None,
    )
    if not match:
        print("  FAIL    %-30s HTTP %s %s" % (acc["email"], code, str(body)[:90]))
        continue
    code3, body3 = request(
        "PUT", "/api/v1/users/%s" % match["userId"],
        {"fullName": acc["fullName"], "role": acc["role"], "isActive": True},
    )
    stored = body3.get("data", {}).get("fullName") if isinstance(body3, dict) else None
    if code3 == 200 and stored == acc["fullName"]:
        print("  OK      %-30s %s" % (acc["email"], acc["role"]))
    else:
        print("  WARN    %-30s HTTP %s stored=%r" % (acc["email"], code3, stored))

print()
print("=== 2. Set the shared demo password in BOTH stores ===")
hash_value = scrypt_hash(DEMO_PASSWORD)
print("  scrypt hash: %s..." % hash_value[:24])

store = os.path.join(REPO_ROOT, "api-gateway", "data", "users_store.json")
if os.path.exists(store):
    users = json.load(open(store, encoding="utf-8"))
    emails = {a["email"].lower() for a in ACCOUNTS}
    touched = 0
    for user in users:
        if (user.get("email") or "").lower() in emails:
            user["passwordHash"] = hash_value
            touched += 1
    with open(store, "w", encoding="utf-8") as fh:
        json.dump(users, fh, ensure_ascii=False, indent=2)
    print("  JSON store      : %d record(s)" % touched)
else:
    print("  JSON store      : not found at %s" % store)

sql = "\n".join(
    "UPDATE users SET password_hash = '%s', updated_at = NOW() WHERE lower(email) = '%s';"
    % (hash_value, a["email"].lower())
    for a in ACCOUNTS
)

# Apply the hash to PostgreSQL as well. Both stores must agree: the gateway hydrates from
# PostgreSQL on boot, so a hash written only to JSON would be replaced by the DB value.
sql_path = os.path.join(REPO_ROOT, "_pw.sql")
with open(sql_path, "w", encoding="utf-8") as fh:
    fh.write(sql)

try:
    subprocess.run(
        ["docker", "cp", sql_path, "aita-postgres:/tmp/_pw.sql"],
        capture_output=True, check=True,
    )
    result = subprocess.run(
        ["docker", "exec", "aita-postgres", "psql", "-U", "aita_admin", "-d", "aita_autograding",
         "-f", "/tmp/_pw.sql"],
        capture_output=True,
    )
    applied = result.stdout.decode("utf-8", errors="replace").count("UPDATE 1")
    print("  PostgreSQL      : %d row(s) updated" % applied)
except Exception as exc:
    print("  PostgreSQL      : NOT applied (%s)" % exc)
    print("                    run manually: docker cp _pw.sql aita-postgres:/tmp/ && "
          "docker exec aita-postgres psql -U aita_admin -d aita_autograding -f /tmp/_pw.sql")
finally:
    if os.path.exists(sql_path):
        os.remove(sql_path)

print()
print("NOTE: restart the API Gateway so it re-hydrates both stores before testing.")

print()
print("=== 3. Verify every account can log in ===")
failures = 0
for acc in ACCOUNTS:
    code, body = request("POST", "/api/v1/auth/login", {"email": acc["email"], "password": DEMO_PASSWORD})
    if code == 200:
        role = body.get("data", {}).get("user", {}).get("role")
        name = body.get("data", {}).get("user", {}).get("fullName")
        print("  PASS %-30s role=%-11s %s" % (acc["email"], role, name))
    else:
        failures += 1
        message = body.get("message") if isinstance(body, dict) else body
        print("  FAIL %-30s %s" % (acc["email"], str(message)[:80]))

print()
print("=== RESULT: %d/%d accounts log in ===" % (len(ACCOUNTS) - failures, len(ACCOUNTS)))
if failures == 0:
    print("ALL SAMPLE ACCOUNTS READY (password: %s)" % DEMO_PASSWORD)
