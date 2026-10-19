"""Finds English sentences inside string literals in the GenAI Hub.

These are the explanations that reach the lecturer and student through the UI, so they must
be Vietnamese. A string is flagged when it looks like an English sentence and contains no
Vietnamese diacritics.

Usage: python tools/find-english-strings.py <dir> [<dir> ...]
"""
import glob
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

# Any of these letters means the string is already Vietnamese.
VIETNAMESE = re.compile(r"[àáảãạăâđêôơưÀÁẢÃẠĂÂĐÊÔƠƯèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]")

# A quoted string with at least three consecutive capitalised English words reads as prose.
SENTENCE = re.compile(r"""["'`]([^"'`\n]{25,200})["'`]""")

# Words that mark code/config rather than user-facing prose.
CODEISH = re.compile(
    r"(application/|text/|utf-|https?://|\.tsx?|\.json|\.cpp|\.py|SELECT |INSERT |UPDATE |"
    r"Bearer |GET |POST |PUT |DELETE |Content-Type|model/|gemini-|gpt-|node_modules)"
)

STOP_WORDS = {
    "the", "this", "that", "with", "from", "your", "have", "will", "must", "should",
    "could", "would", "when", "then", "than", "there", "their", "them", "these", "those",
    "into", "instead", "before", "after", "every", "make", "sure", "check", "verify",
    "and", "for", "not", "are", "was", "were", "been", "being",
}


def looks_english(text):
    if VIETNAMESE.search(text):
        return False
    if CODEISH.search(text):
        return False
    words = re.findall(r"[A-Za-z']+", text)
    if len(words) < 4:
        return False
    lowered = [w.lower() for w in words]
    stop_hits = sum(1 for w in lowered if w in STOP_WORDS)
    # Require either several function words or several consecutive capitalised words.
    caps_run = 0
    best_run = 0
    for word in words:
        if word[:1].isupper():
            caps_run += 1
            best_run = max(best_run, caps_run)
        else:
            caps_run = 0
    return stop_hits >= 2 or best_run >= 3


roots = sys.argv[1:] or ["."]
total = 0
report = {}

for root in roots:
    for path in glob.glob(os.path.join(root, "**", "*.ts"), recursive=True):
        if "node_modules" in path or path.endswith(".d.ts"):
            continue
        try:
            text = open(path, "rb").read().decode("utf-8-sig")
        except Exception:
            continue
        hits = []
        for num, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            # Skip plumbing and developer-only logging.
            if stripped.startswith(("import ", "export ", "//", "*")):
                continue
            if re.search(r"console\.(log|warn|error|debug)", line):
                continue
            for match in SENTENCE.finditer(line):
                candidate = match.group(1)
                if looks_english(candidate):
                    hits.append((num, candidate))
        if hits:
            total += len(hits)
            key = path.replace(os.sep, "/")
            report[key] = [{"line": n, "text": c} for n, c in hits]
            print("=== %s (%d) ===" % (key, len(hits)))
            for num, candidate in hits[:10]:
                print("   L%-5d %s" % (num, candidate[:100]))

print()
print("total English user-facing strings: %d" % total)

# Also persist a machine-readable copy: the shell in this environment appends unrelated
# git output to stdout, so the reliable way to read the result is from a file.
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "english-strings-report.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump({"total": total, "files": report}, fh, ensure_ascii=False, indent=2)
print("report written to english-strings-report.json")

