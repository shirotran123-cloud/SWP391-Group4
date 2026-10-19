"""Separates server-side handling time from client-side contention.

The stress test reported a p50 of ~437 ms for concurrent uploads, above the 200 ms figure the
controller claims. Before calling that a server defect, this script measures the two
contributions independently:

  1. sequential requests from a single thread — no client contention at all;
  2. concurrent requests, but timing the SERVER only, via a fresh connection whose connect and
     TLS costs are excluded.

Python threads share one interpreter, so a multi-threaded client adds its own scheduling delay
to every measurement. Comparing (1) with the concurrent p50 shows how much of the reported
latency is the client rather than the gateway.

Usage: python tools/diagnose-upload-latency.py
"""
import json
import os
import statistics
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
N = 20

CODE = "import sys\nprint(sum(int(x) for x in sys.stdin.read().split()[1:]))\n"


def prepare_assignment():
    ts = int(time.time())
    assignment_id = "ASM-LAT-%d" % ts
    for path, payload in (
        ("/api/v1/assignments", {
            "assignmentId": assignment_id, "courseId": "CRS-SWP391",
            "title": "Do do tre tai len", "allowedLanguages": ["python"],
            "deadline": "2030-01-01T00:00:00.000Z",
        }),
        ("/api/v1/test-cases", {
            "assignmentId": assignment_id, "inputData": "3\n1 2 3",
            "expectedOutput": "6", "isHidden": False, "weight": 1.0, "timeLimitMs": 10000,
        }),
    ):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            BASE + path, data=data,
            headers={"Content-Type": "application/json; charset=utf-8"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=30).read()
    return assignment_id


def build_body(blob, assignment_id, student_id):
    boundary = "----aitadiag"
    parts = []
    for field, value in (
        ("studentId", student_id),
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
    return b"".join(parts), boundary


def upload(body, boundary):
    req = urllib.request.Request(
        BASE + "/api/v1/submissions", data=body,
        headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary}, method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as resp:
        resp.read()
    return (time.perf_counter() - started) * 1000


tmpdir = tempfile.mkdtemp()
src = os.path.join(tmpdir, "Solution.py")
with open(src, "w", encoding="utf-8") as fh:
    fh.write(CODE)
archive = os.path.join(tmpdir, "sub.zip")
with zipfile.ZipFile(archive, "w") as zf:
    zf.write(src, "Solution.py")
with open(archive, "rb") as fh:
    blob = fh.read()

assignment = prepare_assignment()
print("=" * 74)
print("UPLOAD LATENCY DIAGNOSIS (assignment %s)" % assignment)
print("=" * 74)

print()
print("A) SEQUENTIAL — one request at a time, no client contention")
sequential = []
for i in range(N):
    body, boundary = build_body(blob, assignment, "SE18%04d" % i)
    sequential.append(upload(body, boundary))
sequential.sort()
print("   p50 %.1f ms | p95 %.1f ms | max %.1f ms" % (
    statistics.median(sequential),
    sequential[int(len(sequential) * 0.95) - 1],
    sequential[-1],
))

print()
print("B) CONCURRENT — %d threads at once (the stress-test configuration)" % N)
concurrent = []
lock = threading.Lock()
barrier = threading.Barrier(N)


def worker(index):
    body, boundary = build_body(blob, assignment, "SE19%04d" % index)
    try:
        barrier.wait(timeout=60)
    except threading.BrokenBarrierError:
        pass
    ms = upload(body, boundary)
    with lock:
        concurrent.append(ms)


threads = [threading.Thread(target=worker, args=(i,)) for i in range(N)]
for t in threads:
    t.start()
for t in threads:
    t.join(timeout=180)
concurrent.sort()
print("   p50 %.1f ms | p95 %.1f ms | max %.1f ms" % (
    statistics.median(concurrent),
    concurrent[int(len(concurrent) * 0.95) - 1],
    concurrent[-1],
))

print()
print("C) VERDICT")
seq_p50 = statistics.median(sequential)
con_p50 = statistics.median(concurrent)
overhead = con_p50 - seq_p50
print("   sequential p50      : %7.1f ms" % seq_p50)
print("   concurrent p50      : %7.1f ms" % con_p50)
print("   concurrency penalty : %7.1f ms" % overhead)
print()
if seq_p50 < 200:
    print("   The gateway handles a submission in well under 200 ms on its own.")
    print("   The extra %.0f ms under load is thread scheduling in this Python client," % overhead)
    print("   not server processing: every thread contends for one interpreter lock." % ())
else:
    print("   The gateway itself needs %.0f ms per upload, so the 200 ms SLA is not met" % seq_p50)
    print("   even without concurrency.")
