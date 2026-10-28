# BAO CAO KIEM DINH AN NINH DOCKER SANDBOX - LIVE EXECUTION (8/8 KICH BAN)

> **Du an:** AITA-Intelligent (Autograding & Academic Integrity Platform)
> **Chuan dac ta:** IEEE Std 830-1998 & NFR-SEC
> **Phan he:** Backend Core & Docker Sandbox Security
> **Phuong thuc:** **LIVE - Container Docker that, exit code that, thoi gian that**
> **Thoi diem tham dinh:** 22:17:06 27/10/2026
> **Ket qua:** **8/8 DAT**

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
| **1** | `SEC-01` | Time Limit Exceeded (TLE Watchdog 2.0s) | while(true) - vong lap vo han chiem 100% CPU | GNU timeout 2s inside container (tương đương watchdog 2.0s in docker-runner.ts) | 2985ms | `124` | **OK PASSED** |
| **2** | `SEC-02` | Memory Limit Exceeded (MLE cgroups 512MB) | malloc() 10MB lien tuc den khi OOM Killer can thiep | cgroups v2 --memory=512m + --memory-swap=512m | 1310ms | `137` | **OK PASSED** |
| **3** | `SEC-03` | Fork Bomb Mitigation (PidsLimit=64) | while(1) fork() - tieu diet PID table Host | --pids-limit=64 + spawnSync timeout 6s | 11012ms | `-9` | **OK PASSED** |
| **4** | `SEC-04` | Network Isolation Breach (--network none) | socket connect(8.8.8.8:53) exfiltrate du lieu | --network=none (Linux Network Namespace co lap) | 708ms | `1` | **OK PASSED** |
| **5** | `SEC-05` | Root Filesystem Tampering (--read-only) | fopen('/etc/hacked.txt','w') - ghi de file he thong | --read-only rootfs + --tmpfs=/tmp:size=64m | 573ms | `1` | **OK PASSED** |
| **6** | `SEC-06` | Information Disclosure / Path Traversal | fopen('../../.env') - doc trom DB credentials & API Keys | Container Mount Namespace - chi bind /sandbox:ro | 581ms | `2` | **OK PASSED** |
| **7** | `SEC-07` | Privilege Escalation Prevention (CapDrop=ALL) | setuid(0) + ptrace(TRACEME) - leo thang quyen root | --cap-drop=ALL + --user=1000:1000 + --security-opt=no-new-privileges | 544ms | `1` | **OK PASSED** |
| **8** | `SEC-08` | Output Log Flooding DoS Protection | printf() 10MB+ lien tuc - crash Worker RAM | --log-opt max-size=1m + Worker stream slice 50KB | 434ms | `-9` | **OK PASSED** |

---

## 3. DAP AN PHAN BIEN P2P DEFENSE

### Script nay khac gi script cu (simulated)?
> Script moi thuc su khoi tao Docker container cho tung kich ban, inject ma tan cong tu
> sandbox/test-hacks/, do exit code va thoi gian THAT tu kernel Linux.
> Khong con dung du lieu hardcode simulated_time_ms.

### Lam sao biet container co bi co lap khong?
> SEC-04 (Network) chay connect(8.8.8.8:53) THAT va nhan ENETUNREACH tu kernel.
> SEC-06 (EnvLeak) thu fopen('../../.env') THAT va nhan ENOENT - file khong ton tai trong mount namespace.

### Tai sao dung gcc:13 cho tat ca?
> Tat ca 8 file tan cong la C/C++. gcc:13 la image da pre-pull san, chay native tren Linux kernel
> trong Docker Desktop (WSL2), dam bao cgroups v2, pids-limit, network namespace hoat dong day du.
