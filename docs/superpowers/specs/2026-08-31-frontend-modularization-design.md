# Thiết Kế Kiến Trúc: Tái Cấu Trúc & Phân Tách Frontend (Frontend Modularization)

- **Ngày tạo:** 2026-08-31
- **Trạng thái:** Chờ phê duyệt (Pending Review)
- **Mục tiêu:** Phân tách mã nguồn frontend nguyên khối (`public/app.js` ~1079 dòng) thành các ES Module độc lập, có ranh giới trách nhiệm rõ ràng, chuẩn Web hiện đại, hoạt động native không cần bundler và sẵn sàng chuyển đổi sang Vite (Vite-ready) bất kỳ lúc nào.

---

## 1. Bối Cảnh & Vấn Đề (Context & Problem)

- **Hiện trạng:**
  - `public/app.js` chứa hơn 1000 dòng code gộp chung toàn bộ: quản lý state toàn cục, từ điển đa ngôn ngữ (i18n), logic gọi API, tính toán giờ làm / trừ giờ nghỉ trưa, điều khiển 4 tabs chính (Chấm công, Lọc, Nhân viên, Tổng hợp), điều khiển modals đăng nhập / đổi mật khẩu Admin, phân trang và thông báo toast.
  - Khó theo dõi lỗi, khó mở rộng tính năng mới và không tận dụng được cơ chế nạp module theo chuẩn ES6+.
- **Yêu cầu kỹ thuật:**
  - Tách nhỏ thành các module có tính gắn kết cao (High Cohesion) và lỏng lẻo (Loose Coupling).
  - Sử dụng chuẩn **Native ES Modules** (`<script type="module">`), không thêm build step phức tạp ở thời điểm hiện tại để giữ quy trình deploy Vercel / Docker nguyên vẹn.
  - Thiết kế cấu trúc 100% **Vite-ready**: sử dụng cú pháp `import / export` với relative path và file extension `.js` đầy đủ để khi tích hợp Vite trong tương lai chỉ cần thêm `vite.config.js` mà không phải viết lại code logic.

---

## 2. Cấu Trúc Thư Mục Mới (New File Structure)

```text
public/
├── index.html                 # HTML chính (khung semantic, nạp js/main.js)
├── styles.css                 # CSS toàn cục & styling components
├── assets/                    # Assets tĩnh (logo, icons)
└── js/
    ├── main.js                # Entry point: điều phối khởi động app & chuyển tabs
    ├── state.js               # Reactive / Centralized state management
    ├── i18n.js                # Quản lý từ điển VI/EN, hàm t(), cập nhật UI i18n
    ├── api.js                 # API client wrapper (fetch, token auth headers, errors)
    ├── utils/
    │   ├── time.js            # Tính toán giờ làm, trừ 1h30 trưa, format thời gian
    │   └── ui.js              # Toast notifications, button loading state, universal pagination
    ├── tabs/
    │   ├── chamCong.js        # Tab 1: Form chấm công vào/ra, quick-checkout, danh sách ngày
    │   ├── locChamCong.js     # Tab 2: Bộ lọc ngày/nhân viên/hình thức, KPIs, danh sách lọc
    │   ├── nhanVien.js        # Tab 3: Quản lý thêm/xóa nhân viên (Admin only)
    │   └── tongHop.js         # Tab 4: Bảng tổng hợp công & giờ làm theo tháng
    └── modals/
        └── adminAuth.js       # Modal đăng nhập Admin, đổi mật khẩu Admin, logout & UI toggle
```

---

## 3. Chi Tiết Ranh Giới Module & Trách Nhiệm (Module Boundaries & Responsibilities)

### 3.1. `js/state.js`
- **Mục đích:** Là nguồn sự thật duy nhất (Single Source of Truth) cho trạng thái ứng dụng.
- **Dữ liệu quản lý:**
  - `employees`: Danh sách nhân viên `[{ id, name }]`.
  - `entriesCache`: Cache chấm công theo tháng `{ "YYYY-MM": [...] }`.
  - `isAdmin`: Trạng thái quyền Admin (`boolean`).
  - `adminToken`: Token xác thực Admin từ `localStorage`.
  - `timesheetPage` & `pageSize`: Trạng thái phân trang tab Chấm công.
  - `filterData`: Kết quả lọc, trang hiện tại, trạng thái load của tab Lọc.
- **Exports:** `state`, `invalidateEntriesCache(monthKey)`.

### 3.2. `js/i18n.js`
- **Mục đích:** Xử lý toàn bộ logic đa ngôn ngữ.
- **Chi tiết:**
  - Quản lý từ điển `dict` với 2 ngôn ngữ: `vi` (mặc định) và `en`.
  - `currentLang`: Đọc/ghi ngôn ngữ vào `localStorage ("ts_lang")`.
  - `t(key)`: Trả về chuỗi dịch tương ứng, fallback về `vi`.
  - `setLanguage(lang, reRenderCallbacks)`: Cập nhật DOM `[data-i18n]`, `[data-i18n-ph]`, active button, và gọi lại các hàm callback render giao diện.
- **Exports:** `dict`, `t`, `currentLang`, `setLanguage`, `initI18n`.

### 3.3. `js/api.js`
- **Mục đích:** Trừu tượng hóa việc giao tiếp qua REST API với Backend.
- **Chi tiết:**
  - Tự động gắn header `Authorization: Bearer <token>` nếu `state.adminToken` tồn tại.
  - Xử lý status code lỗi và parse JSON body lỗi thân thiện.
- **Exports:**
  - `api(path, opts)`
  - `fetchEmployees()`, `createEmployee(name)`, `deleteEmployee(id)`
  - `fetchEntries(filters)`, `createEntry(entry)`, `updateEntry(id, patch)`, `deleteEntry(id)`
  - `loginAdmin(password)`, `getAdminStatus()`, `changeAdminPassword(currentPass, newPass)`

### 3.4. `js/utils/time.js`
- **Mục đích:** Chứa các hàm tiện ích xử lý thời gian thuần túy (pure functions).
- **Exports:**
  - `todayStr()`: Lấy ngày hiện tại `YYYY-MM-DD`.
  - `monthKeyOf(dateStr)`: Trích xuất `YYYY-MM`.
  - `timeToMinutes(tStr)`: Chuyển chuỗi `HH:mm` sang số phút.
  - `hoursBetween(inStr, outStr, mode)`: Tính số giờ làm thực tế, tự động trừ 90 phút (1h30) nếu ca làm > 5 giờ.
  - `fmtHours(h)`: Định dạng hiển thị giờ (ví dụ: `8,50h`).
  - `weekdayLabelFor(dateStr)`: Lấy nhãn thứ trong tuần theo ngôn ngữ hiện tại.
  - `monthLabel(mk)`: Lấy nhãn tháng theo ngôn ngữ hiện tại.

### 3.5. `js/utils/ui.js`
- **Mục đích:** Chứa các hàm hỗ trợ giao diện dùng chung.
- **Exports:**
  - `showToast(message, type = "success")`: Hiển thị thông báo nổi tự động ẩn sau 3.5s.
  - `setBtnLoading(btn, isLoading, customText)`: Bật/tắt trạng thái spinner loading trên button.
  - `renderPagination(container, { currentPage, totalItems, pageSize }, onPageChange)`: Render thanh phân trang chung.

### 3.6. Các Modules Tab Nghiệp Vụ (`js/tabs/`)
- **`chamCong.js`:**
  - Quản lý Form chấm công: tự động điền giờ hiện tại, nhận diện ca sáng vào / chiều ra, validate ghi chú.
  - Xử lý Quick-checkout trực tiếp trên danh sách.
  - Render danh sách chấm công trong ngày và phân trang.
- **`locChamCong.js`:**
  - Quản lý Form tìm kiếm & bộ lọc nâng cao (theo nhân viên, khoảng ngày, hình thức).
  - Tính toán và render 3 thẻ KPIs: Tổng số công, Tổng giờ làm, Phân loại Onsite/Remote/Nghỉ.
  - Render kết quả lọc có phân trang.
- **`nhanVien.js`:**
  - Render danh sách nhân viên (chỉ dành cho Admin).
  - Form thêm mới nhân viên và nút xóa nhân viên kèm xác nhận.
- **`tongHop.js`:**
  - Selector chọn tháng báo cáo.
  - Tổng hợp dữ liệu chấm công cả tháng của từng nhân viên và tính tổng toàn team.

### 3.7. `js/modals/adminAuth.js`
- **Mục đích:** Quản lý vòng đời xác thực của Quản trị viên.
- **Chi tiết:**
  - Đóng/mở modal đăng nhập Admin và modal đổi mật khẩu Admin.
  - Lưu / Xóa JWT Token trong `localStorage`.
  - Toggle hiển thị các phần tử `.admin-only` (nút xóa, tab nhân viên, header admin badge).

### 3.8. `js/main.js` (App Orchestrator)
- Khởi tạo lắng nghe sự kiện chuyển tab (Navigation Tabs).
- Gắn sự kiện chọn ngôn ngữ (VI / EN).
- Chạy chu trình khởi tạo `init()`:
  1. Áp dụng ngôn ngữ lưu trữ.
  2. Kiểm tra token Admin (`getAdminStatus`).
  3. Nạp danh sách nhân viên ban đầu.
  4. Render dữ liệu ngày hôm nay và tab tổng hợp.

---

## 4. Tinh Gọn `public/index.html`

- Thay đổi thẻ nạp script:
  ```html
  <!-- Cũ -->
  <script src="app.js"></script>

  <!-- Mới -->
  <script type="module" src="js/main.js"></script>
  ```
- Chuẩn hóa các `id`, `data-i18n`, và các thẻ semantic để các module JS dễ dàng query selector mà không bị chồng chéo.
- Giữ nguyên toàn bộ layout, CSS class và trải nghiệm người dùng hiện tại.

---

## 5. Kế Hoạch Đảm Bảo Tương Thích & Kiểm Thử (Verification & Compatibility)

1. **Kiểm thử tự động:** Chạy `npm test` để xác nhận toàn bộ backend tests và calculation test cases vẫn pass 100%.
2. **Kiểm thử thủ công trên trình duyệt:**
   - Kiểm tra nạp trang: Không có lỗi SyntaxError hay Module loading error trong DevTools Console.
   - Kiểm tra Tab Chấm công: Điểm danh vào sáng, cập nhật ra chiều, quick check-out.
   - Kiểm tra Tab Lọc: Lọc theo nhân viên, khoảng ngày, tính toán KPI chính xác.
   - Kiểm tra Tab Nhân viên & Modal Admin: Đăng nhập Admin (`admin123`), thêm nhân viên, đổi mật khẩu, đăng xuất.
   - Kiểm tra Tab Tổng hợp: Hiển thị đúng bảng giờ làm theo tháng.
   - Kiểm tra Đa ngôn ngữ: Chuyển đổi qua lại giữa VI và EN tức thì.
   - Kiểm tra ghi nhớ ngôn ngữ & phiên Admin sau khi F5 trang.
