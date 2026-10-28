/* SEC-04: Network Isolation Breach Test
 * Thử mở socket TCP kết nối ra ngoài (8.8.8.8:53)
 * Kỳ vọng: ENETUNREACH (exit 1) vì --network none không có card mạng
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

int main() {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        printf("FAIL: Khong tao duoc socket (errno=%d: %s)\n", errno, strerror(errno));
        return 1;
    }

    struct sockaddr_in remote;
    memset(&remote, 0, sizeof(remote));
    remote.sin_family      = AF_INET;
    remote.sin_port        = htons(53);
    inet_pton(AF_INET, "8.8.8.8", &remote.sin_addr);

    int ret = connect(sock, (struct sockaddr*)&remote, sizeof(remote));
    if (ret < 0) {
        printf("BLOCKED: connect() that bai (errno=%d: %s) — mang bi co lap hoan toan\n",
               errno, strerror(errno));
        close(sock);
        return 1;   /* exit 1 → defense hoat dong */
    }

    /* Neu den duoc day tuc la container co mang — sandbox bi bypass! */
    printf("BYPASS: Ket noi thanh cong toi 8.8.8.8:53 — SECURITY BREACH!\n");
    close(sock);
    return 0;
}
