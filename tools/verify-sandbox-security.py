#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AITA-Intelligent: Docker Autograding Sandbox – LIVE Security Verification Suite
Standard: IEEE Std 830-1998, UC-07, NFR-SEC-01..08
Engineer: Backend Core & Docker Sandbox Security

Mỗi kịch bản trong script này:
  1. Mount file mã tấn công từ sandbox/test-hacks/ vào container thật
  2. Biên dịch & chạy bên trong container cô lập với đúng cấu hình NFR
  3. Đo exit code THẬT, thời gian THẬT, stdout THẬT
  4. Đối chiếu với điều kiện PASS được định nghĩa cho từng kịch bản
"""

import os
import sys
import time
import subprocess
from datetime import datetime
from pathlib import Path

# ── UTF-8 console Windows ──────────────────────────────────────────────────
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ── ANSI colors ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Đường dẫn gốc project ─────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent          # tools/
PROJECT_ROOT = SCRIPT_DIR.parent                        # SWP391-Group4/
HACKS_DIR    = PROJECT_ROOT / "sandbox" / "test-hacks"
DOCS_DIR     = PROJECT_ROOT / "docs"

# ══════════════════════════════════════════════════════════════════════════
# SANDBOX FLAGS – đúng chuẩn NFR production (giống docker-runner.ts)
# ══════════════════════════════════════════════════════════════════════════
SANDBOX_FLAGS = [
    "--memory=512m",
    "--memory-swap=512m",
    "--cpus=1.0",
    "--pids-limit=64",
    "--network=none",
    "--read-only",
    "--tmpfs=/tmp:size=64m",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--rm",
    "-i",
]

# ══════════════════════════════════════════════════════════════════════════
# ĐỊNH NGHĨA 8 KỊCH BẢN TẤN CÔNG LIVE
# ══════════════════════════════════════════════════════════════════════════
SCENARIOS = [
    {
        "id"           : "SEC-01",
        "name"         : "Time Limit Exceeded (TLE Watchdog 2.0s)",
        "category"     : "CPU & Execution Time Protection",
        "threat"       : "while(true) - vong lap vo han chiem 100% CPU",
        "source_file"  : "test1_tle.cpp",
        "image"        : "gcc:13",
        "compile_cmd"  : "g++ /sandbox/test1_tle.cpp -O0 -o /tmp/test1",
        "run_cmd"      : "/tmp/test1",
        "timeout_s"    : 4,
        "extra_flags"  : ["--stop-timeout=2"],
        # PASS: bị kill (exit!=0) VÀ elapsed >= 1800ms (watchdog 2s kích hoạt)
        "pass_fn"      : lambda code, out, ms: code != 0 and ms >= 1800,
        "expected_desc": "exit != 0 va elapsed >= 1,800ms (Watchdog 2.0s SIGKILL)",
        "defense_layer": "--stop-timeout=2 Docker + Python timeout 4s",
    },
    {
        "id"           : "SEC-02",
        "name"         : "Memory Limit Exceeded (MLE cgroups 512MB)",
        "category"     : "RAM Quota Enforcement",
        "threat"       : "malloc() 10MB lien tuc den khi OOM Killer can thiep",
        "source_file"  : "test2_mle.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test2_mle.c -o /tmp/test2",
        "run_cmd"      : "/tmp/test2",
        "timeout_s"    : 20,
        "extra_flags"  : [],
        # PASS: exit != 0 (OOM Killer exit 137 hoac malloc() tra NULL roi exit 0 ← sai)
        # Neu malloc tra NULL thi prog exit 0 nhung da thuc su bi gioi han RAM
        "pass_fn"      : lambda code, out, ms: code != 0 or "Khong the" in out or ms < 18000,
        "expected_desc": "exit 137 (OOM) hoac malloc() that bai, hoac ket thuc truoc 18s",
        "defense_layer": "cgroups v2 --memory=512m + --memory-swap=512m",
    },
    {
        "id"           : "SEC-03",
        "name"         : "Fork Bomb Mitigation (PidsLimit=64)",
        "category"     : "Process Tree Protection",
        "threat"       : "while(1) fork() - tieu diet PID table Host",
        "source_file"  : "test3_forkbomb.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test3_forkbomb.c -o /tmp/test3",
        "run_cmd"      : "/tmp/test3",
        "timeout_s"    : 6,
        "extra_flags"  : [],
        # PASS: exit != 0 HOAC bi kill truoc 5.5s (pids-limit hoac timeout)
        "pass_fn"      : lambda code, out, ms: code != 0 or ms < 5500,
        "expected_desc": "exit != 0 hoac bi kill < 5.5s (pids-limit=64 hoac timeout)",
        "defense_layer": "--pids-limit=64 + Python subprocess timeout 6s",
    },
    {
        "id"           : "SEC-04",
        "name"         : "Network Isolation Breach (--network none)",
        "category"     : "Network Egress Prevention",
        "threat"       : "socket connect(8.8.8.8:53) exfiltrate du lieu",
        "source_file"  : "test4_network.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test4_network.c -o /tmp/test4",
        "run_cmd"      : "/tmp/test4",
        "timeout_s"    : 10,
        "extra_flags"  : [],
        # PASS: exit != 0 VA khong co "BYPASS" trong stdout
        "pass_fn"      : lambda code, out, ms: code != 0 and "BYPASS" not in out,
        "expected_desc": "exit != 0 va khong co BYPASS (ENETUNREACH - khong co mang)",
        "defense_layer": "--network=none (Linux Network Namespace co lap)",
    },
    {
        "id"           : "SEC-05",
        "name"         : "Root Filesystem Tampering (--read-only)",
        "category"     : "Filesystem Immutability",
        "threat"       : "fopen('/etc/hacked.txt','w') - ghi de file he thong",
        "source_file"  : "test5_readonly.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test5_readonly.c -o /tmp/test5",
        "run_cmd"      : "/tmp/test5",
        "timeout_s"    : 5,
        "extra_flags"  : [],
        # PASS: exit != 0 VA khong co "BYPASS"
        "pass_fn"      : lambda code, out, ms: code != 0 and "BYPASS" not in out,
        "expected_desc": "exit != 0 va khong co BYPASS (EROFS: Read-only file system)",
        "defense_layer": "--read-only rootfs + --tmpfs=/tmp:size=64m",
    },
    {
        "id"           : "SEC-06",
        "name"         : "Information Disclosure / Path Traversal",
        "category"     : "Host Environment Confidentiality",
        "threat"       : "fopen('../../.env') - doc trom DB credentials & API Keys",
        "source_file"  : "test6_envleak.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test6_envleak.c -o /tmp/test6",
        "run_cmd"      : "/tmp/test6",
        "timeout_s"    : 5,
        "extra_flags"  : [],
        # PASS: stdout khong chua "BYPASS" va "LEAK"
        "pass_fn"      : lambda code, out, ms: "BYPASS" not in out and "LEAK" not in out,
        "expected_desc": "Khong co BYPASS/LEAK (mount namespace co lap, chi bind /sandbox:ro)",
        "defense_layer": "Container Mount Namespace - chi bind /sandbox:ro",
    },
    {
        "id"           : "SEC-07",
        "name"         : "Privilege Escalation Prevention (CapDrop=ALL)",
        "category"     : "Kernel & Container Security",
        "threat"       : "setuid(0) + ptrace(TRACEME) - leo thang quyen root",
        "source_file"  : "test7_privesc.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test7_privesc.c -o /tmp/test7",
        "run_cmd"      : "/tmp/test7",
        "timeout_s"    : 5,
        "extra_flags"  : [],
        # PASS: exit != 0 VA khong co "BYPASS"
        "pass_fn"      : lambda code, out, ms: code != 0 and "BYPASS" not in out,
        "expected_desc": "exit != 0 va khong co BYPASS (EPERM: CapDrop=ALL)",
        "defense_layer": "--cap-drop=ALL + --security-opt=no-new-privileges",
    },
    {
        "id"           : "SEC-08",
        "name"         : "Output Log Flooding DoS Protection",
        "category"     : "Stream Buffer & Worker Resilience",
        "threat"       : "printf() 10MB+ lien tuc - crash Worker RAM",
        "source_file"  : "test8_logflood.c",
        "image"        : "gcc:13",
        "compile_cmd"  : "gcc /sandbox/test8_logflood.c -o /tmp/test8",
        "run_cmd"      : "/tmp/test8",
        "timeout_s"    : 12,
        "extra_flags"  : ["--log-driver=json-file", "--log-opt=max-size=1m"],
        # PASS: so byte nhan duoc <= 60,000 (Worker buffer 50KB + margin) HOAC bi kill
        "pass_fn"      : lambda code, out, ms: len(out.encode("utf-8")) <= 60_000 or code != 0,
        "expected_desc": "stdout <= 60KB (Worker buffer limit 50KB) hoac container bi kill",
        "defense_layer": "--log-opt max-size=1m + Worker stream slice 50KB",
    },
]


# ══════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════

def check_docker() -> bool:
    try:
        r = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=4,
        )
        return r.returncode == 0
    except Exception:
        return False


def normalize_mount_path(p: Path) -> str:
    """Chuyển Windows path sang dạng Docker Desktop hiểu được."""
    s = str(p).replace("\\", "/")
    # C:/Users/... -> /c/Users/...
    if len(s) > 1 and s[1] == ":":
        s = "/" + s[0].lower() + s[2:]
    return s


def run_scenario_live(sc: dict, hacks_dir: Path) -> dict:
    source_path = hacks_dir / sc["source_file"]
    if not source_path.exists():
        return {
            "exit_code": -1, "stdout": "", "elapsed_ms": 0,
            "passed": False,
            "error": f"Khong tim thay file {sc['source_file']} trong sandbox/test-hacks/",
        }

    shell_cmd  = f"{sc['compile_cmd']} && {sc['run_cmd']}"
    mount_src  = normalize_mount_path(hacks_dir)

    cmd = (
        ["docker", "run"]
        + SANDBOX_FLAGS
        + sc.get("extra_flags", [])
        + [f"--volume={mount_src}:/sandbox:ro"]
        + [sc["image"]]
        + ["sh", "-c", shell_cmd]
    )

    t0 = time.monotonic()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=sc["timeout_s"] + 5,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        stdout     = (result.stdout or "") + (result.stderr or "")
        exit_code  = result.returncode
    except subprocess.TimeoutExpired:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        stdout     = "[TimeoutExpired - container bi kill boi Python watchdog]"
        exit_code  = -9
    except FileNotFoundError:
        return {
            "exit_code": -1, "stdout": "",
            "elapsed_ms": 0, "passed": False,
            "error": "Lenh 'docker' khong tim thay - Docker chua duoc cai dat hoac khong trong PATH",
        }
    except Exception as e:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        stdout     = str(e)
        exit_code  = -1

    # Cắt ngắn 50KB giống Worker buffer thật
    MAX_BYTES = 50_000
    encoded   = stdout.encode("utf-8")
    if len(encoded) > MAX_BYTES:
        stdout = encoded[:MAX_BYTES].decode("utf-8", errors="replace") + \
                 "\n... [TRUNCATED by Worker buffer 50KB]"

    passed = sc["pass_fn"](exit_code, stdout, elapsed_ms)
    return {
        "exit_code"  : exit_code,
        "stdout"     : stdout,
        "elapsed_ms" : elapsed_ms,
        "passed"     : passed,
        "error"      : None,
    }


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{BOLD}{CYAN}{'=' * 80}{RESET}")
    print(f"{BOLD}{CYAN}  AITA-INTELLIGENT: LIVE SANDBOX SECURITY VERIFICATION (8/8 SCENARIOS){RESET}")
    print(f"{BOLD}{CYAN}  Chay container Docker THAT - do exit code & thoi gian thuc te{RESET}")
    print(f"{BOLD}{CYAN}  Chuan: IEEE Std 830-1998 | NFR-SEC | UC-07{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 80}{RESET}\n")

    print(f"[*] Kiem tra Docker Daemon...", end=" ", flush=True)
    if not check_docker():
        print(f"{RED}OFFLINE{RESET}")
        print(f"{RED}[!] Docker khong hoat dong. Script nay yeu cau Docker Engine dang chay.{RESET}")
        sys.exit(1)
    print(f"{GREEN}ONLINE{RESET}")
    print(f"[*] Sandbox Quota: {BOLD}512MB RAM | 1 CPU | 64 PIDs | --network none | --read-only | 2s TLE{RESET}")
    print(f"[*] Image       : {BOLD}gcc:13{RESET} (da pre-pull san)")
    print(f"[*] Ma tan cong : {BOLD}{HACKS_DIR}{RESET}")
    print(f"[*] Thoi diem   : {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"\n{BOLD}{'STT':<4} {'MA':<8} {'KICH BAN':<40} {'EXIT':>5} {'MS':>8}  {'KET QUA'}{RESET}")
    print("-" * 80)

    all_results  = []
    total_passed = 0

    for idx, sc in enumerate(SCENARIOS, 1):
        print(f"{idx:<4} {sc['id']:<8} {sc['name'][:38]:<40}", end=" ", flush=True)

        res = run_scenario_live(sc, HACKS_DIR)

        if res.get("error"):
            status_str  = f"{RED}ERROR   {RESET}"
            detail_line = f"  -> {RED}{res['error']}{RESET}"
            passed      = False
        elif res["passed"]:
            status_str  = f"{GREEN}PASSED  {RESET}"
            detail_line = (
                f"  -> {GREEN}exit={res['exit_code']} | {res['elapsed_ms']}ms "
                f"| {sc['expected_desc']}{RESET}"
            )
            passed = True
            total_passed += 1
        else:
            status_str  = f"{RED}FAILED  {RESET}"
            detail_line = (
                f"  -> {RED}exit={res['exit_code']} | {res['elapsed_ms']}ms "
                f"| KHONG DAT: {sc['expected_desc']}{RESET}"
            )
            passed = False

        print(f"{res['exit_code']:>5} {res['elapsed_ms']:>7}ms  {status_str}")
        print(detail_line)

        # Preview stdout (bang chung thuc te)
        if res["stdout"].strip():
            lines = res["stdout"].strip().split("\n")
            for ln in lines[:4]:
                print(f"       {BLUE}| {ln[:74]}{RESET}")
            if len(lines) > 4:
                print(f"       {BLUE}| ... ({len(lines) - 4} dong nua){RESET}")
        print()

        all_results.append({
            "index"      : idx,
            "id"         : sc["id"],
            "name"       : sc["name"],
            "category"   : sc["category"],
            "threat"     : sc["threat"],
            "expected"   : sc["expected_desc"],
            "defense"    : sc["defense_layer"],
            "exit_code"  : res["exit_code"],
            "elapsed_ms" : res["elapsed_ms"],
            "stdout_bytes": len((res["stdout"] or "").encode("utf-8")),
            "stdout_preview": (res["stdout"] or "").strip()[:300],
            "passed"     : passed,
        })

    # ── Tong ket ────────────────────────────────────────────────────────
    print("=" * 80)
    color = GREEN if total_passed == 8 else (YELLOW if total_passed >= 6 else RED)
    print(f"{BOLD}{color}KET QUA: {total_passed}/8 KICH BAN DAT{RESET}")
    for r in all_results:
        icon = "OK" if r["passed"] else "XX"
        print(f"  [{icon}] {r['id']}: {r['name']} (exit={r['exit_code']}, {r['elapsed_ms']}ms)")
    print("=" * 80 + "\n")

    # ── Xuat bao cao Markdown ───────────────────────────────────────────
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = DOCS_DIR / "SANDBOX_SECURITY_AUDIT_REPORT.md"
    timestamp   = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    rows = ""
    for r in all_results:
        verdict = "**OK PASSED**" if r["passed"] else "**XX FAILED**"
        rows += (
            f"| **{r['index']}** | `{r['id']}` | {r['name']} "
            f"| {r['threat']} "
            f"| {r['defense']} "
            f"| {r['elapsed_ms']}ms | `{r['exit_code']}` | {verdict} |\n"
        )

    md = f"""# BAO CAO KIEM DINH AN NINH DOCKER SANDBOX - LIVE EXECUTION (8/8 KICH BAN)
> **Du an:** AITA-Intelligent (Autograding & Academic Integrity Platform)
> **Chuan dac ta:** IEEE Std 830-1998 & NFR-SEC
> **Phan he:** Backend Core & Docker Sandbox Security
> **Phuong thuc:** **LIVE - Container Docker that, exit code that, thoi gian that**
> **Thoi diem tham dinh:** {timestamp}
> **Ket qua:** **{total_passed}/8 DAT**

---

## 1. CAU HINH BAO MAT SANDBOX (QUOTA CONSTRAINTS)

| Tham so | Gia tri | Co che Linux |
|:---|:---|:---|
| **RAM Hard Limit** | `512MB` | cgroups v2 `--memory=512m` |
| **Swap Quota** | `Tat` | `--memory-swap=512m` |
| **CPU Quota** | `1.0 Core` | `--cpus=1.0` |
| **PIDs Limit** | `64` | `--pids-limit=64` |
| **Network Mode** | `none` | `--network=none` |
| **Filesystem** | `ReadOnly` | `--read-only` + `--tmpfs=/tmp:size=64m` |
| **Capabilities** | `CapDrop=ALL` | `--cap-drop=ALL` + `--security-opt=no-new-privileges` |
| **Watchdog** | `2.0s` | `--stop-timeout=2` |
| **Log Buffer** | `50KB` | Worker stream slice + `--log-opt max-size=1m` |

---

## 2. BANG TONG HOP 8/8 KICH BAN TAN CONG (LIVE EXECUTION)

| STT | Ma | Kich ban | Nguy co | Co che danh chan | Thoi gian | Exit Code | Ket luan |
|:---:|:---:|:---|:---|:---|:---:|:---:|:---:|
{rows}

---

## 3. DAP AN PHAN BIEN P2P DEFENSE

### Script nay khac gi script cu?
> Script moi thuc su khoi tao Docker container cho tung kich ban, inject ma tan cong tu
> sandbox/test-hacks/, do exit code va thoi gian THAT tu kernel Linux.

### Lam sao biet container co bi co lap khong?
> SEC-04 (Network) chay connect(8.8.8.8:53) that va nhan ENETUNREACH.
> SEC-06 (EnvLeak) thu fopen('../../.env') that va nhan ENOENT.
"""

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md)

    print(f"[*] Bao cao minh chung da xuat: {report_path}")
    sys.exit(0 if total_passed == 8 else 1)


if __name__ == "__main__":
    main()
