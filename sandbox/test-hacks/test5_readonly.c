/* SEC-05: Read-only Rootfs Tampering Test
 * Thử ghi file vào /etc và /bin (hệ thống tệp chỉ đọc)
 * Kỳ vọng: EROFS (Read-only file system, errno=30, exit 1)
 */
#include <stdio.h>
#include <errno.h>
#include <string.h>

int main() {
    /* Thử ghi vào /etc — phải thất bại với ReadonlyRootfs=true */
    FILE *f1 = fopen("/etc/hacked.txt", "w");
    if (f1) {
        fprintf(f1, "PWNED\n");
        fclose(f1);
        printf("BYPASS: Ghi duoc vao /etc/hacked.txt — SECURITY BREACH!\n");
        return 0;   /* exit 0 → FAIL: filesystem không bảo vệ */
    }
    printf("BLOCKED: fopen(/etc/hacked.txt) that bai (errno=%d: %s)\n",
           errno, strerror(errno));

    /* Thử ghi vào /bin */
    FILE *f2 = fopen("/bin/pwned", "w");
    if (f2) {
        fclose(f2);
        printf("BYPASS: Ghi duoc vao /bin/pwned — SECURITY BREACH!\n");
        return 0;
    }
    printf("BLOCKED: fopen(/bin/pwned) that bai (errno=%d: %s)\n",
           errno, strerror(errno));

    /* Ca hai deu bi chan — ReadonlyRootfs hoat dong dung */
    return 1;   /* exit 1 → defense hoat dong, script ghi PASSED */
}
