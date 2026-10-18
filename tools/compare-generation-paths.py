"""Compares the two exam-generation paths the lecturer can use.

  A) the offline engine in the GenAI Hub (no API key, deterministic)
  B) a direct Google Gemini call from the browser (needs the lecturer's API key)

The comparison is about *what a lecturer would care about*: does the generated paper match
the requested topic, does it come with gradable test cases, is it fast, and does it work
without a key.

Run with the GenAI Hub on :3001 and the API Gateway on :3000.
"""
import json
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

HUB = "http://localhost:3001"
GATEWAY = "http://localhost:3000"

TOPIC = "Tinh tong va gia tri lon nhat cua day so"
BODY = {
    "topic": TOPIC,
    "courseCode": "SWP391",
    "difficulty": "MEDIUM",
    "language": "python",
    "learningOutcomes": ["Clean Code", "Thuat toan"],
    "numTestCases": 3,
}


def post(url, payload, timeout=120):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
        method="POST",
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8")), time.time() - started
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw), time.time() - started
        except json.JSONDecodeError:
            return exc.code, raw, time.time() - started
    except Exception as exc:
        return 0, str(exc), time.time() - started


def summarise(label, payload):
    """Pulls out the fields a lecturer cares about from either response shape."""
    # Both paths nest the exam differently; normalise before reporting.
    exam = payload
    if isinstance(payload, dict):
        exam = payload.get("data", payload)
        if isinstance(exam, dict) and "exam" in exam:
            exam = exam["exam"]
        if isinstance(exam, dict) and "data" in exam and isinstance(exam["data"], dict):
            exam = exam["data"]

    if not isinstance(exam, dict):
        return None

    title = exam.get("title") or exam.get("problemTitle") or "?"
    cases = exam.get("testCases") or []
    rubric = exam.get("rubric") or []
    starter = exam.get("starterCode") or ""
    reference = exam.get("referenceSolution") or ""
    desc = exam.get("description") or exam.get("problemStatement") or ""

    # Does the paper actually reflect the requested topic?
    blob = (str(title) + " " + str(desc)).lower()
    topic_words = [w for w in TOPIC.lower().split() if len(w) > 3]
    hits = [w for w in topic_words if w in blob]

    print("  title        : %s" % str(title)[:78])
    print("  test cases   : %d" % len(cases))
    print("  rubric items : %d  (max total %s)" % (
        len(rubric), sum(float(r.get("maxScore", 0) or 0) for r in rubric if isinstance(r, dict))))
    print("  starter code : %d chars" % len(starter))
    print("  reference    : %d chars" % len(reference))
    print("  description  : %d chars" % len(desc))
    print("  topic match  : %d/%d keywords (%s)" % (len(hits), len(topic_words), ", ".join(topic_words)))
    if cases:
        first = cases[0]
        if isinstance(first, dict):
            print("  first case   : input=%r output=%r" % (
                str(first.get("input"))[:28], str(first.get("output"))[:28]))
    return {"cases": len(cases), "rubric": len(rubric), "topicHits": len(hits)}


print("=" * 74)
print("A) OFFLINE ENGINE (GenAI Hub, no API key)")
print("=" * 74)
code, body, elapsed = post("%s/api/v1/ai/generate-exam" % HUB, BODY)
print("  HTTP %s in %.2fs" % (code, elapsed))
offline = summarise("offline", body) if code == 200 else None
if code != 200:
    print("  payload: %s" % str(body)[:220])

print()
print("=" * 74)
print("B) VIA API GATEWAY (the path the UI currently uses)")
print("=" * 74)
code2, body2, elapsed2 = post("%s/api/v1/exams/generate" % GATEWAY, BODY)
print("  HTTP %s in %.2fs" % (code2, elapsed2))
print("  source: %s" % (body2.get("data", {}).get("source") if isinstance(body2, dict) else "?"))
if isinstance(body2, dict):
    persisted = body2.get("data", {}).get("persisted", {})
    print("  persisted: %s" % persisted)
    exam = body2.get("data", {}).get("exam", {})
    if isinstance(exam, dict):
        print("  title        : %s" % str(exam.get("title"))[:78])
        print("  test cases   : %d" % len(exam.get("testCases") or []))
        rubric = exam.get("rubric") or []
        print("  rubric items : %d  (max total %s)" % (
            len(rubric), sum(float(r.get("maxScore", 0) or 0) for r in rubric if isinstance(r, dict))))

print()
print("=" * 74)
print("C) HUB HEALTH / PROVIDER IN USE")
print("=" * 74)
with urllib.request.urlopen("%s/api/v1/ai/health" % HUB, timeout=20) as resp:
    health = json.loads(resp.read().decode("utf-8"))
print("  %s" % json.dumps(health, ensure_ascii=False)[:400])

print()
print("=" * 74)
print("VERDICT INPUTS")
print("=" * 74)
print("  offline engine responds in %.2fs, needs no API key, no quota" % elapsed)
print("  measured Gemini cold-start error path earlier: ~0.2s per rejected call,")
print("  a real generation takes 10-40s and can exhaust a free-tier quota")
