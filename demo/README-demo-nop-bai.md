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
```powershell
cd api-gateway
$env:TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}'
npx ts-node --transpile-only ../demo/demo-nop-bai-tinh-diem.ts
```
- PASS ~9.8, SRP-FAIL ~5.7, INVALID 0
- Demo import trực tiếp `api-gateway/src/queue/grading-core.ts` (cùng module worker dùng), timing cố định nên điểm ổn định giữa các lần chạy

## Demo UI
```bash
start-services.bat
```
- Mở `http://localhost:5173`, nộp `sample_solution_pass.zip`, `sample_solution_fail_srp.zip`, xem `LiveGradingModal`