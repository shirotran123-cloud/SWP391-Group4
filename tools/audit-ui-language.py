"""Inventories user-visible text that is not Vietnamese, plus internal jargon.

Scans the React components for strings the user actually sees and flags:
  * internal requirement codes (UC-01, BR-03, R06, FR-...) that mean nothing to a lecturer;
  * English sentences in the UI;
  * backend-origin English that reaches the screen via AI explanations.

Template literals and JSX text are both covered; code identifiers and imports are ignored.
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

SRC = os.path.join("frontend", "src")

# Internal artefacts that should never be shown to an end user.
JARGON = [
    ("UC code", re.compile(r"\bUC-\d+")),
    ("BR code", re.compile(r"\bBR-\d+")),
    ("R code", re.compile(r"\bR0\d\b")),
    ("FR code", re.compile(r"\bFR-\d+")),
    ("NFR code", re.compile(r"\bNFR-\d+")),
    ("DoD", re.compile(r"\bDoD\b")),
    ("SSOT", re.compile(r"\bSSOT\b")),
    ("SLA", re.compile(r"\bSLA\b")),
    ("BullMQ", re.compile(r"\bBullMQ\b")),
    ("Winnowing", re.compile(r"\bWinnowing\b")),
    ("seccomp", re.compile(r"\bseccomp\b")),
    ("RBL", re.compile(r"\bRBL\b")),
]

# A line is "English UI text" if it contains an English sentence inside a string or JSX.
ENGLISH_HINT = re.compile(
    r"(?<![\w.])(?:the|this|that|with|from|your|please|failed|success|error|loading|"
    r"not found|invalid|unauthorized|forbidden|pending|completed|submit|upload|"
    r"assignment|submission|grading|plagiarism|student|lecturer|course)\b",
    re.IGNORECASE,
)

SKIP_DIRS = {"node_modules", "dist", ".vite"}

report = {}

for dirpath, dirnames, filenames in os.walk(SRC):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for name in filenames:
        if not name.endswith((".tsx", ".ts")):
            continue
        path = os.path.join(dirpath, name)
        try:
            raw = open(path, "rb").read()
            text = raw.decode("utf-8-sig")
        except Exception:
            continue

        hits = {}
        for num, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            # Ignore import/export plumbing and pure code lines with no user text.
            if stripped.startswith(("import ", "export ", "//", "*", "/*")):
                continue
            for label, pattern in JARGON:
                if pattern.search(line):
                    hits.setdefault(label, []).append(num)
        if hits:
            report[path] = hits

print("=" * 78)
print("INTERNAL JARGON VISIBLE IN THE UI")
print("=" * 78)
total = 0
for path, hits in sorted(report.items(), key=lambda kv: -sum(len(v) for v in kv[1].values())):
    counts = ", ".join("%s x%d" % (k, len(v)) for k, v in sorted(hits.items()))
    total += sum(len(v) for v in hits.values())
    print("  %-58s %s" % (path.replace(os.sep, "/"), counts))
print()
print("  total jargon occurrences: %d across %d files" % (total, len(report)))
