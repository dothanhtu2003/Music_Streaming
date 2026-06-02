# Music Streaming Web App - Test Plan

## 1. Thong tin chung

- Project: Music Streaming Web App
- Scope: Manual test cho backend API va frontend UI
- Test environment:
  - Backend: `http://localhost:5000/api`
  - Frontend: `http://localhost:3000`
  - Database: PostgreSQL `music_streaming`
- Status mac dinh: `Chua chay`
- Priority:
  - `P1`: Chuc nang quan trong, anh huong truc tiep den luong chinh
  - `P2`: Chuc nang quan trong nhung co the test sau P1
  - `P3`: Chuc nang bo sung, UI/UX hoac edge case

## 2. Test Data De Xuat

- User thuong: `user@example.com` / `123456`
- Admin: `admin@example.com` / `123456`
- Bai hat mau: `Demo Song`
- Artist mau: `Demo Artist`
- Genre mau: `Pop`
- File audio hop le: file `.mp3` nho hon 20MB
- File cover hop le: file `.jpg`, `.png` hoac `.webp` nho hon 5MB

## 3. Test Cases

### 3.1 Auth

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-001 | Dang ky tai khoan thanh cong | 1. Mo trang Register hoac goi `POST /auth/register`<br>2. Nhap email, username, password hop le<br>3. Submit | `email=user_new@example.com`, `username=usernew`, `password=123456` | Tao user moi thanh cong, response co thong tin user, khong tra ve password | P1 | Chua chay |
| AUTH-002 | Dang ky voi email da ton tai | 1. Dang ky bang email da co trong database<br>2. Submit | `email=user@example.com` | He thong tra ve loi validation/duplicate, khong tao them user | P1 | Chua chay |
| AUTH-003 | Dang nhap thanh cong | 1. Mo trang Login hoac goi `POST /auth/login`<br>2. Nhap dung email va password<br>3. Submit | `email=user@example.com`, `password=123456` | Dang nhap thanh cong, response co `accessToken`, `refreshToken`, thong tin user | P1 | Chua chay |
| AUTH-004 | Dang nhap sai mat khau | 1. Mo trang Login hoac goi `POST /auth/login`<br>2. Nhap email dung, password sai<br>3. Submit | `email=user@example.com`, `password=wrongpass` | He thong bao loi dang nhap, khong cap token | P1 | Chua chay |
| AUTH-005 | Lay thong tin user hien tai | 1. Dang nhap lay access token<br>2. Goi `GET /auth/me` voi header Authorization | `Authorization: Bearer valid_access_token` | Tra ve thong tin user dang dang nhap | P2 | Chua chay |
| AUTH-006 | Refresh token khong hop le | 1. Goi `POST /auth/refresh`<br>2. Gui refresh token sai hoac da logout | `refreshToken=invalid_token` | He thong tra ve loi token khong hop le/het han | P2 | Chua chay |

### 3.2 Song API

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SONG-001 | Lay danh sach bai hat | 1. Goi `GET /songs?page=1&limit=10` | `page=1`, `limit=10` | Tra ve danh sach bai hat dang active va thong tin phan trang | P1 | Chua chay |
| SONG-002 | Lay chi tiet bai hat | 1. Chon mot song id hop le<br>2. Goi `GET /songs/:id` | `id=song_uuid` | Tra ve chi tiet bai hat kem artist, album, genre neu co | P1 | Chua chay |
| SONG-003 | Lay bai hat voi id khong ton tai | 1. Goi `GET /songs/:id` voi UUID khong ton tai | `id=not_found_uuid` | Tra ve loi khong tim thay bai hat | P2 | Chua chay |
| SONG-004 | Admin tao bai hat thanh cong | 1. Dang nhap admin<br>2. Goi `POST /songs` voi du lieu hop le | `title`, `artist_id`, `file_url`, `duration_sec` | Tao bai hat thanh cong, response tra ve bai hat moi | P1 | Chua chay |
| SONG-005 | User thuong tao bai hat | 1. Dang nhap user thuong<br>2. Goi `POST /songs` | Du lieu bai hat hop le | He thong tra ve `403 Forbidden`, khong tao bai hat | P1 | Chua chay |
| SONG-006 | Admin xoa bai hat | 1. Dang nhap admin<br>2. Goi `DELETE /songs/:id` | `id=song_uuid` | Bai hat bi soft delete voi `is_active=false`, khong hien trong danh sach public | P2 | Chua chay |

### 3.3 Upload

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UPLOAD-001 | Admin upload audio hop le | 1. Dang nhap admin<br>2. Goi `POST /upload/audio` dang `multipart/form-data`<br>3. Chon file MP3 hop le | Key `file`, file `.mp3` nho hon 20MB | Upload thanh cong, response co `url`, file duoc luu trong `uploads/audio` | P1 | Chua chay |
| UPLOAD-002 | Admin upload cover hop le | 1. Dang nhap admin<br>2. Goi `POST /upload/cover`<br>3. Chon anh hop le | Key `file`, file `.jpg/.png/.webp` nho hon 5MB | Upload thanh cong, response co `url`, file duoc luu trong `uploads/covers` | P1 | Chua chay |
| UPLOAD-003 | Upload audio sai dinh dang | 1. Dang nhap admin<br>2. Goi `POST /upload/audio`<br>3. Chon file khong phai MP3 | File `.txt` hoac audio sai content | He thong tra ve loi file khong hop le, khong luu file | P1 | Chua chay |
| UPLOAD-004 | User thuong upload file | 1. Dang nhap user thuong<br>2. Goi `POST /upload/audio` hoac `/upload/cover` | File hop le | He thong tra ve `403 Forbidden` | P1 | Chua chay |
| UPLOAD-005 | Upload file vuot dung luong | 1. Dang nhap admin<br>2. Upload MP3 > 20MB hoac cover > 5MB | File vuot limit | He thong tra ve loi dung luong, khong luu file | P2 | Chua chay |

### 3.4 Search

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SEARCH-001 | Tim bai hat theo keyword co ket qua | 1. Mo trang Search hoac goi `GET /songs/search`<br>2. Nhap keyword ton tai | `q=demo` | Tra ve danh sach bai hat phu hop voi keyword | P1 | Chua chay |
| SEARCH-002 | Tim bai hat khong co ket qua | 1. Mo trang Search<br>2. Nhap keyword khong ton tai | `q=zzzz-not-found` | Hien thi danh sach rong hoac thong bao khong co ket qua | P2 | Chua chay |
| SEARCH-003 | Search voi keyword rong | 1. Goi `GET /songs/search?q=` hoac submit o tim kiem rong | `q=` | He thong validate input hoac tra ket qua rong theo thiet ke, khong bi crash | P2 | Chua chay |
| SEARCH-004 | Search co phan trang | 1. Goi `GET /songs/search?q=demo&page=1&limit=5`<br>2. Chuyen trang neu co | `q=demo`, `page=1`, `limit=5` | Tra ve dung so luong item theo limit va thong tin pagination | P3 | Chua chay |

### 3.5 Like

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| LIKE-001 | Like bai hat thanh cong | 1. Dang nhap user<br>2. Goi `POST /likes/` hoac bam nut Like tren UI | `songId=song_uuid` | Bai hat duoc them vao danh sach da thich, response `liked=true` | P1 | Chua chay |
| LIKE-002 | Like lai bai hat da thich | 1. Dang nhap user<br>2. Like cung mot bai hat lan thu hai | `songId=song_uuid` | He thong khong tao duplicate, tra ve success voi trang thai da like | P2 | Chua chay |
| LIKE-003 | Unlike bai hat thanh cong | 1. Dang nhap user<br>2. Goi `DELETE /likes/` hoac bam Unlike | `songId=song_uuid` | Bai hat bi xoa khoi danh sach da thich | P1 | Chua chay |
| LIKE-004 | Guest like bai hat | 1. Khong dang nhap<br>2. Goi `POST /likes/` hoac bam Like | Khong co access token | He thong yeu cau dang nhap hoac tra ve `401 Unauthorized` | P1 | Chua chay |
| LIKE-005 | Xem danh sach bai hat da thich | 1. Dang nhap user<br>2. Mo trang Liked hoac goi `GET /likes/me` | `page=1`, `limit=10` | Tra ve danh sach bai hat user da like | P2 | Chua chay |

### 3.6 Playlist

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PLAYLIST-001 | Tao playlist thanh cong | 1. Dang nhap user<br>2. Goi `POST /playlists` hoac tao tren UI | `name=My Favorite Songs`, `is_public=false` | Tao playlist thanh cong, playlist thuoc user hien tai | P1 | Chua chay |
| PLAYLIST-002 | Tao playlist voi ten rong | 1. Dang nhap user<br>2. Goi `POST /playlists` voi name rong | `name=""` | He thong tra ve loi validation, khong tao playlist | P1 | Chua chay |
| PLAYLIST-003 | Them bai hat vao playlist | 1. Dang nhap user<br>2. Tao playlist<br>3. Goi `POST /playlists/:id/songs` | `songId=song_uuid` | Bai hat duoc them vao playlist dung vi tri | P1 | Chua chay |
| PLAYLIST-004 | Them trung bai hat vao playlist | 1. Dang nhap user<br>2. Them cung mot bai hat vao playlist da co bai do | `songId=song_uuid` | He thong khong tao duplicate, tra ve trang thai da ton tai | P2 | Chua chay |
| PLAYLIST-005 | User khac sua playlist private | 1. User A tao playlist private<br>2. User B dang nhap<br>3. User B goi `PUT /playlists/:id` | `id=playlist_private_uuid` | He thong tra ve loi khong co quyen, playlist khong thay doi | P1 | Chua chay |
| PLAYLIST-006 | Sap xep lai bai hat trong playlist | 1. Dang nhap owner<br>2. Playlist co it nhat 2 bai hat<br>3. Goi `PATCH /playlists/:id/songs/reorder` | Danh sach `{ songId, position }` | Thu tu bai hat trong playlist duoc cap nhat dung | P2 | Chua chay |

### 3.7 Listening History

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| HISTORY-001 | Logged-in user nghe bai hat | 1. Dang nhap user<br>2. Goi `POST /songs/:id/listen` hoac bam Play | `id=song_uuid`, co access token | `play_count` tang, lich su nghe duoc luu cho user | P1 | Chua chay |
| HISTORY-002 | Guest nghe bai hat | 1. Khong dang nhap<br>2. Goi `POST /songs/:id/listen` hoac bam Play | `id=song_uuid`, khong co token | `play_count` tang, khong tao listening history | P1 | Chua chay |
| HISTORY-003 | Xem lich su nghe | 1. Dang nhap user da nghe bai hat<br>2. Goi `GET /history/me` | `page=1`, `limit=10` | Tra ve danh sach bai hat da nghe gan nhat cua user | P2 | Chua chay |
| HISTORY-004 | Xoa lich su nghe | 1. Dang nhap user<br>2. Goi `DELETE /history/me`<br>3. Goi lai `GET /history/me` | Access token hop le | Lich su nghe cua user bi xoa, danh sach rong | P2 | Chua chay |
| HISTORY-005 | Xem lich su khi chua dang nhap | 1. Khong dang nhap<br>2. Goi `GET /history/me` | Khong co access token | He thong tra ve `401 Unauthorized` | P1 | Chua chay |

### 3.8 Admin Dashboard

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ADMIN-001 | Admin xem dashboard | 1. Dang nhap admin<br>2. Mo `/admin` hoac goi `GET /admin/dashboard` | Access token admin | Hien thi tong users, songs, artists, albums, genres, play count, top songs, newest users | P1 | Chua chay |
| ADMIN-002 | User thuong truy cap dashboard | 1. Dang nhap user thuong<br>2. Mo `/admin` hoac goi `GET /admin/dashboard` | Access token user | He thong chan truy cap, tra ve `403 Forbidden` hoac redirect ve trang phu hop | P1 | Chua chay |
| ADMIN-003 | Admin xem danh sach users | 1. Dang nhap admin<br>2. Goi `GET /admin/users?page=1&limit=10` | Access token admin | Tra ve danh sach users, khong tra ve `password_hash` | P1 | Chua chay |
| ADMIN-004 | Admin loc user theo role | 1. Dang nhap admin<br>2. Goi `GET /admin/users?role=user` | `role=user` | Tra ve danh sach user dung role va pagination | P2 | Chua chay |
| ADMIN-005 | Admin ban user | 1. Dang nhap admin<br>2. Goi `PATCH /admin/users/:id/ban` | `id=user_uuid` | User bi ban, refresh token cua user bi thu hoi | P1 | Chua chay |
| ADMIN-006 | Admin tu ban chinh minh | 1. Dang nhap admin<br>2. Goi `PATCH /admin/users/:ownId/ban` | `id=own_admin_uuid` | He thong tra ve loi, admin khong the ban chinh minh | P1 | Chua chay |

### 3.9 Role Permission

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ROLE-001 | Guest truy cap API can login | 1. Khong dang nhap<br>2. Goi `GET /likes/me` hoac `GET /playlists/me` | Khong co Authorization header | He thong tra ve `401 Unauthorized` | P1 | Chua chay |
| ROLE-002 | User thuong truy cap API admin | 1. Dang nhap user thuong<br>2. Goi `GET /admin/users` | Access token user | He thong tra ve `403 Forbidden` | P1 | Chua chay |
| ROLE-003 | Admin truy cap API admin | 1. Dang nhap admin<br>2. Goi `GET /admin/users` | Access token admin | Request thanh cong, tra ve danh sach users | P1 | Chua chay |
| ROLE-004 | Token het han hoac sai dinh dang | 1. Goi API can auth<br>2. Gui token sai hoac het han | `Authorization: Bearer invalid_token` | He thong tra ve loi token khong hop le/het han | P1 | Chua chay |
| ROLE-005 | User bi ban dang nhap hoac goi API | 1. Admin ban user<br>2. User bi ban goi API can auth | Access token cua user bi ban | He thong tra ve `403`, user khong tiep tuc su dung duoc API bao ve | P1 | Chua chay |

### 3.10 Audio Player

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PLAYER-001 | Phat bai hat thanh cong | 1. Mo trang danh sach bai hat<br>2. Bam Play tren bai hat co `file_url` hop le | Bai hat co audio URL hop le | Bottom player hien ten bai hat, artist, thoi luong; audio bat dau phat | P1 | Chua chay |
| PLAYER-002 | Pause va resume bai hat | 1. Dang phat bai hat<br>2. Bam Pause<br>3. Bam Play lai | N/A | Audio tam dung, sau do tiep tuc phat tu vi tri hien tai | P1 | Chua chay |
| PLAYER-003 | Seek bai hat | 1. Dang phat bai hat<br>2. Keo thanh progress den vi tri moi | Vi tri seek hop le | Audio nhay den dung vi tri, current time cap nhat | P2 | Chua chay |
| PLAYER-004 | Dieu chinh volume | 1. Dang phat bai hat<br>2. Keo thanh volume | Gia tri 0 den 1 | Am luong thay doi tuong ung, UI khong loi | P2 | Chua chay |
| PLAYER-005 | Audio URL loi | 1. Chon bai hat co `file_url` sai hoac file khong ton tai<br>2. Bam Play | URL khong ton tai | Player hien thong bao loi, UI khong crash | P1 | Chua chay |
| PLAYER-006 | Next/Previous, Repeat, Shuffle | 1. Phat danh sach co nhieu bai<br>2. Bam Next/Previous<br>3. Bat Repeat hoac Shuffle | Danh sach bai hat | Player chuyen bai dung logic, toggle hien trang thai active | P3 | Chua chay |

### 3.11 Responsive UI

| Test case ID | Test case name | Steps | Input | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UI-001 | Home page tren desktop | 1. Mo frontend tren man hinh desktop 1366px<br>2. Kiem tra layout sidebar, topbar, danh sach bai hat, bottom player | Viewport 1366x768 | Layout hien thi dung, khong overlap, text khong bi cat bat thuong | P1 | Chua chay |
| UI-002 | Home page tren mobile | 1. Mo frontend tren viewport 390px<br>2. Kiem tra menu, list song, bottom player | Viewport 390x844 | UI responsive, co the scroll, nut bam khong bi che, player khong che noi dung quan trong | P1 | Chua chay |
| UI-003 | Login/Register tren mobile | 1. Mo `/login` va `/register` tren mobile<br>2. Nhap du lieu vao form | Viewport 390x844 | Form vua man hinh, input/button de thao tac, thong bao loi hien ro | P1 | Chua chay |
| UI-004 | Admin dashboard tren tablet/desktop | 1. Dang nhap admin<br>2. Mo `/admin` tren viewport 768px va 1366px | Viewport 768x1024, 1366x768 | Bang/table/stat card hien thi de doc, khong tran layout | P2 | Chua chay |
| UI-005 | Search va playlist tren mobile | 1. Mo `/search` va `/playlists` tren mobile<br>2. Tim kiem, scroll danh sach, mo chi tiet playlist | Viewport 390x844 | Cac control van su dung duoc, card/list khong vo layout | P2 | Chua chay |
| UI-006 | Bottom player khong che nut chinh | 1. Chon bai hat bat ky<br>2. Kiem tra cac trang co bottom player | Desktop va mobile | Noi dung co padding/spacing phu hop, bottom player khong che nut quan trong | P2 | Chua chay |

## 4. Cach Chay Project De Test

### Backend

```bash
npm install
psql -U postgres -d music_streaming -f src/db/schema.sql
npm run dev
```

Backend chay tai:

```text
http://localhost:5000/api
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chay tai:

```text
http://localhost:3000
```

## 5. Cach Test

- Test API bang Postman hoac Thunder Client theo endpoint trong tung test case.
- Test UI bang trinh duyet tai `http://localhost:3000`.
- Test responsive bang Chrome DevTools voi cac viewport: desktop `1366x768`, tablet `768x1024`, mobile `390x844`.
- Sau khi test, cap nhat cot `Status` thanh `Pass`, `Fail` hoac `Blocked`.
