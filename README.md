# Bảng Chấm Công Nội Bộ (Timesheet App)

Web app gọn nhẹ để cả team chấm công hằng ngày (sáng vào / chiều ra, onsite/remote/nghỉ), tự động trừ 1h30 nghỉ trưa thông minh và tự động tổng hợp giờ làm cuối tháng.

- **Backend:** Node.js + Express (Hỗ trợ **Supabase PostgreSQL** trên Cloud hoặc **File JSON** khi chạy Local).
- **Frontend:** HTML5, CSS3, Vanilla JS thuần (hỗ trợ Song ngữ **Tiếng Việt & Tiếng Anh**).
- **Hosting:** Tương thích 100% với **Vercel Serverless**, Docker, PM2 hoặc chạy trực tiếp.
- **CI/CD:** Tích hợp **GitHub Actions Workflow** tự động kiểm thử code khi push.

---

## 1. Chạy thử trên máy cá nhân (Local)

```bash
cd timesheet-app
npm install
npm start
```

Mở trình duyệt: `http://localhost:3000` (Mặc định dữ liệu sẽ tự lưu vào file `data/db.json` mà không cần cấu hình thêm).

---

## 2. Deploy lên Vercel + Supabase (Miễn phí, 24/7 không bao giờ ngủ)

### Bước 1: Tạo Database trên Supabase (2 phút)
1. Đăng ký tài khoản miễn phí tại [supabase.com](https://supabase.com/).
2. Tạo một Project mới.
3. Vào mục **SQL Editor** ở thanh menu bên trái $\rightarrow$ Mở file [schema.sql](schema.sql) trong repo, copy toàn bộ nội dung dán vào và bấm **Run**.
4. Vào **Project Settings** $\rightarrow$ **API** $\rightarrow$ Copy 2 giá trị:
   - `Project URL`
   - `anon public key` (hoặc `service_role secret key`)

### Bước 2: Deploy lên Vercel (1 phút)
1. Đẩy code lên GitHub repository của bạn.
2. Truy cập [vercel.com](https://vercel.com/) $\rightarrow$ Chọn **Add New Project** $\rightarrow$ Chọn repo vừa đẩy.
3. Trong phần **Environment Variables**, thêm 2 biến môi trường:
   - `SUPABASE_URL`: (Giá trị Project URL từ Supabase)
   - `SUPABASE_KEY`: (Giá trị anon/secret key từ Supabase)
4. Bấm **Deploy**. Sau ~20 giây, bạn sẽ có đường link HTTPS miễn phí (ví dụ: `https://timesheet-team.vercel.app`) để toàn bộ nhân viên truy cập.

---

## 3. Quản lý & Xuất dữ liệu báo cáo trên Supabase

- Mở Supabase Dashboard $\rightarrow$ **Table Editor** $\rightarrow$ Chọn bảng `entries`.
- Bạn có thể xem toàn bộ lịch sử chấm công, tìm kiếm theo ngày, sửa trực tiếp hoặc bấm **"Export to CSV"** để tải file Excel về tính lương cuối tháng.

---

## 4. Deploy bằng Docker (nếu dùng Server riêng)

```bash
docker build -t timesheet-app .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name timesheet timesheet-app
```

---

## 5. Chạy Kiểm Thử Tự Động (Tests)

```bash
npm test
```

Mỗi khi bạn `git push` lên GitHub, **GitHub Actions Workflow** sẽ tự động chạy toàn bộ các bài kiểm thử để đảm bảo hệ thống luôn ổn định.
