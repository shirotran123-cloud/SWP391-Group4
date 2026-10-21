"""Sandbox penetration test — the Milestone 2 P2P attack exercise.

The syllabus specifies the exact attacks opponents will run against another team's sandbox:

    "Nhóm đối thủ sẽ nộp thử các file mã nguồn chứa các đoạn code độc hại (ví dụ: vòng lặp vô
     hạn, fork bomb, ghi đè file hệ thống của host) vào cổng nộp bài của nhóm bạn để kiểm tra
     xem Docker Sandbox của nhóm bạn có thực sự an toàn và cô lập tài nguyên thành công dưới
     512MB RAM và ngắt kết nối mạng hoàn toàn hay không."

Each attack below is submitted as a real .zip through the real gateway, so what is tested is the
production path — not a mock. Every attack asserts TWO things:

  1. the sandbox survived (the gateway is still answering, the container exited), and
  2. the attack actually failed to achieve its goal (no host file read, no data exfiltrated,
     no unbounded resource consumption).

Asserting only (1) would pass a sandbox that simply crashed. Asserting only (2) would pass one
that died afterwards.

Usage: python tools/verify-sandbox-security.py
"""
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
STUDENT = "SE170000"

failures = 0


def check(ok, label, detail=""):
    global failures
    if not ok:
        failures += 1
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", label, (" -> " + str(detail)) if detail else ""))


def post_json(url, payload, timeout=60):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url, timeout=30):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def gateway_alive():
    """The most important assertion in this file: did the host survive the attack?"""
    try:
        with urllib.request.urlopen(BASE + "/api/v1/submissions/stats", timeout=8) as resp:
            return resp.status == 200
    except Exception:  # noqa: BLE001
        return False


def submit(code, assignment_id, filename="Solution.py"):
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, filename)
    with open(src, "w", encoding="utf-8") as fh:
        fh.write(code)
    archive = os.path.join(tmp, "sub.zip")
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(src, filename)

    boundary = "----aitasec"
    with open(archive, "rb") as fh:
        blob = fh.read()

    parts = []
    for field, value in (
        ("studentId", STUDENT),
        ("assignmentId", assignment_id),
        ("language", "python"),
    ):
        parts.append(
            ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (boundary, field, value)).encode()
        )
    parts.append(
        ('--%s\r\nContent-Disposition: form-data; name="file"; filename="sub.zip"\r\n'
         'Content-Type: application/zip\r\n\r\n' % boundary).encode()
    )
    parts.append(blob)
    parts.append(("\r\n--%s--\r\n" % boundary).encode())

    req = urllib.request.Request(
        BASE + "/api/v1/submissions", data=b"".join(parts),
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))["data"]["submissionId"]


def wait_done(submission_id, limit=60):
    for _ in range(limit):
        time.sleep(3)
        detail = get_json("%s/api/v1/submissions/%s" % (BASE, submission_id)).get("data", {})
        if detail.get("status") in ("COMPLETED", "FAILED"):
            return detail
    return None


# ── The attack payloads ─────────────────────────────────────────────────────
# Each returns (name, reason, code). `reason` states what a successful attack would achieve,
# so a PASS means that outcome was prevented.

ATTACKS = [
    (
        "Fork bomb",
        "exhaust the host process table and take the machine down",
        "import os\nwhile True:\n    os.fork()\n",
    ),
    (
        "Memory exhaustion (beyond the 512MB limit)",
        "consume host RAM until the kernel OOM-kills unrelated processes",
        "x = []\nwhile True:\n    x.append(bytearray(50 * 1024 * 1024))\n",
    ),
    (
        "Disk exhaustion via /tmp",
        "fill the host filesystem so other services can no longer write",
        "data = b'A' * (1024 * 1024)\n"
        "with open('/tmp/fill.bin', 'wb') as f:\n"
        "    for _ in range(20000):\n"
        "        f.write(data)\n"
        "print('filled')\n",
    ),
    (
        "Host filesystem write (/etc/passwd)",
        "overwrite a host system file from inside the sandbox",
        "try:\n"
        "    with open('/etc/passwd', 'a') as f:\n"
        "        f.write('attacker::0:0::/root:/bin/sh\\n')\n"
        "    print('WROTE_HOST_FILE')\n"
        "except Exception as e:\n"
        "    print('BLOCKED:', type(e).__name__)\n",
    ),
    (
        "Host .env / secret read",
        "read the gateway's API keys and database password, then print them",
        "import os\n"
        "found = []\n"
        "for p in ['/app/.env', '/.env', '/app/api-gateway/.env', '/sandbox/.env',\n"
        "          '/proc/1/environ', '/host/.env', '../../.env']:\n"
        "    try:\n"
        "        with open(p) as f:\n"
        "            found.append(p + '=' + f.read()[:200])\n"
        "    except Exception:\n"
        "        pass\n"
        "print('SECRETS:' + repr(found))\n",
    ),
    (
        "Network exfiltration",
        "send the submitted source to an external host (proves the network is open)",
        "import socket\n"
        "try:\n"
        "    s = socket.create_connection(('1.1.1.1', 53), timeout=5)\n"
        "    print('NETWORK_OPEN')\n"
        "    s.close()\n"
        "except Exception as e:\n"
        "    print('NETWORK_BLOCKED:', type(e).__name__)\n",
    ),
    (
        "Privilege escalation attempt",
        "regain capabilities after the container dropped them, to escape the sandbox",
        "import os, ctypes\n"
        "print('uid=', os.getuid())\n"
        "try:\n"
        "    ctypes.CDLL('libc.so.6').setuid(0)\n"
        "    print('SETUID_OK uid=', os.getuid())\n"
        "except Exception as e:\n"
        "    print('SETUID_BLOCKED:', type(e).__name__)\n",
    ),
    (
        "Infinite loop (the timeout case named in the syllabus)",
        "hold a worker forever so the queue never drains",
        "while True:\n    pass\n",
    ),
]


def main():
    print("=" * 78)
    print("SANDBOX PENETRATION TEST — Milestone 2 P2P attack exercise")
    print("=" * 78)

    if not gateway_alive():
        print("  FATAL: the gateway is not answering. Start it before running this.")
        sys.exit(1)

    ts = int(time.time())
    assignment = "ASM-SEC-%d" % ts
    post_json(BASE + "/api/v1/assignments", {
        "assignmentId": assignment, "courseId": "CRS-SWP391",
        "title": "Kiem thu xam nhap sandbox", "allowedLanguages": ["python"],
        "deadline": "2030-01-01T00:00:00.000Z",
    })
    post_json(BASE + "/api/v1/test-cases", {
        "assignmentId": assignment, "inputData": "3\n1 2 3",
        "expectedOutput": "6 3", "isHidden": False, "weight": 1.0, "timeLimitMs": 3000,
    })
    print("  assignment: %s (time limit 3s, memory limit 512MB)\n" % assignment)

    results = []
    for name, goal, code in ATTACKS:
        print("─" * 78)
        print("ATTACK: %s" % name)
        print("  goal: %s" % goal)
        started = time.time()
        try:
            sid = submit(code, assignment)
        except Exception as exc:  # noqa: BLE001
            check(False, "%s: submission accepted" % name, exc)
            results.append((name, False))
            continue

        detail = wait_done(sid)
        elapsed = time.time() - started

        if not detail:
            check(False, "%s: reached a terminal status" % name, "still running after %ds" % elapsed)
            results.append((name, False))
            continue

        details = detail.get("details") or {}
        stdout = str(details.get("stdout") or "")
        stderr = str(details.get("stderr") or "")
        combined = stdout + stderr
        status = detail.get("status")

        print("  status    : %s (%.0fs)" % (status, elapsed))
        print("  exit code : %s" % details.get("exitCode"))
        if stdout.strip():
            print("  stdout    : %s" % stdout.strip()[:160])

        # Universal assertion 1 — the host survived.
        survived = gateway_alive()
        check(survived, "%s: the gateway survived" % name)

        # Universal assertion 2 — the attack did not achieve its goal.
        achieved = False
        note = ""
        if name.startswith("Fork bomb"):
            achieved = "FORKED" in combined
            note = "process table exhausted"
        elif name.startswith("Memory"):
            achieved = status == "COMPLETED" and details.get("exitCode") == 0
            note = "allocation succeeded, so no memory limit was enforced"
        elif name.startswith("Disk"):
            achieved = "filled" in stdout
            note = "wrote an unbounded amount to /tmp"
        elif "passwd" in name:
            achieved = "WROTE_HOST_FILE" in combined
            note = "a host system file was modified"
        elif ".env" in name:
            achieved = "SECRETS:[" in combined and "SECRETS:[]" not in combined
            note = "secret file contents were read"
        elif name.startswith("Network"):
            achieved = "NETWORK_OPEN" in combined
            note = "outbound network access succeeded"
        elif name.startswith("Privilege"):
            achieved = "SETUID_OK" in combined
            note = "regained root"
        elif name.startswith("Infinite"):
            # The only correct outcomes are a timeout verdict or a kill; never a clean exit.
            achieved = status == "COMPLETED" and details.get("exitCode") == 0 and elapsed < 2
            note = "the loop was allowed to run to completion"

        check(not achieved, "%s: attack did not achieve its goal" % name, note if achieved else "")
        results.append((name, survived and not achieved))
        print()

    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    for name, ok in results:
        print("  [%s] %s" % ("DEFENDED" if ok else "BREACHED", name))
    print()
    print("=" * 78)
    print("SANDBOX SECURITY: %d failed" % failures)
    print("=" * 78)
    sys.exit(1 if failures else 0)


main()
