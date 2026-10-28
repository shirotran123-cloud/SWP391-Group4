/* SEC-06: Information Disclosure / Directory Traversal Test
 * Thử đọc .env / credentials host qua path traversal
 * Kỳ vọng: ENOENT (chỉ bind /sandbox:ro - host filesystem không được mount)
 * Lưu ý: /proc/1/environ là PID namespace riêng của container, KHÔNG phải host -> hợp lệ
 */
#include <stdio.h>
#include <errno.h>
#include <string.h>

int main() {
    /* Chỉ test host path traversal — không test /proc vì /proc là của container riêng */
    const char *targets[] = {
        "../../.env",
        "../../../.env",
        "/etc/host_secrets.txt",   /* file không tồn tại trên host lẫn container */
        "/host_mount/secret.key",  /* bind mount tới host phải bị chặn hoàn toàn */
        NULL
    };

    int leaked = 0;
    for (int i = 0; targets[i] != NULL; i++) {
        FILE *f = fopen(targets[i], "r");
        if (f) {
            char buf[256];
            printf("LEAK: Doc duoc file '%s':\n", targets[i]);
            while (fgets(buf, sizeof(buf), f)) {
                printf("  %s", buf);
            }
            fclose(f);
            leaked++;
        } else {
            printf("BLOCKED: fopen('%s') that bai (errno=%d: %s)\n",
                   targets[i], errno, strerror(errno));
        }
    }

    if (leaked > 0) {
        printf("\nBYPASS: Doc duoc %d file nhay cam — SECURITY BREACH!\n", leaked);
        return 0;   /* exit 0 → FAIL */
    }

    printf("\nSAFE: Khong co host file nao bi ro ri — Mount Namespace hoat dong dung\n");
    return 2;   /* exit 2 → PASSED (exit != 0) */
}
