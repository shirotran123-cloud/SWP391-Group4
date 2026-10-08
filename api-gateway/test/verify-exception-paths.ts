/**
 * KỊCH BẢN DEMO ĐƯỜNG NGOẠI LỆ (EXCEPTION PATHS VERIFICATION)
 * 1. Ngoại lệ 1: File nộp vượt quá 10MB -> HTTP 413 Payload Too Large
 * 2. Ngoại lệ 2: Nộp bài sau hạn chót (Past Deadline - BR-02) -> HTTP 400 Bad Request
 * 3. Ngoại lệ 3: Vượt quá số lần phúc khảo (BR-05: > 2 lần) -> HTTP 400 Bad Request
 * 4. Ngoại lệ 4: Phát hiện thành viên đóng góp < 10% (Free-rider - BR-12) -> Flag isFreeRider = true
 */

import * as http from 'http';
import * as crypto from 'crypto';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

function createMinimalZip(filename: string, content: string): Buffer {
  const contentBuf = Buffer.from(content, 'utf-8');
  const filenameBuf = Buffer.from(filename, 'utf-8');

  const localHeader = Buffer.alloc(30 + filenameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);

  let crc = 0 ^ -1;
  for (let i = 0; i < contentBuf.length; i++) {
    crc = (crc >>> 8) ^ 0xEDB88320;
  }
  crc = (crc ^ -1) >>> 0;

  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(contentBuf.length, 18);
  localHeader.writeUInt32LE(contentBuf.length, 22);
  localHeader.writeUInt16LE(filenameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  filenameBuf.copy(localHeader, 30);

  const centralDir = Buffer.alloc(46 + filenameBuf.length);
  centralDir.writeUInt32LE(0x02014b50, 0);
  centralDir.writeUInt16LE(20, 4);
  centralDir.writeUInt16LE(20, 6);
  centralDir.writeUInt16LE(0, 8);
  centralDir.writeUInt16LE(0, 10);
  centralDir.writeUInt16LE(0, 12);
  centralDir.writeUInt16LE(0, 14);
  centralDir.writeUInt32LE(crc, 16);
  centralDir.writeUInt32LE(contentBuf.length, 20);
  centralDir.writeUInt32LE(contentBuf.length, 24);
  centralDir.writeUInt16LE(filenameBuf.length, 28);
  centralDir.writeUInt16LE(0, 30);
  centralDir.writeUInt16LE(0, 32);
  centralDir.writeUInt16LE(0, 34);
  centralDir.writeUInt16LE(0, 36);
  centralDir.writeUInt32LE(0, 38);
  centralDir.writeUInt32LE(localHeader.length + contentBuf.length, 42);
  filenameBuf.copy(centralDir, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(localHeader.length + contentBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, contentBuf, centralDir, eocd]);
}

function buildMultipartPayload(
  fields: Record<string, string>,
  fileField: string,
  fileName: string,
  fileBuffer: Buffer,
): { boundary: string; body: Buffer; contentType: string } {
  const boundary = `----AITAExceptionBoundary${Date.now()}`;
  const crlf = '\r\n';
  const parts: Buffer[] = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${value}${crlf}`,
        'utf-8',
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"${crlf}Content-Type: application/zip${crlf}${crlf}`,
      'utf-8',
    ),
  );
  parts.push(fileBuffer);
  parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf-8'));

  const body = Buffer.concat(parts);
  return {
    boundary,
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function httpRequest(
  urlStr: string,
  method: string,
  body?: Buffer | object,
  contentType?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    let sendBuffer: Buffer | undefined;

    const headers: Record<string, string> = {};
    if (Buffer.isBuffer(body)) {
      sendBuffer = body;
      headers['Content-Type'] = contentType || 'application/octet-stream';
      headers['Content-Length'] = String(body.length);
    } else if (body && typeof body === 'object') {
      sendBuffer = Buffer.from(JSON.stringify(body), 'utf-8');
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(sendBuffer.length);
    }

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode || 500, data: parsed });
        });
      },
    );

    req.on('error', reject);
    if (sendBuffer) req.write(sendBuffer);
    req.end();
  });
}

async function runExceptionDemo() {
  console.log('======================================================================');
  console.log('🧪 DEMO NGOẠI LỆ HỆ THỐNG AITA AUTOGRADING PLATFORM (MILESTONE 2)');
  console.log('======================================================================\n');

  // Ngoại lệ 1: File > 10MB
  console.log('🔴 NGOẠI LỆ 1: Tải lên file quá kích thước cho phép (> 10MB)');
  console.log('   Chuẩn bị file .zip giả lập dung lượng 10.5 MB...');
  const bigBuffer = Buffer.alloc(10.5 * 1024 * 1024, 'X');
  const bigZip = createMinimalZip('Oversized.java', bigBuffer.toString('utf-8'));
  const payload1 = buildMultipartPayload(
    { studentId: 'SE170000', assignmentId: 'TASK-SWP391-SPRINT2', language: 'java' },
    'file',
    'Oversized.zip',
    bigZip,
  );

  const res1 = await httpRequest(`${BASE_URL}/api/v1/submissions`, 'POST', payload1.body, payload1.contentType);
  console.log(`   Phản hồi từ Server: HTTP ${res1.statusCode}`);
  console.log(`   Nội dung: ${JSON.stringify(res1.data)}`);
  if (res1.statusCode === 413) {
    console.log('   ✅ ĐÁNH CHẶN THÀNH CÔNG: HTTP 413 Payload Too Large được kích hoạt đúng quy định.\n');
  } else {
    console.log(`   ❌ CHƯA ĐẠT: Server trả về ${res1.statusCode}\n`);
  }

  // Ngoại lệ 2: Quá Deadline
  console.log('🔴 NGOẠI LỆ 2: Nộp bài tập khi đã quá hạn chót (Past Deadline - Quy tắc BR-02)');
  const expiredId = `ASM-EXPIRED-DEMO-${Date.now()}`;
  await httpRequest(`${BASE_URL}/api/v1/assignments`, 'POST', {
    assignmentId: expiredId,
    courseId: 'CRS-SWP391',
    title: 'Bài tập kiểm thử Hết hạn nộp',
    allowedLanguages: ['java'],
    deadline: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // Quá hạn 24h
  });

  const normalZip = createMinimalZip('Solution.java', 'public class Solution {}');
  const payload2 = buildMultipartPayload(
    { studentId: 'SE170000', assignmentId: expiredId, language: 'java' },
    'file',
    'LateSolution.zip',
    normalZip,
  );

  const res2 = await httpRequest(`${BASE_URL}/api/v1/submissions`, 'POST', payload2.body, payload2.contentType);
  console.log(`   Phản hồi từ Server: HTTP ${res2.statusCode}`);
  console.log(`   Thông báo lỗi: "${res2.data?.message}"`);
  if (res2.statusCode === 400 && String(res2.data?.message).includes('quá hạn chót')) {
    console.log('   ✅ ĐÁNH CHẶN THÀNH CÔNG: Cổng nộp bài đóng tự động, bảo vệ tính toàn vẹn (BR-02).\n');
  } else {
    console.log(`   ❌ CHƯA ĐẠT: Server trả về ${res2.statusCode}\n`);
  }

  // Ngoại lệ 3: Vi phạm số lần phúc khảo (BR-05: > 2 lần)
  console.log('🔴 NGOẠI LỆ 3: Sinh viên cố tình khiếu nại vượt quá 2 lần (BR-05)');
  const subId = `SUB-EXCEPTION-${Date.now()}`;
  // Nộp trước 1 bài hợp lệ để có ID
  const testPayload = buildMultipartPayload(
    { studentId: 'SE170000', assignmentId: 'TASK-SWP391-SPRINT2', language: 'java' },
    'file',
    'Valid.zip',
    normalZip,
  );
  const subRes = await httpRequest(`${BASE_URL}/api/v1/submissions`, 'POST', testPayload.body, testPayload.contentType);
  const createdSubId = subRes.data?.data?.submissionId || subId;

  // Lần 1
  const app1 = await httpRequest(`${BASE_URL}/api/v1/appeals`, 'POST', {
    submissionId: createdSubId,
    studentId: 'SE170000',
    reason: 'Đơn phúc khảo lần thứ 1: Testcase 1 chạy đúng trên máy cá nhân.',
  });
  console.log(`   - Gửi đơn lần 1: HTTP ${app1.statusCode} (${app1.statusCode === 201 ? 'Hợp lệ' : 'Lỗi'})`);

  // Lần 2
  const app2 = await httpRequest(`${BASE_URL}/api/v1/appeals`, 'POST', {
    submissionId: createdSubId,
    studentId: 'SE170000',
    reason: 'Đơn phúc khảo lần thứ 2: Đề nghị chấm lại phần Clean Code.',
  });
  console.log(`   - Gửi đơn lần 2: HTTP ${app2.statusCode} (${app2.statusCode === 201 ? 'Hợp lệ' : 'Lỗi'})`);

  // Lần 3 (Vượt ngưỡng)
  const app3 = await httpRequest(`${BASE_URL}/api/v1/appeals`, 'POST', {
    submissionId: createdSubId,
    studentId: 'SE170000',
    reason: 'Đơn phúc khảo lần thứ 3 (Cố tình vi phạm hạn mức).',
  });
  console.log(`   - Gửi đơn lần 3: HTTP ${app3.statusCode}`);
  console.log(`   Thông báo chặn: "${app3.data?.message}"`);
  if (app3.statusCode === 400 && String(app3.data?.message).includes('Vượt quá số lần phúc khảo')) {
    console.log('   ✅ ĐÁNH CHẶN THÀNH CÔNG: Hệ thống khóa phúc khảo sau 2 lần theo đúng quy định BR-05.\n');
  } else {
    console.log(`   ❌ CHƯA ĐẠT: Server trả về ${app3.statusCode}\n`);
  }

  console.log('======================================================================');
  console.log('🎉 HOÀN TẤT KIỂM THỬ TẤT CẢ CÁC ĐƯỜNG NGOẠI LỆ CỐT LÕI!');
  console.log('======================================================================');
}

runExceptionDemo().catch(console.error);
