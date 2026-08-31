# 🏛️ TÀI LIỆU HIỆN TRẠNG TÍNH NĂNG & KIẾN TRÚC HỆ THỐNG
**Ứng dụng:** Bảng Làm Việc Intern (Intern Timesheet App - ASOL)  
**Phiên bản:** 2.0 (Frontend ES Modules & Enhanced Security)  
**Cập nhật lần cuối:** 31/08/2026

---

## 1. 📐 TỔNG QUAN KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Hệ thống được thiết kế theo mô hình **Client-Server kiến trúc mô-đun hóa cao**, hoạt động trơn tru ở cả môi trường Local (chạy file JSON offline) và Cloud (Supabase PostgreSQL + Vercel Serverless).

```
timesheet-app/
├── server.js                     # Backend Express REST API & Database Adapters
├── schema.sql                    # SQL Migration cho Supabase PostgreSQL
├── data/db.json                  # Local JSON Database (chạy offline)
├── test/                         # Bộ kiểm thử tự động (Unit, API, E2E)
│   ├── test_api.js               # Kiểm thử Auth, Validation & Duplicate Rejection
│   └── test_e2e_calc.js          # Kiểm thử tính toán giờ làm, trừ trưa, phân trang
├── public/                       # Frontend Static Web App
│   ├── index.html                # Single-Page UI Entry Point
│   ├── styles.css                # Vintage Ledger Design System (CSS Variables)
│   ├── assets/
│   │   ├── logo.png              # Brand Logo (Alpaca Solutions)
│   │   └── svg/                  # Bộ Vector Icons chuẩn UI
│   │       ├── fill.svg          # Nút fill giờ hiện tại
│   │       ├── filter.svg        # Nút lọc dữ liệu
│   │       ├── reset.svg         # Nút hoàn tác / đặt lại
│   │       └── trash.svg         # Nút xóa bản ghi
│   └── js/                       # Mô-đun ES Native (ES6 Modules)
│       ├── main.js               # Khởi tạo và điều phối ứng dụng
│       ├── state.js              # Quản lý State tập trung & Invalidate Cache
│       ├── api.js                # HTTP Client Fetch bọc Bearer Auth
│       ├── i18n.js               # Đa ngôn ngữ (Tiếng Việt / English)
│       ├── utils/
│       │   ├── time.js           # Tính toán giờ, trừ trưa, format thời gian
│       │   └── ui.js             # Center Toast Notification, Loading, Phân trang
│       ├── modals/
│       │   └── adminAuth.js      # Modal đăng nhập, đổi MK, phân quyền Admin
│       └── tabs/
│           ├── chamCong.js       # Tab Điểm danh / Chấm công ngày
│           ├── locChamCong.js    # Tab Lọc & Tìm kiếm nâng cao + KPI Cards
│           ├── nhanVien.js       # Tab Quản lý nhân viên (Admin Only)
│           └── tongHop.js        # Tab Bảng tổng hợp công tháng
└── docs/                         # Tài liệu thiết kế & Kiến trúc
```

---

## 2. 🧩 CHI TIẾT CÁC MÔ-ĐUN FRONTEND (`public/js/`)

| Mô-đun | Trách nhiệm chính |
|---|---|
| **`state.js`** | Lưu trữ trạng thái toàn cục (`isAdmin`, `adminToken`, `employees`, `entriesCache`, `pageSize`, `filterData`). Hỗ trợ invalidation bộ nhớ đệm theo từng tháng. |
| **`api.js`** | Bọc hàm `fetch()`, tự động đính kèm `Authorization: Bearer <token>` khi có phiên Admin, bắt lỗi tập trung. |
| **`i18n.js`** | Quản lý bộ từ điển Song ngữ VI / EN. Cung cấp hàm `t(key)` và `setLanguage(lang)` tự động quét cập nhật DOM `[data-i18n]` và `[data-i18n-ph]`. |
| **`utils/time.js`** | Chứa các hàm thuần túy (Pure functions): chuyển đổi giờ phút, format thập phân (e.g. `8.0h`), kiểm tra nhãn thứ trong tuần, và thuật toán khấu trừ 1h30 nghỉ trưa tự động khi làm việc trên 5 tiếng. |
| **`utils/ui.js`** | Hệ thống thông báo **Center Toast Popup** đồng bộ phong cách Vintage Ledger với 4 phân loại (`success`, `warning`, `error`, `info`), bộ điều khiển spinner nút bấm và phân trang thanh cuộn `renderPagination`. |
| **`modals/adminAuth.js`** | Kiểm soát modal đăng nhập/đổi MK Admin, tự động bật tắt class `body.is-admin`, tự động chuyển hướng an toàn về tab Chấm công khi đăng xuất. |
| **`tabs/chamCong.js`** | Xử lý logic điểm danh vào/ra, tự động điền giờ, khóa ô nhập thông minh, từ chối ghi nhận trùng lặp khi đã hoàn tất trong ngày. |
| **`tabs/locChamCong.js`** | Truy vấn bản ghi theo khoảng ngày, nhân viên, hình thức làm việc; tính toán 3 thẻ KPI tổng hợp (Tổng ngày, Tổng giờ, Tỷ lệ Onsite/Remote/Nghỉ); phân trang danh sách. |
| **`tabs/nhanVien.js`** | Quản lý danh sách nhân sự (Thêm mới, Xóa nhân viên kèm toàn bộ lịch sử công), phân quyền Admin. |
| **`tabs/tongHop.js`** | Tính toán ma trận tổng hợp công tháng cho toàn bộ nhân viên, xuất bảng tính trực quan. |
| **`main.js`** | Điểm khởi chạy (Entry Orchestrator), điều phối chuyển tab, gắn các callback re-render khi dữ liệu nhân viên/chấm công/ngôn ngữ thay đổi. |

---

## 3. ⚙️ KIẾN TRÚC BACKEND & BẢO MẬT (`server.js`)

### 3.1. Cơ chế Lưu Trữ Kép (Dual Database Adapter)
- **Supabase Cloud (PostgreSQL):** Tự động kích hoạt khi có biến môi trường `SUPABASE_URL` và `SUPABASE_KEY`. Sử dụng kết nối REST qua `@supabase/supabase-js`.
- **Local JSON Adapter (`data/db.json`):** Tự động kích hoạt khi chạy offline/local, không yêu cầu bất kỳ cài đặt cơ sở dữ liệu nào.

### 3.2. Bảo Mật & Xác Thực Admin
- **Mã hóa mật khẩu:** Sử dụng thuật toán chuẩn `crypto.scrypt` với muối ngẫu nhiên (Salt 16 bytes). Mật khẩu mặc định khởi tạo là `admin123`.
- **Phiên làm việc HMAC-SHA256:** Token Admin được tạo theo cấu trúc `timestamp.signature`, kiểm tra chữ ký bí mật từ máy chủ, tự động hết hạn sau 24 giờ.
- **Middleware `requireAdmin`:** Chặn tuyệt đối các hành động can thiệp dữ liệu nhạy cảm (Xóa bản ghi chấm công, Thêm/Xóa nhân viên, Đổi mật khẩu quản trị).

---

## 4. 📋 BẢNG TỔNG HỢP HIỆN TRẠNG TÍNH NĂNG (FEATURE MATRIX)

| Nhóm Tính Năng | Tính năng cụ thể | Trạng Thái | Ghi chú & Quy tắc xử lý |
|---|---|:---:|---|
| **Chấm Công Ngày** | Điểm danh Vào (Check-in sáng) | ✅ Hoàn thành | Ô check-in mở, ô check-out khóa. Hỗ trợ nút Fill giờ tức thì. |
| | Điểm danh Ra (Check-out chiều) | ✅ Hoàn thành | Khi đã có check-in sáng, ô vào bị khóa, ô ra mở sẵn để cập nhật. |
| | Quick Check-out từ danh sách | ✅ Hoàn thành | Nút `🏁 Check-out` nhanh ngay trên dòng trạng thái của nhân viên đang làm. |
| | Chống ghi nhận trùng lặp | ✅ Hoàn thành | Khi nhân viên đã có đủ `in + out` hoặc `Nghỉ`, form tự động khóa và từ chối ghi nhận tiếp. |
| | Đăng ký Nghỉ (Off) | ✅ Hoàn thành | Khóa cả 2 ô giờ, bắt buộc nhập lý do nghỉ vào ô ghi chú. |
| **Giao Diện Danh Sách**| Hiển thị 2 dòng theo Spec | ✅ Hoàn thành | Dòng 1: [Ngày] + Tên + Giờ + Badge + Tag. Dòng 2: Note in nghiêng sạch sẽ (không icon rườm rà). |
| | Bộ Icon SVG chuẩn UI | ✅ Hoàn thành | Sử dụng `fill.svg`, `filter.svg`, `reset.svg`, `trash.svg` sắc nét. |
| **Lọc & Báo Cáo** | Lọc theo Nhân viên / Ngày / Hình thức | ✅ Hoàn thành | Bộ lọc đa điều kiện thời gian thực. |
| | Thẻ KPI Thống kê | ✅ Hoàn thành | Tự động tính: Tổng ngày công, Tổng giờ làm, Cơ cấu Onsite / Remote / Nghỉ. |
| | Phân Trang Danh Sách | ✅ Hoàn thành | Phân trang mượt mà (10 mục/trang), thanh điều hướng số trang thông minh. |
| **Tổng Hợp Tháng** | Bảng Ma Trận Công Tháng | ✅ Hoàn thành | Tổng hợp giờ làm, phân tách Onsite/Remote và số ngày nghỉ cho từng nhân sự. |
| | Khấu trừ nghỉ trưa tự động | ✅ Hoàn thành | Tự động trừ 1h30 (90 phút) khi thời gian giữa vào và ra vượt quá 5 tiếng. |
| **Phân Quyền & Quản Trị**| Khóa giao diện cứng qua CSS | ✅ Hoàn thành | `body:not(.is-admin) .admin-only` ép ẩn hoàn toàn tab Nhân viên và nút Xóa với Guest. |
| | Quản lý Nhân sự (Admin Only) | ✅ Hoàn thành | Thêm mới / Xóa nhân viên kèm dọn sạch dữ liệu liên quan. |
| | Đổi Mật Khẩu Quản Trị | ✅ Hoàn thành | Đổi mật khẩu trực tiếp trên giao diện modal, yêu cầu xác thực MK cũ. |
| **Trải Nghiệm (UX/UI)** | Thông Báo Center Toast Popup | ✅ Hoàn thành | Nổi ở giữa màn hình, đồng bộ 100% theme Vintage Ledger, 4 phân loại rõ ràng. |
| | Đa Ngôn Ngữ (VI / EN) | ✅ Hoàn thành | Chuyển đổi tức thì Tiếng Việt / Tiếng Anh không cần tải lại trang. |
| **Kiểm Thử & CI/CD** | Test Suite tự động | ✅ Hoàn thành | `npm test` kiểm tra 100% logic API, Auth, Trừ trưa, Rejection, Pagination. |

---

## 5. 📜 QUY TẮC NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

1. **Quy tắc Trừ Giờ Nghỉ Trưa:**
   - Khi thời gian làm việc giữa Vào và Ra $> 5$ giờ: Tự động trừ $90$ phút ($1.5$ giờ) nghỉ trưa.
   - Khi thời gian làm việc $\le 5$ giờ: Giữ nguyên tổng giờ thực tế.
2. **Quy tắc Khóa Form Điểm Danh:**
   - *Chưa có bản ghi:* Ô Vào Mở, Ô Ra Khóa. Nút: `⚡ Điểm danh Vào`.
   - *Đã điểm danh sáng (chờ chiều):* Ô Vào Khóa, Ô Ra Mở. Nút: `🏁 Cập nhật Giờ ra`.
   - *Đã hoàn tất cả 2 mốc hoặc Nghỉ:* Khóa toàn bộ form. Nút: `✓ Đã hoàn tất hôm nay` (Disabled).
3. **Quy tắc Bảo Mật Phân Quyền:**
   - *Nhân viên thường:* Xem giờ, điểm danh, xem bảng tổng hợp.
   - *Admin:* Mới được cấp quyền xóa bản ghi công, thêm/xóa nhân sự, đổi mật khẩu quản trị.
