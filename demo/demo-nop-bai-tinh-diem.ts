/**
 * Demo nop bai + co che tinh diem
 * Nguon: api-gateway/src/submissions/submissions.service.ts
 *        api-gateway/src/queue/grading-worker.consumer.ts
 */

// 1. Mo phong validate nop bai
export interface MockFile {
  originalname: string;
  size: number;
}

export function validateSubmission(file: MockFile, language: string, allowed: string[]): string {
  if (!file.originalname.toLowerCase().endsWith('.zip')) return 'Chi chap nhan .zip';
  if (file.size > 10 * 1024 * 1024) return 'Vuot qua 10MB';
  if (!allowed.map((l) => l.toLowerCase()).includes(language.toLowerCase()))
    return `Ngon ngu ${language} khong duoc phep (${allowed.join(', ')})`;
  return 'OK';
}

// 2. Cong thuc tinh diem giu nguyen logic worker
export function calcScore(tc1: boolean, tc2: boolean, clean: number, solidAvg: number): number {
  const s = (tc1 ? 4 : 0) + (tc2 ? 3 : 0) + (clean / 10) * 2 + (solidAvg / 10) * 1;
  return Math.min(10, Math.round(s * 10) / 10);
}

function demo() {
  console.log('Validate:', validateSubmission({ originalname: 'bai.zip', size: 1024 }, 'java', ['java']));
  console.log('PASS:', calcScore(true, true, 9.5, 8.8)); // ~9.7
  console.log('SRP-FAIL:', calcScore(true, false, 7.0, 8.0)); // ~6.2
  console.log('INVALID:', 0);
}

demo();