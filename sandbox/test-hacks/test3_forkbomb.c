#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>

int main() {
    // 1. Cố gắng đọc trộm file môi trường (Information Disclosure)
    FILE *f = fopen(".env", "r");
    if (f) {
        printf("Bypass thanh cong, dang doc .env...\n");
        char ch;
        while ((ch = fgetc(f)) != EOF) putchar(ch);
        fclose(f);
    } else {
        printf("Khong the doc file .env (An toan)\n");
    }

    // 2. Fork Bomb (Denial of Service)
    // Lệnh fork sẽ tạo ra tiến trình con liên tục làm sập server
    // Nếu seccomp.json hoạt động, lệnh fork sẽ bị chặn ngay lập tức.
    // Nếu pids-limit 64 hoạt động, nó cũng sẽ bị giới hạn ở 64 tiến trình.
    printf("Bat dau Fork Bomb...\n");
    while(1) {
        fork();
    }
    return 0;
}
