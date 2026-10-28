# 🚀 HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG AITA-INTELLIGENT LÊN MÔI TRƯỜNG CLOUD

> **Dành cho Thành viên 1:** Team Leader, DevOps & Triển khai Cloud (SWP391 - Group 4)  
> **Mục tiêu:** Đưa hệ thống lên môi trường trực tuyến (Live Production) phục vụ demo trước Hội đồng bảo vệ đồ án và đáp ứng tiêu chuẩn Milestone 3 (RBL Syllabus Tuần 8 - 10).

---

## 📑 MỤC LỤC

1. [Tổng quan kiến trúc triển khai Cloud](#1-tổng-quan-kiến-trúc-triển-khai-cloud)
2. [Triển khai Frontend lên Vercel](#2-triển-khai-frontend-react--vite-lên-vercel)
3. [Triển khai Cơ sở dữ liệu Cloud](#3-triển-khai-cơ-sở-dữ-liệu-cloud-postgresql--redis)
4. [Triển khai Backend API Gateway & GenAI Hub lên Render / Railway](#4-triển-khai-backend-api-gateway--genai-hub-lên-render--railway)
5. [Quy trình chạy Database Migrations & Seed trên Cloud](#5-quy-trình-chạy-database-migrations--seed-trên-cloud)
6. [Kịch bản đo tải Stress Test & SLA Benchmark](#6-kịch-bản-đo-tải-stress-test--sla-benchmark)

---

## 1. TỔNG QUAN KIẾN TRÚC TRIỂN KHAI CLOUD

```text
                   ┌───────────────────────────────────┐
                   │        Người dùng (Trình duyệt)   │
                   └─────────────────┬─────────────────┘
                                     │ HTTPS
                                     ▼
                   ┌───────────────────────────────────┐
                   │    Vercel (React Frontend App)    │
                   │    https://aita-group4.vercel.app  │
                   └─────────────────┬─────────────────┘
                                     │ REST API & WebSocket (WSS)
                                     ▼
                   ┌───────────────────────────────────┐
                   │   Render / Railway (API Gateway)  │
                   │   https://api.aita.onrender.com   │
                   └───────┬───────────────────┬───────┘
                           │                   │
             Internal HTTP │                   │ BullMQ Queue
                           ▼                   ▼
          ┌──────────────────────────┐   ┌──────────────────────────┐
          │  GenAI Hub (Port 3001)   │   │   Upstash / Redis Cloud  │
          │  (Google Gemini API)     │   │   rediss://default:...   │
          └──────────────────────────┘   └──────────────────────────┘
                           │
                           ▼
          ┌──────────────────────────────────────────┐
          │   Supabase / Neon (PostgreSQL 15 Cloud)  │
          │   13 Bảng chuẩn 3NF (IEEE SRS Entity)    │
          └──────────────────────────────────────────┘
```

---

## 2. TRIỂN KHAI FRONTEND (REACT + VITE) LÊN VERCEL

### Bước 2.1: Chuẩn bị mã nguồn

Dự án đã có sẵn file cấu hình [`frontend/vercel.json`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/vercel.json) với định tuyến SPA (Single Page Application rewrite về `/index.html`) và bảo mật headers.

### Bước 2.2: Các bước triển khai qua giao diện Vercel

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com) bằng tài khoản GitHub của nhóm.
2. Bấm **"Add New..."** $\to$ **"Project"** $\to$ Chọn repository `SWP391-Group4`.
3. Tại phần **Configure Project**:
   * **Framework Preset:** `Vite`
   * **Root Directory:** Bấm *Edit* và chọn thư mục `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Cấu hình biến môi trường (**Environment Variables**):
   * `VITE_API_URL`: Điền URL của API Gateway sau khi deploy (ví dụ: `https://aita-api.onrender.com` hoặc để trống nếu chạy local).
5. Bấm **Deploy**. Vercel sẽ tự động build và cấp domain dạng: `https://aita-group4.vercel.app`.

---

## 3. TRIỂN KHAI CƠ SỞ DỮ LIỆU CLOUD (POSTGRESQL & REDIS)

### Cách A: Dùng Supabase (Khuyên dùng - Miễn phí 100%, PostgreSQL 15 chuẩn)

1. Truy cập [Supabase](https://supabase.com) $\to$ **New Project**.
2. Đặt tên: `aita-autograding`, mật khẩu database mạnh (lưu lại mật khẩu).
3. Khu vực (Region): Chọn `Singapore (ap-southeast-1)` để có độ trễ thấp nhất về Việt Nam (< 50ms).
4. Vào mục **Project Settings** $\to$ **Database** $\to$ sao chép chuỗi `Connection string (URI)`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres?sslmode=require
```

### Cách B: Dùng Upstash Redis (Miễn phí, tối ưu cho BullMQ)

1. Truy cập [Upstash](https://upstash.com) $\to$ **Create Database**.
2. Chọn loại: `Redis`, Region: `ap-southeast-1 (Singapore)`.
3. Sao chép URL kết nối `rediss://default:...` hoặc Host, Port, Password.

---

## 4. TRIỂN KHAI BACKEND API GATEWAY & GENAI HUB LÊN RENDER / RAILWAY

### Cách 1: Triển khai tự động bằng file Blueprint `render.yaml`

Dự án đã tạo sẵn file [`render.yaml`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/render.yaml) ở thư mục gốc:

1. Đăng nhập [Render Dashboard](https://render.com).
2. Bấm **Blueprints** $\to$ **New Blueprint Instance**.
3. Chọn repo `SWP391-Group4`, Render sẽ tự động đọc `render.yaml` và dựng:
   * Dịch vụ Web `aita-api-gateway`
   * Dịch vụ Web `aita-genai-hub`
   * CSDL PostgreSQL và Redis tự động kết nối.

### Cách 2: Triển khai thủ công từng Web Service trên Render

* **Web Service 1: API Gateway**
  * Root Directory: `api-gateway`
  * Build Command: `npm install && npm run build`
  * Start Command: `npm run start:prod`
  * Environment Variables:
    * `PORT`: `3000`
    * `DATABASE_URL`: Chuỗi kết nối Supabase / Render Postgres
    * `DATABASE_SSL`: `true`
    * `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (từ Upstash hoặc Render Redis)
    * `GENAI_HUB_URL`: URL của GenAI Hub (ví dụ: `https://aita-genai.onrender.com`)

* **Web Service 2: GenAI Hub**
  * Root Directory: `genai-hub`
  * Build Command: `npm install && npm run build`
  * Start Command: `node dist/server.js`
  * Environment Variables:
    * `PORT`: `3001`
    * `GEMINI_API_KEY`: API Key của nhóm từ Google AI Studio.

---

## 5. QUY TRÌNH CHẠY DATABASE MIGRATIONS & SEED TRÊN CLOUD

Khi CSDL Supabase hoặc Render Postgres mới được tạo, cần khởi tạo 13 bảng 3NF và nạp dữ liệu mẫu:

Chạy lệnh trực tiếp từ máy tính cá nhân trỏ về Cloud:

```bash
# Di chuyển vào api-gateway
cd api-gateway

# Đặt biến môi trường tạm thời trỏ tới Cloud DB
set DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres?sslmode=require
set DATABASE_SSL=true

# Chạy Knex Migrations để tạo chuẩn 13 bảng
npm run db:migrate

# Nạp dữ liệu Master Demo Seed (khoảng 80 bài nộp mẫu, tài khoản giảng viên, sinh viên)
npm run db:seed
```

---

## 6. KỊCH BẢN ĐO TẢI STRESS TEST & SLA BENCHMARK

Để lấy số liệu thực nghiệm đưa vào Slide và Báo cáo Nghiên cứu IEEE:

1. Chạy kịch bản 100 requests đồng thời đo độ trễ p95:

```bash
python tools/stress-test-queue.py 100
```

1. Nếu muốn kiểm tra nhanh luồng xếp hàng (skip drain):

```bash
python tools/stress-test-queue.py 50 --quick
```

1. Số liệu mục tiêu cần đạt:
   * **Uncontended baseline SLA:** $< 200$ ms.
   * **Concurrent acceptance:** $100 / 100$ requests (HTTP 202 Accepted).
   * **Dead-letter queue (DLQ):** $0$ jobs thất thoát.
   * **Worker drain:** $100\%$ các bài nộp hoàn thành trạng thái `COMPLETED`.

---
*Tài liệu này là căn cứ vận hành chính thức của Nhóm 4 cho phần trình diễn DevOps trước Hội đồng bảo vệ.*
