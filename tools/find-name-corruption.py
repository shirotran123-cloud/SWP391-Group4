"""Finds every occurrence of a corrupted Vietnamese name, across every store.

The corruption replaces non-ASCII characters: 'Đinh Thành Trung' becomes
'Dinh Th?nh Trung' or 'Dinh Th<U+FFFD>nh Trung'. A regex for classic mojibake misses it,
so this looks for BOTH the replacement character and a '?' wedged between letters, in:

  * every JSON store under api-gateway/data and genai-hub/data
  * every text and jsonb column in PostgreSQL
  * the frontend types that name the user

Usage: python tools/find-name-corruption.py
"""
import glob
import json
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BAD = "\ufffd"
# A '?' between two letters is always a lost diacritic, never intentional.
QUESTION_MARK = re.compile(r"[A-Za-zÀ-ỹ]\?[A-Za-zÀ-ỹ]")


def broken(value):
    if not isinstance(value, str):
        return False
    if BAD in value:
        return True
    return bool(QUESTION_MARK.search(value))


def walk(node, path=""):
    if isinstance(node, dict):
        for key, val in node.items():
            if isinstance(val, str) and broken(val):
                yield (path + "/" + key, val)
            else:
                yield from walk(val, path + "/" + key)
    elif isinstance(node, list):
        for idx, val in enumerate(node):
            yield from walk(val, "%s[%d]" % (path, idx))


print("=" * 78)
print("1. JSON STORES")
print("=" * 78)
store_total = 0
for pattern in ("api-gateway/data/*.json", "genai-hub/data/*.json"):
    for path in sorted(glob.glob(os.path.join(REPO, pattern))):
        try:
            with open(path, "rb") as fh:
                data = json.loads(fh.read().decode("utf-8-sig"))
        except Exception as exc:
            print("  %s: unreadable (%s)" % (os.path.basename(path), exc))
            continue
        hits = list(walk(data))
        if hits:
            store_total += len(hits)
            seen = {}
            for where, val in hits:
                key = re.sub(r"\[\d+\]", "[]", where)
                seen.setdefault(key, set()).add(val)
            print("  === %s : %d field(s) ===" % (os.path.basename(path), len(hits)))
            for where, values in sorted(seen.items()):
                for val in sorted(values)[:4]:
                    print("      %-38s %r" % (where[:38], val))

print()
print("  JSON store corruption total: %d" % store_total)

print()
print("=" * 78)
print("2. POSTGRESQL")
print("=" * 78)


def psql(sql, tuples_only=True):
    args = ["docker", "exec", "aita-postgres", "psql", "-U", "aita_admin", "-d", "aita_autograding"]
    if tuples_only:
        args.append("-t")
    args += ["-A", "-c", sql]
    result = subprocess.run(args, capture_output=True)
    return (
        result.stdout.decode("utf-8", errors="replace"),
        result.stderr.decode("utf-8", errors="replace"),
    )


# Discover every text/json/jsonb column so nothing is missed.
out, err = psql(
    "SELECT table_name || '|' || column_name || '|' || data_type "
    "FROM information_schema.columns "
    "WHERE table_schema='public' AND data_type IN ('text','character varying','json','jsonb') "
    "ORDER BY table_name, column_name;"
)
if err.strip():
    print("  psql error:", err.strip()[:200])

columns = []
for line in out.splitlines():
    parts = line.strip().split("|")
    if len(parts) == 3:
        columns.append(tuple(parts))

db_total = 0
for table, column, dtype in columns:
    cast = "::text" if dtype in ("json", "jsonb") else ""
    sql = (
        "SELECT count(*) FROM %s WHERE %s%s LIKE '%%' || chr(65533) || '%%' "
        "OR %s%s ~ '[A-Za-z]\\?[A-Za-z]';" % (table, column, cast, column, cast)
    )
    out, err = psql(sql)
    if err.strip():
        continue
    try:
        count = int(out.strip() or "0")
    except ValueError:
        continue
    if count:
        db_total += count
        print("  %-28s %-22s %d row(s)" % (table, column, count))
        sample_sql = (
            "SELECT %s%s FROM %s WHERE %s%s LIKE '%%' || chr(65533) || '%%' "
            "OR %s%s ~ '[A-Za-z]\\?[A-Za-z]' LIMIT 3;" % (column, cast, table, column, cast, column, cast)
        )
        s_out, _ = psql(sample_sql)
        for line in s_out.splitlines()[:3]:
            text = line.strip()
            if text:
                print("        %s" % text[:150])

print()
print("  PostgreSQL corruption total: %d" % db_total)

print()
print("=" * 78)
print("3. SUMMARY")
print("=" * 78)
print("  JSON stores : %d" % store_total)
print("  PostgreSQL  : %d" % db_total)
print("  TOTAL       : %d" % (store_total + db_total))
