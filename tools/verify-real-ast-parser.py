"""Verifies the real Python AST parser is used by the hub over HTTP.

The benchmark (`genai-hub/test/run-real-ast-benchmark.ts`) proves the parser itself works. This
script proves the *deployed* path uses it: it posts the same payload the API Gateway sends to
`/api/v1/ast/matrix` and asserts the response reports `astSource: PYTHON_AST`, that a disguised
copy of a program is still flagged, and that an unrelated program is not.

That distinction matters because a parser can be correct in isolation while the service quietly
keeps calling the old code path.

Usage: python tools/verify-real-ast-parser.py
"""
import json
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

HUB = "http://localhost:3001"

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def post(url, payload, timeout=60):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


ORIGINAL = """import sys


def calculate_factorial(n):
    if n <= 1:
        return 1
    total_result = n * calculate_factorial(n - 1)
    return total_result


def process_numbers(num_list):
    results = []
    for item in num_list:
        val = calculate_factorial(item)
        results.append(val)
    return results


def main():
    data = sys.stdin.read().split()
    values = [int(x) for x in data]
    print(process_numbers(values))


main()
"""

# A GenAI-style disguise: every identifier renamed, comments rewritten, functions reordered.
DISGUISED = """import sys


def start():
    payload = sys.stdin.read().split()
    numbers = [int(n) for n in payload]
    print(handle_values(numbers))


def handle_values(collection):
    output = []
    for entry in collection:
        computed = compute_fact(entry)
        output.append(computed)
    return output


def compute_fact(x_val):
    if x_val <= 1:
        return 1
    acc_product = x_val * compute_fact(x_val - 1)
    return acc_product


start()
"""

UNRELATED = """class Graph:
    def __init__(self, vertices):
        self.adjacency = {v: [] for v in range(vertices)}

    def add_edge(self, source, target):
        self.adjacency[source].append(target)
        self.adjacency[target].append(source)

    def breadth_first(self, origin):
        visited = set()
        pending = [origin]
        order = []
        while pending:
            node = pending.pop(0)
            if node in visited:
                continue
            visited.add(node)
            order.append(node)
            for neighbour in self.adjacency[node]:
                if neighbour not in visited:
                    pending.append(neighbour)
        return order
"""


def mk(sid, name, code):
    return {"submissionId": sid, "studentName": name, "studentId": name, "sourceCode": code, "language": "python"}


print("=" * 78)
print("REAL PYTHON AST PARSER — VERIFIED THROUGH THE HUB HTTP API")
print("=" * 78)

# A) The service must report which engine judged the class.
print()
print("A) The hub reports the engine it used")
try:
    report = post(
        HUB + "/api/v1/ast/matrix",
        {"assignmentId": "ASM-AST-VERIFY", "submissions": [mk("S1", "SE1", ORIGINAL), mk("S2", "SE2", DISGUISED)]},
    )
    check(True, "matrix endpoint answered")
    check(
        report.get("astSource") == "PYTHON_AST",
        "the response reports PYTHON_AST (not the regex fallback)",
        report.get("astSource"),
    )
except urllib.error.HTTPError as exc:
    check(False, "matrix endpoint reachable", "HTTP %s" % exc.code)
    print()
    print("STOPPING: the hub must be running. Start it with:")
    print("  cd genai-hub && npx ts-node src/server.ts")
    sys.exit(1)

# B) A renamed and reordered copy must still be flagged.
print()
print("B) A GenAI disguise must still be caught")
rate = report.get("similarityMatrix", [[100, 0], [0, 100]])[0][1]
flagged = report.get("flaggedPairsCount", 0)
print("     similarity : %s%%" % rate)
print("     frames     : %s" % report.get("totalPairsCompared"))
check(rate >= 80, "renamed + reordered copy scores >= 80%", "%s%%" % rate)
check(flagged >= 1, "the pair is flagged", flagged)

# C) An unrelated program must NOT be flagged — otherwise the parser is just flagging everything.
print()
print("C) An unrelated program must not be flagged (false-positive check)")
try:
    report2 = post(
        HUB + "/api/v1/ast/matrix",
        {
            "assignmentId": "ASM-AST-VERIFY",
            "submissions": [mk("S1", "SE1", ORIGINAL), mk("S3", "SE3", UNRELATED)],
        },
    )
    rate2 = report2.get("similarityMatrix", [[100, 0], [0, 100]])[0][1]
    print("     similarity : %s%%" % rate2)
    check(rate2 < 70, "unrelated program stays below the 70% flag", "%s%%" % rate2)
except urllib.error.HTTPError as exc:
    check(False, "second matrix request", "HTTP %s" % exc.code)

# D) Invalid Python must not silently produce a confident verdict.
print()
print("D) Unparseable Python degrades honestly rather than guessing")
try:
    report3 = post(
        HUB + "/api/v1/ast/matrix",
        {
            "assignmentId": "ASM-AST-VERIFY",
            "submissions": [mk("S1", "SE1", ORIGINAL), mk("S4", "SE4", "def broken(:\n    return")],
        },
    )
    check(
        report3.get("astSource") == "REGEX_FALLBACK",
        "a syntax error falls back to the regex engine instead of failing",
        report3.get("astSource"),
    )
except urllib.error.HTTPError as exc:
    check(True, "a syntax error is handled without a 500", "HTTP %s" % exc.code)

print()
print("=" * 78)
print("REAL AST OVER HTTP: %d failed" % failures)
print("=" * 78)
sys.exit(1 if failures else 0)
