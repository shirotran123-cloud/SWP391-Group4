/* SEC-08: Output Log Flooding DoS Test
 * In hàng triệu dòng ra stdout để kiểm tra Worker Buffer Limit 50KB
 * Kỳ vọng: Sinh ra > 50KB output nhưng Worker chỉ giữ lại 50KB đầu
 * Container exit 0 (chạy xong), nhưng byte đếm trong script phải < 60000
 */
#include <stdio.h>
#include <string.h>

int main() {
    const char *spam = "AITA-SECURITY-TEST: LOG FLOODING ATTACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";
    long long bytes = 0;
    long long target = 10LL * 1024 * 1024; /* 10MB output — vượt xa ngưỡng 50KB */

    while (bytes < target) {
        int n = puts(spam);   /* puts = fputs + '\n' */
        if (n < 0) break;     /* stdout closed / pipe broken */
        bytes += strlen(spam);
    }
    /* exit 0: chương trình chạy xong bình thường, Worker phải tự cắt log */
    return 0;
}
