"""Checks the API error messages a user can actually see, and the AI explanation language.

Both matter: an error toast appears in the UI, and the AI explanation is read by the student
and lecturer. This asserts every checked message is Vietnamese (contains diacritics) and free
of internal rule codes such as BR-xx / UC-xx.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
JARGON = re.compile(r"\b(?:BR|UC|FR|NFR|R0\d)-\d+\b")
VIETNAMESE = re.compile(r"[àáảãạăâđêôơưèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]")

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def call(method, path, payload=None, timeout=60):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw


def message_of(body):
    if isinstance(body, dict):
        msg = body.get("message")
        if isinstance(msg, list):
            return " | ".join(str(m) for m in msg)
        if msg:
            return str(msg)
    return str(body)


print("=" * 74)
print("1. USER-VISIBLE API ERRORS ARE VIETNAMESE AND JARGON-FREE")
print("=" * 74)

cases = [
    ("unknown submission", "GET", "/api/v1/submissions/KHONG-TON-TAI", None),
    ("unknown assignment", "GET", "/api/v1/assignments/KHONG-TON-TAI", None),
    ("unknown user", "GET", "/api/v1/users/KHONG-TON-TAI", None),
    ("plagiarism blocked for student", "GET", "/api/v1/plagiarism/reports?role=STUDENT", None),
    ("login without password", "POST", "/api/v1/auth/login", {"email": "admin@aita.fpt.edu.vn"}),
    ("login wrong password", "POST", "/api/v1/auth/login", {"email": "admin@aita.fpt.edu.vn", "password": "sai-mat-khau"}),
    ("google without token", "POST", "/api/v1/auth/google", {"email": "admin@aita.fpt.edu.vn"}),
    ("otp missing email", "POST", "/api/v1/auth/request-otp", {}),
    ("test cases need an assignment", "POST", "/api/v1/test-cases", {"assignmentId": "KHONG-CO", "inputData": "1", "expectedOutput": "2"}),
]

for label, method, path, payload in cases:
    status, body = call(method, path, payload)
    text = message_of(body)
    is_viet = bool(VIETNAMESE.search(text))
    has_jargon = bool(JARGON.search(text))
    check(is_viet and not has_jargon, label, "HTTP %s | %s" % (status, text[:96]))

print()
print("=" * 74)
print("2. AI EXPLANATION IS VIETNAMESE (the text a student reads)")
print("=" * 74)

GOOD = "import sys\ndata = sys.stdin.read().split()\nif data:\n    n = int(data[0])\n    v = sorted(int(x) for x in data[1:1+n])\n    print(' '.join(str(x) for x in v))\n"
SMELLY = (
    "class DataManagerGod:\n"
    "    def process(self, mode):\n"
    "        if mode == 1:\n"
    "            x = 1000\n"
    "        elif mode == 2:\n"
    "            x = 2000\n"
    "        elif mode == 3:\n"
    "            x = 3000\n"
    "        return x\n"
)

import tempfile
import zipfile
import time

source = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")


def submit(code, name):
    ts = int(time.time())
    asm = "ASM-LANGCHECK-%s-%d" % (name, ts)
    call("POST", "/api/v1/assignments", {
        "assignmentId": asm, "courseId": "CRS-SWP391",
        "title": "Kiem tra ngon ngu %s" % name,
        "allowedLanguages": ["python"],
        "deadline": "2030-01-01T00:00:00.000Z",
    })
    call("POST", "/api/v1/test-cases", {
        "assignmentId": asm, "inputData": "5\n4 2 5 1 3",
        "expectedOutput": "1 2 3 4 5", "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
    })

    tmp = tempfile.mkdtemp()
    py = os.path.join(tmp, "Solution.py")
    with open(py, "w", encoding="utf-8") as fh:
        fh.write(code)
    zp = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(zp, "w") as zf:
        zf.write(py, "Solution.py")

    boundary = "----aitaboundary"
    with open(zp, "rb") as fh:
        blob = fh.read()
    parts = []
    for field, value in (("studentId", "SE170000"), ("assignmentId", asm), ("language", "python")):
        parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (boundary, field, value)).encode())
    parts.append(("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"sub.zip\"\r\nContent-Type: application/zip\r\n\r\n" % boundary).encode())
    parts.append(blob)
    parts.append(("\r\n--%s--\r\n" % boundary).encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        BASE + "/api/v1/submissions", data=body,
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        created = json.loads(resp.read().decode("utf-8"))
    sid = created["data"]["submissionId"]

    for _ in range(30):
        time.sleep(4)
        _, detail = call("GET", "/api/v1/submissions/%s" % sid)
        if detail.get("data", {}).get("status") == "COMPLETED":
            return detail["data"]
    return None


for label, code in (("clean submission", GOOD), ("submission with code smells", SMELLY)):
    result = submit(code, label.split()[0])
    if not result:
        check(False, "%s: graded in time" % label)
        continue
    ai = (result.get("details") or {}).get("aiRating") or {}
    summary = ai.get("explanation") or ""
    check(bool(VIETNAMESE.search(summary)), "%s: summary is Vietnamese" % label, summary[:88])

    smells = ai.get("codeSmells") or []
    for smell in smells[:2]:
        desc = smell.get("description") or ""
        rule = smell.get("rule") or ""
        check(
            bool(VIETNAMESE.search(desc)) and bool(VIETNAMESE.search(rule)),
            "%s: smell text is Vietnamese" % label,
            ("%s // %s" % (rule, desc))[:88],
        )

print()
print("=" * 74)
print("FAILURES: %d" % failures)
print("=" * 74)
sys.exit(1 if failures else 0)
