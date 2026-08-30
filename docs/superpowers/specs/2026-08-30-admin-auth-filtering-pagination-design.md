# Tài Liệu Thiết Kế (Design Spec) — Admin Auth, Lọc Chấm Công & Phân Trang

> **Ngày tạo:** 2026-08-30  
> **Trạng thái:** Chờ phê duyệt (Pending Review)  
> **Phạm vi:** Backend Auth & API Protection, Database Adapter Dual-Mode, Frontend Tabs & Views, Component Phân Trang, Hệ Thống Loading & Toast Notification.

---

## 1. Tổng Quan & Mục Tiêu Nghiệp Vụ

Hệ thống bổ sung cơ chế phân quyền 2 cấp độ: **Người dùng thông thường (Guest / Without login)** và **Quản trị viên (Admin)**, kèm theo giao diện tra cứu/lọc dữ liệu nâng cao và tính năng phân trang toàn diện.

### 1.1. Mục tiêu chính:
1. **Phân quyền Admin an toàn:**
   - Người dùng thông thường: Chỉ được chọn tên mình để chấm công (Check-in / Check-out / Cập nhật ghi chú) và xem bảng chấm công. **Không có quyền thêm/xóa nhân viên, không có quyền xóa chấm công.**
   - Quản trị viên (Admin): Đăng nhập bằng mật khẩu được băm (hashing), có toàn quyền thêm/xóa nhân viên, xóa bản ghi chấm công bất kỳ và có thể đổi mật khẩu qua giao diện.
2. **Tab Lọc & Báo cáo chấm công (Filter & Reports SPA):**
   - Hỗ trợ lọc theo nhân viên, khoảng thời gian (Từ ngày $\rightarrow$ Đến ngày), hình thức làm việc (Onsite / Remote / Nghỉ).
   - Thống kê tóm tắt: Tổng số công, tổng số giờ làm việc, số ngày Onsite/Remote/Nghỉ.
3. **Phân trang (Pagination):**
   - Áp dụng phân trang (10 dòng/trang) cho cả Bảng Chấm Công Hàng Ngày và Bảng Lọc Chấm Công.
4. **Trải nghiệm nhất quán (Loading & Toast Notification):**
   - Mọi thao tác async (Đăng nhập, Đổi pass, Thêm/Xóa nhân viên, Chấm công, Xóa chấm công, Lọc) đều có trạng thái loading và toast thông báo đồng bộ style hiện tại.

---

## 2. Mô Hình Dữ Liệu & Bảo Mật (Data Model & Security)

### 2.1. Bảng Cấu Hình Hệ Thống (`system_settings`)
Hệ thống sử dụng bảng key-value để lưu trữ cấu hình, hỗ trợ chế độ kép (Dual-mode: Supabase PostgreSQL & Local JSON).

#### Supabase PostgreSQL (`schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Khởi tạo cài đặt admin ban đầu nếu chưa có
INSERT INTO system_settings (key, value)
VALUES (
  'admin_auth',
  '{"hash": "e6c6...", "salt": "a1b2...", "updated_at": "2026-08-30T00:00:00.000Z"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
```

#### Local JSON (`data/db.json`):
```json
{
  "employees": [...],
  "entries": [...],
  "settings": {
    "admin_auth": {
      "hash": "...",
      "salt": "...",
      "updated_at": "2026-08-30T00:00:00.000Z"
    }
  }
}
```

### 2.2. Cơ Chế Băm Mật Khẩu (Password Hashing)
- Sử dụng module tích hợp sẵn `crypto` của Node.js:
  - `salt`: Chuỗi hex ngẫu nhiên sinh từ `crypto.randomBytes(16).toString('hex')`.
  - `hash`: `crypto.scryptSync(password, salt, 64).toString('hex')`.
- **Mật khẩu mặc định:** Khi khởi chạy nếu chưa có `admin_auth`, hệ thống tự sinh hash cho mật khẩu mặc định: `admin123`.
- **So sánh mật khẩu an toàn:** Dùng `crypto.timingSafeEqual` để tránh tấn công Timing Attack.

### 2.3. Cơ Chế Xác Thực Phiên (Session Token)
- Khi login đúng, server cấp token HMAC signed:
  - `tokenPayload = { role: 'admin', exp: Date.now() + 7*24*60*60*1000 }`
  - `signature = crypto.createHmac('sha256', SECRET_KEY).update(JSON.stringify(tokenPayload)).digest('hex')`
  - `token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64') + "." + signature`
- Client lưu `token` vào `localStorage.getItem("admin_token")` và gửi kèm trong header:
  `Authorization: Bearer <token>`.

---

## 3. Danh Sách API Endpoints & Phân Quyền

### 3.1. Ma trận phân quyền (Authorization Matrix)

| Endpoint | Method | Quyền hạn | Mô tả |
|---|---|---|---|
| `/api/admin/login` | `POST` | Public | Đăng nhập Admin (`{ password }`) $\rightarrow$ `{ token }` |
| `/api/admin/status` | `GET` | Public / Token | Kiểm tra tính hợp lệ của token Admin hiện tại |
| `/api/admin/change-password` | `POST` | 🔒 **Admin Only** | Đổi mật khẩu (`{ currentPassword, newPassword }`) |
| `/api/employees` | `GET` | Public | Lấy danh sách nhân viên |
| `/api/employees` | `POST` | 🔒 **Admin Only** | Thêm nhân viên mới |
| `/api/employees/:id` | `DELETE` | 🔒 **Admin Only** | Xóa nhân viên và dữ liệu chấm công liên quan |
| `/api/entries` | `GET` | Public | Lấy danh sách chấm công (lọc theo month, employeeId, startDate, endDate, mode) |
| `/api/entries` | `POST` | Public | Check-in / Tạo mới chấm công |
| `/api/entries/:id` | `PUT` | Public | Check-out / Cập nhật ghi chú |
| `/api/entries/:id` | `DELETE` | 🔒 **Admin Only** | Xóa bản ghi chấm công |

### 3.2. Middleware `requireAdmin`
```javascript
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yêu cầu quyền quản trị viên (Admin)" });
  }
  const token = authHeader.split(" ")[1];
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Phiên đăng nhập Admin đã hết hạn hoặc không hợp lệ" });
  }
  next();
}
```

---

## 4. Thiết Kế Giao Diện & Trải Nghiệm Người Dùng (Frontend & UX)

### 4.1. Cấu trúc Tabs & Thanh Điều Hướng (SPA Header)
- **Khi Chưa đăng nhập (Người dùng thường):**
  - Hiển thị Tabs: `[⏱️ Chấm công]` & `[🔍 Lọc & Báo cáo]`.
  - Hiển thị nút `[VI | EN]` và `[🔐 Đăng nhập Admin]`.
- **Khi Đã đăng nhập (Admin):**
  - Hiển thị Tabs: `[⏱️ Chấm công]` & `[🔍 Lọc & Báo cáo]`.
  - Hiển thị huy hiệu `👑 Admin`, nút `[👥 Quản lý NV]`, nút `[🔑 Đổi mật khẩu]`, nút `[🚪 Đăng xuất]`.

### 4.2. Giao diện Tab 1: "⏱️ Chấm công hàng ngày"
- **Form Check-in / Out:** Giữ nguyên logic thông minh (tự phát hiện đã vào hay chưa ra, tính giờ làm, trừ 1h30 nghỉ trưa).
- **Nút "Quản lý nhân viên":** Chỉ hiển thị trong header/form khi `isAdmin === true`.
- **Bảng Lịch sử Chấm công:**
  - Cột "Thao tác" (Nút Xóa 🗑️) chỉ hiển thị khi `isAdmin === true`. Khi người dùng thông thường xem bảng, cột này sẽ ẩn hoàn toàn.
  - **Phân trang:** Hiển thị 10 dòng/trang, có thanh điều hướng phân trang ở cuối bảng.

### 4.3. Giao diện Tab 2: "🔍 Lọc & Báo cáo"
- **Khung bộ lọc (Filter Card):**
  - Dropdown nhân viên: `Tất cả nhân viên` hoặc tên nhân viên cụ thể.
  - Khoảng ngày: `Từ ngày` (input date) và `Đến ngày` (input date).
  - Hình thức: `Tất cả`, `Onsite`, `Remote`, `Nghỉ`.
  - Nút hành động: `🔍 Lọc dữ liệu` (kèm loading) và `🔄 Đặt lại`.
- **Thẻ tổng hợp chỉ số (Summary KPI Cards):**
  - **Tổng số công/bản ghi:** X ngày
  - **Tổng giờ làm việc:** Y giờ (đã trừ nghỉ trưa)
  - **Phân loại:** Onsite: A | Remote: B | Nghỉ: C
- **Bảng kết quả lọc:**
  - Hiển thị danh sách kết quả theo bộ lọc.
  - Cột "Xóa" chỉ hiện khi là Admin.
  - Tích hợp thanh phân trang 10 dòng/trang.

### 4.4. Component Phân Trang Dùng Chung (`Pagination`)
- Logic quản lý:
  - `currentPage` (bắt đầu từ 1)
  - `pageSize` (cố định 10)
  - `totalItems` và `totalPages = Math.ceil(totalItems / pageSize)`
- Giao diện điều hướng:
  - Nút `◀ Trước` (disabled khi ở trang 1)
  - Danh sách số trang: `[1]`, `[2]`, `[3]` (trang hiện tại được highlight màu primary)
  - Nút `Sau ▶` (disabled khi ở trang cuối)
  - Text thông tin: `Hiển thị 1-10 trên tổng số 28 bản ghi`.

### 4.5. Các Modals / Dialogs
1. **Modal Đăng nhập Admin:**
   - Input mật khẩu + icon hiển thị/ẩn mật khẩu.
   - Nút Đăng nhập (kèm spinner) + Nút Hủy.
2. **Modal Đổi mật khẩu Admin (chỉ mở khi đã login):**
   - Input: Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới.
   - Validation kiểm tra mật khẩu mới $\ge$ 6 ký tự và trùng khớp xác nhận.
   - Nút Cập nhật mật khẩu + Nút Đóng.
3. **Modal Quản lý Nhân viên:**
   - Giữ nguyên giao diện thêm/xóa nhân viên, chỉ mở được khi là Admin.

### 4.6. Hệ thống Loading Spinner & Toast Notification
- **Loading:** Hiển thị spinner đồng bộ trên các nút bấm (Login, Đổi pass, Thêm/Xóa NV, Check-in, Lọc dữ liệu) và overlay bảng khi đang tải dữ liệu.
- **Toast Notification:** Toast góc trên/dưới màn hình với animation mượt mà (Xanh cho thành công, Đỏ cho lỗi), tự động ẩn sau 3.5 giây.

### 4.7. Hỗ Trợ Đa Ngôn Ngữ (i18n)
Bổ sung đầy đủ từ khóa Tiếng Việt và Tiếng Anh trong `public/app.js` cho tất cả các nhãn mới.

---

## 5. Kế Hoạch Kiểm Thử & Xác Minh (Testing Strategy)

1. **Test Backend & Auth (`test/test_api.js`):**
   - Test băm mật khẩu với salt và xác minh mật khẩu đúng/sai.
   - Test đăng nhập cấp token và kiểm tra token hết hạn/không hợp lệ.
   - Test gọi `POST /api/employees`, `DELETE /api/employees/:id`, `DELETE /api/entries/:id` khi KHÔNG có token $\rightarrow$ Nhận đúng mã `401 Unauthorized`.
   - Test gọi các endpoint trên khi CÓ token hợp lệ $\rightarrow$ Thành công `200 OK`.
   - Test đổi mật khẩu thành công và đổi mật khẩu khi sai mật khẩu cũ $\rightarrow$ Nhận đúng lỗi `400 Bad Request`.
2. **Test Logic Lọc & Phân Trang (`test/test_e2e_calc.js`):**
   - Test lọc danh sách entries theo khoảng ngày (startDate $\le$ date $\le$ endDate).
   - Test lọc theo employeeId và mode.
   - Test thuật toán phân trang (cắt mảng theo trang, tính toán tổng số trang).
3. **Kiểm thử thủ công giao diện (UI Verification):**
   - Chế độ Khách: Thử check-in/out, kiểm tra không thấy nút Quản lý NV và nút Xóa.
   - Đăng nhập Admin: Nhập pass $\rightarrow$ Thấy badge Admin, nút Quản lý NV và nút Xóa.
   - Chuyển đổi qua lại giữa Tab Chấm công và Tab Lọc dữ liệu, thử phân trang các bảng.

---

## 6. Đánh Giá Khả Năng Tương Thích (Compatibility Check)
- **Tương thích Local & Cloud:** Hoạt động trơn tru trên cả môi trường `data/db.json` (Local) lẫn Supabase Cloud (PostgreSQL).
- **Vercel Serverless:** Token sử dụng HMAC signature độc lập không phụ thuộc local disk hay sticky session, đảm bảo hoạt động 100% trên Vercel Serverless functions.
- **Không phát sinh dependencies nặng:** Tận dụng tối đa `crypto` có sẵn của Node.js.
