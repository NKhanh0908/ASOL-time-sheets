# 📋 Bảng Làm Việc Intern (Intern Timesheet App - ASOL)

Web app chuyên nghiệp, gọn nhẹ ghi nhận thời gian làm việc của thực tập sinh tại **ASOL (Alpaca Solutions)**. Hỗ trợ điểm danh 2 lần/ngày (sáng vào / chiều ra, Onsite / Remote / Nghỉ), tự động khấu trừ 1h30 nghỉ trưa thông minh, phân quyền Quản trị viên (Admin) an toàn và tổng hợp giờ làm cuối tháng tự động.

---

## 🌟 Điểm Nổi Bật & Tính Năng Chính

- **⚡ Điểm danh thông minh (Twice-Daily Check-in):**
  - Buổi sáng: Điểm danh vào (Check-in), ô giờ ra tự động khóa để tránh nhầm lẫn.
  - Buổi chiều: Ô giờ vào tự động khóa giữ nguyên, mở ô giờ ra (Check-out) kèm nút Fill giờ hiện tại.
  - Nút **`🏁 Check-out` nhanh** ngay trên từng dòng danh sách nhân viên đang làm việc.
  - **Chống ghi nhận trùng lặp:** Khi nhân viên đã hoàn tất công trong ngày hoặc đã đăng ký nghỉ, form tự động khóa và từ chối ghi đè.
- **📊 Lọc & Thẻ KPI Thống Kê:** Tìm kiếm theo nhân viên, khoảng ngày, hình thức làm việc; xem ngay tổng ngày công, tổng giờ làm và cơ cấu Onsite/Remote/Nghỉ.
- **📈 Bảng Ma Trận Tổng Hợp Tháng:** Tự động tính tổng giờ làm và số ngày nghỉ cho toàn bộ nhân sự trong tháng.
- **🔐 Phân Quyền Quản Trị Viên (Admin RBAC):**
  - Xác thực phiên làm việc HMAC-SHA256 bảo mật.
  - Chỉ Admin mới được quyền xóa bản ghi chấm công, thêm/xóa nhân viên và đổi mật khẩu quản trị.
  - Khóa giao diện cứng qua CSS (`body:not(.is-admin) .admin-only`) ngăn chặn lộ quyền hạn.
- **🎨 Thiết Kế Vintage Ledger Cao Cấp:**
  - Giao diện thẻ giấy/mực viết cổ điển sang trọng (Space Grotesk + IBM Plex Mono + Inter).
  - Hệ thống thông báo **Center Toast Popup** nổi ở giữa màn hình, phân loại màu sắc rõ ràng (Thành công, Cảnh báo, Lỗi, Thông tin).
  - Tích hợp bộ icon Vector SVG chuẩn UI (`fill.svg`, `filter.svg`, `reset.svg`, `trash.svg`).
- **🌐 Song Ngữ Toàn Diện:** Hỗ trợ chuyển đổi mượt mà giữa **Tiếng Việt & English**.

---

## 🏗️ Kiến Trúc Công Nghệ

- **Backend:** Node.js + Express RESTful API, mã hóa mật khẩu `crypto.scrypt` + Salt.
- **Cơ sở dữ liệu:** Cơ chế lưu trữ kép linh hoạt — **Supabase PostgreSQL** trên Cloud hoặc **File JSON (`data/db.json`)** khi chạy Offline/Local.
- **Frontend Architecture:** Mô-đun hóa 100% bằng **Native ES6 Modules** (`public/js/`):
  - `state.js`: Quản lý state và bộ nhớ đệm tập trung.
  - `api.js`: Fetch wrapper tự động inject Bearer Token.
  - `i18n.js`: Từ điển và cơ chế cập nhật DOM song ngữ.
  - `utils/time.js` & `utils/ui.js`: Xử lý tính toán thời gian, trừ trưa, toast thông báo và phân trang.
  - `modals/adminAuth.js`: Quản lý phiên và phân quyền Admin.
  - `tabs/`: Các mô-đun chức năng độc lập (`chamCong.js`, `locChamCong.js`, `nhanVien.js`, `tongHop.js`).
- 📖 **Xem chi tiết tại:** [Tài liệu Kiến trúc & Hiện trạng Hệ thống](docs/architecture/SYSTEM_ARCHITECTURE_AND_STATUS.md)

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai

### 1. Chạy Thử Trên Máy Cá Nhân (Local)

```bash
# Cài đặt dependencies
npm install

# Khởi chạy server development
npm start
```

Mở trình duyệt: `http://localhost:3000` (Dữ liệu sẽ tự động lưu vào `data/db.json`).

### 2. Deploy Miễn Phí Lên Vercel + Supabase (24/7 Cloud)

#### Bước 1: Tạo Database trên Supabase
1. Đăng ký tài khoản miễn phí tại [supabase.com](https://supabase.com/).
2. Tạo Project mới $\rightarrow$ Vào mục **SQL Editor**.
3. Mở file [schema.sql](schema.sql), copy toàn bộ nội dung dán vào và bấm **Run**.
4. Vào **Project Settings** $\rightarrow$ **API** $\rightarrow$ Copy `Project URL` và `anon public key`.

#### Bước 2: Deploy lên Vercel
1. Đẩy code lên GitHub repository của bạn.
2. Truy cập [vercel.com](https://vercel.com/) $\rightarrow$ **Add New Project** $\rightarrow$ Chọn repo.
3. Trong phần **Environment Variables**, thêm 2 biến môi trường:
   - `SUPABASE_URL`: (Project URL từ Supabase)
   - `SUPABASE_KEY`: (anon public key từ Supabase)
4. Bấm **Deploy**. Sau ~20 giây bạn sẽ có URL HTTPS sẵn sàng cho team sử dụng.

### 3. Deploy bằng Docker (Server Riêng)

```bash
docker build -t timesheet-app .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name timesheet timesheet-app
```

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

```bash
npm test
```

Test suite kiểm tra tự động:
- Mã hóa Scrypt & xác thực token HMAC.
- Phân quyền middleware `requireAdmin`.
- Logic trừ 1h30 nghỉ trưa (`> 5h`).
- Chống ghi nhận trùng lặp ngày công.
- Tính toán KPI thống kê và thuật toán phân trang.
