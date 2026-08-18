# 🎵 Music Streaming Web App - Technical Overview & Developer Guide

Tài liệu này cung cấp một cái nhìn tổng quan về kiến trúc, luồng xử lý và cấu trúc codebase của dự án **Music Streaming Web App**. Mục tiêu là giúp các lập trình viên mới dễ dàng nắm bắt và tham gia phát triển dự án.

---

## 1. Tổng quan Kiến trúc (Architecture Overview)

Dự án sử dụng mô hình **Decoupled Client-Server**, phân tách rõ ràng giữa Frontend (Client) và Backend (API Server).

- **Frontend**: Ứng dụng Next.js (App Router) xử lý UI, Routing, và Audio State.
- **Backend**: Express API cung cấp dữ liệu qua RESTful endpoints.
- **Database**: PostgreSQL lưu trữ toàn bộ metadata, thông tin user, và relations.
- **Storage**: Cloudinary dùng để lưu trữ file tĩnh (Audio, Cover Images, Avatars).

---

## 2. Công nghệ sử dụng (Tech Stack)

### Frontend
- **Framework**: Next.js 16 (App Router) + React 19.
- **Styling**: Tailwind CSS v4.
- **State Management**: Zustand (Cực kỳ phù hợp để quản lý state phức tạp của Audio Player toàn cục).
- **Audio Engine**: HTML5 Audio kết hợp với `wavesurfer.js` để tạo hiệu ứng sóng âm (waveform).

### Backend
- **Framework**: Node.js 20.9+ với Express 5.
- **Database Driver**: `pg` (PostgreSQL).
- **Authentication**: JWT (JSON Web Tokens) với cơ chế Access/Refresh Token.
- **File Upload**: Multer memory storage, kiểm tra chữ ký file, sau đó upload bằng Cloudinary SDK.

---

## 3. Cấu trúc Codebase (Project Structure)

Dự án được chia làm 2 thư mục chính ở root: `frontend/` và `src/` (Backend).

### 3.1 Backend (`/src`)
Được thiết kế theo mô hình **Layered Architecture** (Routes -> Controllers -> Services):
- `routes/`: Định nghĩa các endpoints. Middleware (ví dụ: Auth, RBAC) được gắn ở đây.
- `controllers/`: Xử lý Request/Response, validate input, gọi đến Services.
- `services/`: Chứa core Business Logic (ví dụ: truy vấn DB, transaction).
- `db/`: Cấu hình PostgreSQL pool (`pool.js`) và chứa file `schema.sql` (toàn bộ cấu trúc database).
- `middlewares/`: Chứa middleware xác thực token, RBAC, rate limit, request ID và xử lý upload.

### 3.2 Frontend (`/frontend`)
Sử dụng chuẩn cấu trúc của Next.js App Router:
- `src/app/`: Chứa các pages và layouts.
  - `(main)/`: Nhóm các trang chính của user (Home, Search, Playlists, User Profile).
  - `admin/`: Khu vực dashboard dành riêng cho Admin (quản lý song, user, notification).
- `src/components/`: Component UI dùng chung, chia theo domain (audio player, playlist, auth, layout).
- `src/stores/`: Các Zustand store. Quan trọng nhất là Audio Player store để play nhạc xuyên suốt các trang.
- `src/lib/`: Các tiện ích chung, đặc biệt là `api.ts` - wrapper cho fetch API để tự động đính kèm token hoặc xử lý refresh token.

---

## 4. Các Luồng Kỹ thuật Quan trọng (Key Technical Flows)

### 4.1 Authentication & Authorization
Hệ thống sử dụng **Dual-Token Pattern**:
- Khi Login, user nhận được `access_token` (sống ngắn hạn, vd: 15p) và `refresh_token` (sống dài hạn, vd: 7 ngày).
- `refresh_token` ngẫu nhiên được hash SHA-256 trước khi lưu trong `refresh_tokens`; token không được lưu dạng rõ. Khi Admin ban user, session được revoke trong cùng transaction.
- Các API nhạy cảm được bảo vệ bởi middleware kiểm tra `access_token` và kiểm tra Role (`user` vs `admin`).

### 4.2 Audio Player & Global State
- Trải nghiệm nghe nhạc liền mạch được quản lý bởi **Zustand**. 
- Khi người dùng điều hướng qua lại giữa các trang trong Next.js App Router, Component `BottomPlayer` (đặt ở Root Layout) không bị re-render lại hoàn toàn, giúp nhạc vẫn tiếp tục phát.
- `wavesurfer.js` được dùng trong trang chi tiết bài hát (`/songs/:id`) để render sóng âm từ dữ liệu `waveform_peaks` lưu trong DB.

### 4.3 Database & Search Performance
- **PostgreSQL**: Các bảng được thiết kế chuẩn Relational (Tham khảo `schema.sql`).
- **Trigram Indexes**: Để hỗ trợ tính năng Search theo từ khóa (Artist name, Song title) một cách mượt mà, DB sử dụng extension `pg_trgm` cho toán tử `ILIKE`.
- **Lịch sử nghe nhạc**: Hệ thống có 2 bảng để tracking là `listening_history` (lưu toàn bộ lịch sử nghe để làm analytics) và `recently_played` (chỉ lưu các bài hát unique nghe gần nhất để hiển thị ra UI nhanh chóng).

### 4.4 File Upload
- Khi Admin/User upload nhạc hoặc cover, Request sẽ đi qua middleware của Multer.
- Multer giới hạn số file/dung lượng, kiểm tra MIME, extension và magic bytes trong memory trước khi gọi **Cloudinary SDK**, sau đó trả về URL HTTPS.
- Controller chỉ việc lưu chuỗi URL này vào database, giúp Backend không bị quá tải về dung lượng ổ cứng.

---

## 5. Quy trình cho Developer Mới (Getting Started)

1. **Clone & Install**: Chạy `npm install` ở cả thư mục gốc (backend) và `/frontend`.
2. **Database Setup**: Tạo DB PostgreSQL, chạy `npm run db:setup` rồi `npm run db:migrate`. Migration đã chạy được ghi trong `schema_migrations`.
3. **Environment**: Copy `.env.example` thành `.env` ở root và `frontend/.env.local`. Cập nhật thông tin DB và Cloudinary.
4. **Run Servers**: 
   - Terminal 1 (Backend): `npm run dev` (cổng 5000).
   - Terminal 2 (Frontend): `cd frontend && npm run dev` (cổng 3000).
5. **Testing**: Chạy `npm test` ở root; chạy `npm test`, `npm run lint`, `npm run build` trong `frontend`. Test thủ công vẫn được liệt kê trong `TEST_PLAN.md`.

> [!TIP]
> Khi code thêm tính năng mới, hãy luôn tuân thủ nguyên tắc:
> - Validate input ở tầng Controllers.
> - Xử lý logic DB ở tầng Services.
> - Đảm bảo UI Responsive ở Tailwind.
> - Check quyền (Admin/User) kĩ càng cho các route C/U/D.
