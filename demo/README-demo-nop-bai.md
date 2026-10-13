# Demo nộp bài + tính điểm

## Luồng nộp bài
`api-gateway/src/submissions/submissions.service.ts`
- Validate `.zip`, <=10MB, đúng `allowedLanguages`, còn `deadline`
- Tính `SHA-256`, lưu `uploads/submissions`, đẩy BullMQ SLA <200ms
- Worker poll 250ms, retry 3 lần, lỗi -> DLQ

## Công thức điểm
`api-gateway/src/queue/grading-worker.consumer.ts`
- `score=(TC1?4:0)+(TC2?3:0)+(clean/10)*2+(solidAvg/10)*1`
- `TC2 pass = hasEfficientSort`, `TLE/MLE->TC2 FAILED`, `Segfault->TC1 FAILED`
- Zip rỗng -> `0/10 FAILED`

## Chạy demo
```bash
node --experimental-strip-types demo/demo-nop-bai-tinh-diem.ts
```
- PASS ~9.7, SRP-FAIL ~6.2, INVALID 0

## Demo UI
```bash
start-services.bat
```
- Mở `http://localhost:5173`, nộp `sample_solution_pass.zip`, `sample_solution_fail_srp.zip`, xem `LiveGradingModal`