"""Tests whether the offline engine actually follows the lecturer's topic.

The offline (mock) provider is the only available provider — the Hub reports
`activeProvider: AITA-Mock-LLM-Engine` with zero API keys configured. This asks it for
several *different* topics and checks whether the generated test cases change accordingly.
"""
import json
import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

HUB = "http://localhost:3001"

TOPICS = [
    ("Tinh tong va gia tri lon nhat cua day so", "tong"),
    ("Kiem tra so nguyen to va phan tich thua so", "nguyen to"),
    ("Tim duong di ngan nhat trong do thi co trong so", "duong di"),
    ("Sap xep danh sach sinh vien theo diem trung binh", "sinh vien"),
    ("Dem so lan xuat hien cua ky tu trong chuoi", "ky tu"),
]


def generate(topic):
    body = {
        "topic": topic,
        "courseCode": "SWP391",
        "difficulty": "MEDIUM",
        "language": "python",
        "learningOutcomes": ["Clean Code"],
        "numTestCases": 3,
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "%s/api/v1/ai/generate-exam" % HUB,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    exam = payload.get("data", payload)
    if isinstance(exam, dict) and "exam" in exam:
        exam = exam["exam"]
    return exam


print("=" * 78)
print("DOES THE OFFLINE ENGINE PRODUCE TOPIC-SPECIFIC TEST CASES?")
print("=" * 78)

signatures = {}
for topic, keyword in TOPICS:
    exam = generate(topic)
    samples = exam.get("sampleTestCases") or []
    hidden = exam.get("hiddenTestCases") or []
    statement = exam.get("problemStatement") or ""

    inputs = [str(tc.get("input", "")).replace("\n", "\\n") for tc in samples + hidden]
    # A topic-faithful engine would produce different I/O per topic; an echoing engine
    # keeps the same I/O and only changes the prose.
    signature = " | ".join(inputs)

    topic_in_statement = keyword.lower() in statement.lower()
    print()
    print("topic      : %s" % topic)
    print("  statement mentions topic : %s" % topic_in_statement)
    print("  test case inputs         : %s" % signature[:96])
    print("  expected outputs         : %s" % " | ".join(
        str(tc.get("expectedOutput", "")).replace("\n", "\\n") for tc in samples + hidden)[:80])
    signatures[topic] = signature

print()
print("=" * 78)
unique = set(signatures.values())
print("distinct test-case signatures across %d different topics: %d" % (len(TOPICS), len(unique)))
if len(unique) == 1:
    print()
    print("RESULT: every topic produced IDENTICAL test cases.")
    print("        The offline engine adapts only the prose, not the actual exam.")
    print("        A lecturer asking for 'shortest path in a weighted graph' is given a")
    print("        sum-and-max exercise, and its hidden test cases would then be used to")
    print("        grade submissions of the real assignment.")
else:
    print()
    print("RESULT: the engine varies its test cases per topic.")
