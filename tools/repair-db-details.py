"""Repairs corrupted student names inside submissions.details in PostgreSQL.

`submissions.details` is a jsonb column that stores the whole grading payload, including
`plagiarismMatch.matchedStudentName`. A previous test run wrote the name through an API call
whose body was Latin-1 encoded, so PostgreSQL holds a name whose accents were replaced by
'?' characters and U+FFFD.

The canonical names come from users.full_name, matched on the ASCII skeleton (the corruption
only ever removed non-ASCII characters, so the surviving letters still identify the person).
"""
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

DB = "aita_autograding"
USER = "aita_admin"


def psql(sql, tuples_only=True):
    args = ["docker", "exec", "aita-postgres", "psql", "-U", USER, "-d", DB, "-t", "-A", "-c", sql]
    if not tuples_only:
        args = [a for a in args if a != "-t"]
    result = subprocess.run(args, capture_output=True)
    out = result.stdout.decode("utf-8", errors="replace")
    err = result.stderr.decode("utf-8", errors="replace")
    return out, err


def skeleton(value):
    return "".join(ch.lower() for ch in value if ch.isascii() and (ch.isalnum() or ch == " "))


# 1. Canonical names straight from the database.
out, err = psql("SELECT user_id || '|' || full_name FROM users;")
if err.strip():
    print("psql error:", err.strip()[:200])

canonical = {}
for line in out.splitlines():
    if "|" not in line:
        continue
    uid, name = line.split("|", 1)
    canonical[skeleton(name)] = name.strip()
print("canonical names loaded:", len(canonical))

# 2. Which submissions are affected?
out, err = psql(
    "SELECT submission_id FROM submissions "
    "WHERE details::text LIKE '%' || chr(65533) || '%';"
)
ids = [line.strip() for line in out.splitlines() if line.strip()]
print("affected submissions:", len(ids))

if not ids:
    print("nothing to repair")
    raise SystemExit(0)

# 3. Read details for each, fix the names, write back.
fixed_rows = 0
for sid in ids:
    out, err = psql("SELECT details::text FROM submissions WHERE submission_id = '%s';" % sid)
    payload = out.strip()
    if not payload:
        print("  could not read", sid, err.strip()[:80])
        continue
    try:
        node = json.loads(payload)
    except json.JSONDecodeError as exc:
        print("  bad json for", sid, exc)
        continue

    changed = []

    def fix(obj, path=""):
        if isinstance(obj, dict):
            for key, val in obj.items():
                if key == "matchedStudentName" and isinstance(val, str) and "\ufffd" in val:
                    match = canonical.get(skeleton(val))
                    if not match:
                        for skel, name in canonical.items():
                            if skel and skel in skeleton(val):
                                match = name
                                break
                    if match:
                        obj[key] = match
                        changed.append((path + "/" + key, val, match))
                else:
                    fix(val, path + "/" + key)
        elif isinstance(obj, list):
            for idx, val in enumerate(obj):
                fix(val, "%s[%d]" % (path, idx))

    fix(node)
    if not changed:
        print("  no change needed for", sid)
        continue

    # Write back with a parameterised statement to avoid any quoting problems.
    new_json = json.dumps(node, ensure_ascii=False)
    sql_file = "_fix_details.sql"
    with open(sql_file, "w", encoding="utf-8") as fh:
        # Dollar-quoting keeps the JSON intact regardless of its contents.
        fh.write("UPDATE submissions SET details = $json$%s$json$::jsonb WHERE submission_id = '%s';\n" % (new_json, sid))
    subprocess.run(["docker", "cp", sql_file, "aita-postgres:/tmp/_fix_details.sql"], capture_output=True)
    res = subprocess.run(
        ["docker", "exec", "aita-postgres", "psql", "-U", USER, "-d", DB, "-f", "/tmp/_fix_details.sql"],
        capture_output=True,
    )
    stdout = res.stdout.decode("utf-8", errors="replace")
    if "UPDATE 1" in stdout:
        fixed_rows += 1
        print("  OK   %s  %s -> %s" % (sid, changed[0][1][:34], changed[0][2]))
    else:
        print("  FAIL %s  %s" % (sid, stdout.strip()[:120]))

import os
if os.path.exists("_fix_details.sql"):
    os.remove("_fix_details.sql")

print()
print("rows repaired:", fixed_rows, "of", len(ids))

# 4. Verify.
out, err = psql("SELECT count(*) FROM submissions WHERE details::text LIKE '%' || chr(65533) || '%';")
print("rows still containing U+FFFD:", out.strip())
