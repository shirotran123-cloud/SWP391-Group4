"""Repairs `matchedStudentName` in submissions_store.json that lost its diacritics.

A damaged value like 'Dinh Th?nh Trung (Sinh vi?n)' still keeps its ASCII letters, so the
canonical name is found by comparing the *surviving* skeleton: strip every character that
could have been corrupted (non-ASCII, '?', U+FFFD) from both sides and require the ASCII
remnant of the clean name to equal the ASCII remnant of the damaged one.
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

# Resolve paths from this file so the tool works from any cwd.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

USERS = os.path.join(REPO_ROOT, "api-gateway", "data", "users_store.json")
SUBS = os.path.join(REPO_ROOT, "api-gateway", "data", "submissions_store.json")
FIELD = "matchedStudentName"


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


def skeleton(value):
    """ASCII letters and digits only, lowercased.

    Both the damaged and the clean name reduce to the same skeleton because the corruption
    only ever removed non-ASCII characters.
    """
    return "".join(ch.lower() for ch in value if ch.isascii() and (ch.isalnum() or ch == " "))


users = json.load(open(USERS, encoding="utf-8"))
clean = {}
for user in users:
    name = user.get("fullName")
    if name:
        clean.setdefault(skeleton(name), name)

subs = json.load(open(SUBS, encoding="utf-8"))
repaired = 0
unmatched = set()


def fix(node):
    global repaired
    if isinstance(node, dict):
        for key, val in list(node.items()):
            if key == FIELD and broken(val):
                want = skeleton(val)
                match = clean.get(want)
                if not match:
                    # Fall back to a containment check; skeletons can differ by punctuation.
                    for skel, name in clean.items():
                        if skel and want and (skel in want or want in skel):
                            match = name
                            break
                if match:
                    node[key] = match
                    repaired += 1
                else:
                    unmatched.add(val)
            else:
                fix(val)
    elif isinstance(node, list):
        for item in node:
            fix(item)


fix(subs)
print("repaired:", repaired)
if unmatched:
    print("unmatched:", sorted(unmatched))

with open(SUBS, "w", encoding="utf-8") as fh:
    json.dump(subs, fh, ensure_ascii=False, indent=2)
print("written:", SUBS)
