#include <stdlib.h>
#include <stdio.h>
#include <string.h>

int main() {
    // Thử cấp phát bộ nhớ liên tục để test MLE (Memory Limit Exceeded)
    // Sandbox giới hạn 512MB, nên lệnh này sẽ bị OOM Killer dập tắt (exit code 137)
    long long total = 0;
    while (1) {
        void *ptr = malloc(1024 * 1024 * 10); // Xin 10MB mỗi vòng lặp
        if (ptr == NULL) break;
        memset(ptr, 1, 1024 * 1024 * 10); // Ghi dữ liệu để ép OS cấp phát RAM thật
        total += 10;
        printf("Đã cấp phát %lld MB\n", total);
    }
    return 0;
}
