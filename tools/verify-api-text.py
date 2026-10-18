"""Verifies that no API response contains text with lost diacritics."""
import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

ENDPOINTS = [
    ("users", "http://localhost:3000/api/v1/users"),
    ("courses", "http://localhost:3000/api/v1/courses"),
    ("assignments", "http://localhost:3000/api/v1/assignments"),
    ("submissions", "http://localhost:3000/api/v1/submissions"),
    ("appeals", "http://localhost:3000/api/v1/appeals"),
    ("plagiarism-reports", "http://localhost:3000/api/v1/plagiarism/reports?role=INSTRUCTOR"),
]


def get(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"__error__": str(exc)}


def broken(value):
    if not isinstance(value, str):
        return False
    if "\ufffd" in value:
        return True
    for i, ch in enumerate(value):
        if ch == "?" and 0 < i < len(value) - 1:
            if value[i - 1].isalpha() and value[i + 1].isalpha():
                return True
    return False


total = 0
for name, url in ENDPOINTS:
    payload = get(url)
    if "__error__" in payload:
        print("  %-20s ERROR %s" % (name, payload["__error__"][:70]))
        continue

    items = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        items = [items] if items else []

    bad = []

    def scan(node, path=""):
        if isinstance(node, dict):
            for key, val in node.items():
                if isinstance(val, str) and broken(val):
                    bad.append((path + "/" + key, val[:60]))
                else:
                    scan(val, path + "/" + key)
        elif isinstance(node, list):
            for idx, val in enumerate(node):
                scan(val, "%s[%d]" % (path, idx))

    scan(items)
    total += len(bad)
    status = "OK" if not bad else "BROKEN (%d)" % len(bad)
    print("  %-20s total=%-4d %s" % (name, len(items), status))
    for path, val in bad[:3]:
        print("        %s = %r" % (path[:60], val))

print()
print("TOTAL broken fields across all API responses:", total)
