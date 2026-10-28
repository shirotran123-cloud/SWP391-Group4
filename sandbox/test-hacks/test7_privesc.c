/* SEC-07: Privilege Escalation Prevention Test
 * Container chay NON-ROOT (--user 1000:1000) + --cap-drop=ALL
 * Moi de doa LEO QUYEN THAT SU:
 *   - setuid(0): can CAP_SETUID (da drop) -> EPERM [CHINH]
 *   - setcap/chown: can CAP_CHOWN (da drop) -> EPERM
 * Luu y: ptrace(PTRACE_TRACEME) KHONG can capability, chi la tu-theo-doi,
 *   khong phai leo quyen (Docker default seccomp cho phep syscall nay).
 */
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <sys/types.h>
#include <sys/prctl.h>

int main() {
    int blocked = 0;

    /* Xac nhan dang chay NON-ROOT */
    uid_t current_uid = getuid();
    printf("INFO: Dang chay voi UID=%d %s\n",
           (int)current_uid,
           current_uid == 0 ? "(ROOT — --user flag chua ap dung!)" : "(non-root — OK)");

    /* [CHU CHOT] Thu setuid(0) leo quyen root — can CAP_SETUID (da drop) */
    int r1 = setuid(0);
    if (r1 == 0 && geteuid() == 0) {
        printf("BYPASS: setuid(0) thanh cong — SECURITY BREACH!\n");
    } else {
        printf("BLOCKED: setuid(0) that bai (errno=%d: %s) — CapDrop=ALL hoat dong\n",
               errno, strerror(errno));
        blocked++;
    }

    /* Thu setreuid leo quyen — can CAP_SETUID */
    int r2 = setreuid(0, 0);
    if (r2 == 0) {
        printf("BYPASS: setreuid(0,0) thanh cong — SECURITY BREACH!\n");
    } else {
        printf("BLOCKED: setreuid(0,0) that bai (errno=%d: %s)\n", errno, strerror(errno));
        blocked++;
    }

    /* Thu chown /etc/passwd — can CAP_CHOWN (da drop) */
    int r3 = chown("/etc/passwd", 1000, 1000);
    if (r3 == 0) {
        printf("BYPASS: chown /etc/passwd thanh cong — SECURITY BREACH!\n");
    } else {
        printf("BLOCKED: chown /etc/passwd that bai (errno=%d: %s)\n", errno, strerror(errno));
        blocked++;
    }

    if (blocked >= 2) {
        printf("\nSAFE: %d/3 hanh dong leo quyen bi chan — CapDrop=ALL + non-root OK\n", blocked);
        return 1;   /* exit 1 -> PASSED */
    }

    printf("\nBYPASS: Chi chan %d/3 hanh dong — SECURITY BREACH!\n", blocked);
    return 0;
}
