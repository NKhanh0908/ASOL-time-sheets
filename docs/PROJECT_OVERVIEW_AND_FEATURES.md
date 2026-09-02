# 📘 TÀI LIỆU TỔNG QUAN DỰ ÁN & ĐẶC TẢ CHỨC NĂNG HỆ THỐNG
## ASOL Timesheet App — Hệ Thống Chấm Công & Quản Lý Thực Tập Sinh

---

## 1. GIỚI THIỆU TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)

**ASOL Timesheet App** là ứng dụng web chuyên nghiệp, gọn nhẹ và bảo mật cao được phát triển dành riêng cho **Alpaca Solutions (ASOL)** nhằm quản trị thời gian làm việc, điểm danh hàng ngày và tổng hợp công nợ/giờ làm của đội ngũ Thực tập sinh (TTS / Interns).

### 🎯 Mục tiêu cốt lõi:
1. **Chuẩn hóa quy trình chấm công:** Hỗ trợ điểm danh 2 lần mỗi ngày (Buổi sáng Check-in / Buổi chiều Check-out) cho các hình thức *Onsite*, *Remote* và *Nghỉ phép*.
2. **Tự động hóa tính toán:** Tự động khấu trừ chính xác 1h30 nghỉ trưa cho các ca làm việc từ 5 tiếng trở lên, tự động tính tổng giờ làm việc thực tế.
3. **Bảo mật & Phân quyền dữ liệu (RBAC):** Cô lập dữ liệu giữa các thực tập sinh (TTS chỉ thấy và quản lý bản ghi của chính mình) và trao toàn quyền giám sát, tổng hợp cho Quản trị viên (Admin).
4. **Đồng bộ bảng tính Google Spreadsheet an toàn (Sync v2):** Phân vùng tab theo từng tháng, chống ghi đè, chống nhân bản dòng rác, xác thực khóa bí mật và tự động hóa qua Cron Job định kỳ.

---

## 2. KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ (TECH STACK)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND ARCHITECTURE                                 │
│  • Pure HTML5 / CSS3 (Vintage Ledger Theme + Responsive Mobile Bottom Bar)      │
│  • Native ES6 Modules (public/js/): state, api, i18n, utils, modals, tabs       │
│  • Hệ thống Icon Vector SVG tối giản & Tooltips                                 │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ RESTful API / JSON (Bearer Token Auth)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND REST API (Node.js)                           │
│  • Express.js RESTful API                                                        │
│  • Bảo mật: Scrypt Password Hashing + Salt, HMAC-SHA256 Token Session            │
│  • Task Scheduler: node-cron (Chạy lúc 10:00 & 20:00 UTC+7)                      │
│  • Dispatcher: AbortController 25s Webhook Caller                                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
┌────────────────────────────────────────┐             ┌──────────────────────────────────┐
│          STORAGE ENGINE DUAL           │             │    GOOGLE SPREADSHEET (APPS SCRIPT)│
│  • Local: data/db.json (Offline)       │             │  • LockService chống Race Condition│
│  • Cloud: Supabase PostgreSQL          │             │  • Tab riêng: ChamCong_YYYY_MM    │
└────────────────────────────────────────┘             │  • Tab tổng: TongHop_YYYY        │
                                                       └──────────────────────────────────┘
```

- **Frontend:**
  - Kiến trúc không phụ thuộc thư viện nặng (Zero Framework Dependencies).
  - Sử dụng CSS Variables, Flexbox/Grid, hỗ trợ giao diện co giãn hoàn hảo trên cả Desktop và Mobile.
  - Native ES6 Modules: Phân tách rõ ràng giữa Quản lý State (`state.js`), Gọi API (`api.js`), Đa ngôn ngữ (`i18n.js`), Tiện ích (`utils/`), và các Tab chức năng độc lập (`tabs/`).
- **Backend:**
  - Node.js + Express REST API.
  - Thuật toán mã hóa mật khẩu an toàn `crypto.scrypt` với muối ngẫu nhiên (Salt 16 bytes).
  - Token xác thực phiên làm việc HMAC-SHA256 có thời hạn (7 ngày cho Employee, 24 giờ cho Admin).
  - Bộ lập lịch Cron Job `node-cron` chạy theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`).
- **Cơ sở dữ liệu Kép (Dual Database Strategy):**
  - Môi trường Local: Lưu trữ tự động dạng JSON vào `data/db.json`.
  - Môi trường Production: Tự động chuyển sang Cloud Database **Supabase PostgreSQL**.
- **Tích hợp Bên ngoài:**
  - Google Apps Script Web App v2 (Chạy độc lập trên Google Cloud / Google Drive của công ty).

---

## 3. DANH SÁCH & CHI TIẾT CÁC CHỨC NĂNG (DETAILED FEATURE MATRIX)

### 🔹 1. Màn Hình Đăng Nhập & Phân Quyền Bảo Mật (Auth Gate & RBAC)
- **Tab Đăng nhập kép:**
  - **Thực tập sinh (Intern):** Đăng nhập bằng **Mã TTS** (Ví dụ: `TTS01`, `TTS02`) và Mật khẩu cá nhân.
  - **Quản trị viên (Admin):** Đăng nhập bằng Mật khẩu quản trị cấp cao.
- **Cơ chế Phân quyền & Cô lập Dữ liệu (Scoped Access Control):**
  - **Thực tập sinh:** Chỉ xem được lịch sử chấm công của chính mình, chỉ được tạo/sửa bản ghi của bản thân, không xem được thông tin của TTS khác, không có quyền xoá bản ghi hay truy cập cài đặt hệ thống.
  - **Quản trị viên:** Toàn quyền xem chấm công của tất cả mọi người, xem bảng ma trận tổng hợp, thêm/xóa nhân viên, reset mật khẩu, và cấu hình đồng bộ Google Sheet.
- **Tính năng Đổi Mật Khẩu & Quên Mật Khẩu:**
  - Nút Đổi mật khẩu cá nhân cho cả TTS và Admin.
  - Modal hướng dẫn Quên mật khẩu liên hệ Admin để reset.
- **Tự Động Đăng Nhập Lại (Session Persistence):**
  - Lưu phiên đăng nhập an toàn trong `localStorage` với Bearer Token.

---

### 🔹 2. Module Điểm Danh & Chấm Công Thông Minh (Daily Twice-Checkin)
- **Cơ chế Điểm Danh 2 Lần / Ngày (Twice-Daily Workflow):**
  - **Buổi sáng (Check-in):** Nhập giờ vào (hoặc bấm nút *Fill giờ hiện tại*), ô giờ ra tự động khóa mờ để tránh bấm nhầm.
  - **Buổi chiều (Check-out):** Khi nhân viên đã có giờ vào, hệ thống tự động khóa cố định ô giờ vào, mở khóa ô giờ ra kèm nút *Fill giờ hiện tại*.
  - **Chống trùng lặp ngày công:** Khi bản ghi trong ngày đã hoàn thành đủ giờ vào và giờ ra (hoặc đã đăng ký *Nghỉ*), form chấm công tự động chuyển sang trạng thái đã hoàn tất và khóa lại.
- **Nút Check-out Nhanh Trên Bảng:**
  - Trên danh sách nhân viên đang làm việc trong ngày, Admin hoặc TTS có thể bấm ngay nút **`🏁 Check-out`** trên từng dòng để ghi nhận giờ ra tức thì mà không cần nhập form.
- **Bộ Nút Gợi Ý Nhanh Nội Dung Công Việc (Quick Suggestion Tags):**
  - Bấm **`Làm task dự án`** $\rightarrow$ Tự động điền prefix: `Làm task dự án: ` và focus con trỏ văn bản.
  - Bấm **`Fix bugs / Testing`** $\rightarrow$ Tự động điền prefix: `Fix bugs/ Testing cho dự án: `.
  - Bấm **`Nghiên cứu`** $\rightarrow$ Tự động điền prefix: `Nghiên cứu về: `.
- **Thuật Toán Tính Giờ & Khấu Trừ Nghỉ Trưa Thông Minh:**
  - Tự động tính số giờ làm việc thực tế = $\text{Giờ ra} - \text{Giờ vào}$.
  - Nếu tổng thời gian làm việc $\ge 5.0\text{ giờ}$ $\rightarrow$ Tự động khấu trừ $1.5\text{ giờ}$ (1h30 phút nghỉ trưa theo quy định công ty).
  - Đối với hình thức *Nghỉ* $\rightarrow$ Giờ làm mặc định bằng $0$.

---

### 🔹 3. Module Tra Cứu, Lọc & Thống Kê Lịch Sử (Filter & Timesheet History)
- **Bộ Lọc Đa Tiêu Chí:**
  - Lọc theo **Nhân viên** (TTS bị cố định chỉ lọc chính mình, Admin có thể chọn bất kỳ nhân viên nào).
  - Lọc theo **Khoảng ngày** (Từ ngày $\rightarrow$ Đến ngày).
  - Lọc theo **Hình thức làm việc** (*Tất cả / Onsite / Remote / Nghỉ*).
  - Nút **`Đặt lại (Reset)`** khôi phục bộ lọc về mặc định.
- **4 Thẻ KPI Thống Kê Trực Quan:**
  - 📋 **Tổng số ngày công:** Tổng số ngày đi làm được ghi nhận.
  - ⏱️ **Tổng số giờ làm:** Tổng số giờ làm việc thực tế sau khi đã trừ trưa.
  - 🏢 **Cơ cấu làm việc:** Tỷ lệ phân bổ giữa số ngày Onsite và số ngày Remote.
  - ☕ **Số ngày nghỉ:** Tổng số ngày đăng ký nghỉ phép.
- **Phân Trang & Quản Trị Dữ Liệu:**
  - Phân trang thông minh 10 dòng/trang kèm điều hướng Previous / Next.
  - Quyền Xoá bản ghi: Chỉ Quản trị viên mới nhìn thấy icon Thùng rác 🗑️ để xoá bản ghi sai sót.

---

### 🔹 4. Module Quản Lý Thực Tập Sinh (Employee Management)
- **Danh sách Nhân sự Trực quan:**
  - Hiển thị đầy đủ: Mã nhân viên (`TTS01`, `TTS02`), Họ và tên, Trạng thái tài khoản và Ngày khởi tạo.
- **Thêm Mới Thực Tập Sinh:**
  - Admin tạo nhân viên mới kèm mã TTS và mật khẩu khởi tạo.
- **Chức năng Admin Reset Mật Khẩu:**
  - Admin có thể cấp lại mật khẩu mới hoặc bấm **`Tạo mật khẩu ngẫu nhiên (Generate Random)`** gồm 8 ký tự an toàn cho thực tập sinh khi họ quên mật khẩu.
- **Xoá Nhân Viên:**
  - Admin có quyền xóa tài khoản nhân viên khỏi hệ thống (kèm cảnh báo xác nhận an toàn).

---

### 🔹 5. Module Bảng Ma Trận Tổng Hợp Tháng (Monthly Summary Matrix)
- **Bộ chọn Tháng linh hoạt:** Cho phép xem bảng tổng hợp của bất kỳ tháng nào trong năm.
- **Bảng Ma Trận Tổng Hợp Đa Cột:**
  - Cột 1: Mã & Họ tên nhân viên.
  - Cột 2: Tổng giờ làm việc tích lũy trong tháng.
  - Cột 3: Số ngày Onsite / Số ngày Remote.
  - Cột 4: Số ngày Nghỉ.
- **Dòng Tổng Kết Cuối Bảng (Grand Total):** Tính tổng toàn bộ giờ làm của cả team trong tháng.

---

### 🔹 6. Module Đồng Bộ Google Spreadsheet An Toàn (Sync v2 Architecture)
- **Phân Vùng Tab Theo Tháng (`Monthly Partitioning`):**
  - Tự động tạo và ghi vào tab riêng theo từng tháng: **`ChamCong_YYYY_MM`** (Ví dụ: `ChamCong_2026_09`).
  - Dữ liệu lịch sử các tháng cũ được bảo tồn độc lập, không bao giờ bị xáo trộn hay xóa nhầm.
- **Tab Tổng Hợp Cả Năm (`TongHop_YYYY`):**
  - Bảng tổng kết số giờ làm và số ngày công của toàn bộ các tháng trong năm được lưu trữ tại tab `TongHop_2026`.
- **Khóa Đa Luồng (`LockService`):**
  - Giữ khóa tối đa 10 giây để serialize các yêu cầu ghi, chống triệt để tình trạng Race Condition khi nhiều nhân viên cùng check-in một lúc.
- **Ép Cứng Định Dạng Plain Text (`@`):**
  - Ép định dạng Text cho Cột Ngày (Cột A) và Cột Giờ (D, E), ngăn chặn lỗi Google Sheets tự động chuyển đổi chuỗi ngày thành Date Object gây lệch ngày.
- **Thuật Toán Batch Upsert In-Memory & So Khớp Timestamp:**
  - Nhận diện bản ghi theo khóa duy nhất: `Ngày_MãTTS` (Ví dụ: `2026-09-02_TTS01`).
  - Chỉ ghi đè dữ liệu khi $\texttt{Timestamp bản ghi mới} \ge \texttt{Timestamp bản ghi hiện có trên Sheet}$.
  - Ghi toàn bộ dữ liệu 1 lần duy nhất bằng lệnh `setValues` (tốc độ $< 0.3$ giây, không bao giờ timeout).
- **3 Luồng Đồng Bộ Phối Hợp:**
  1. ⚡ **Real-time Sync:** Tự động gửi cập nhật ngay khi TTS bấm Check-in / Check-out trên App.
  2. ⏰ **Cron Job Định Kỳ:** Chạy tự động lúc **10:00 sáng** và **20:00 tối** hàng ngày (Múi giờ `Asia/Ho_Chi_Minh`), sử dụng cơ chế **High-Watermark Delta Sync** chỉ gửi các bản ghi mới/chỉnh sửa.
  3. 📤 **Đồng Bộ Thủ Công (Nút Bấm):** Admin chọn tháng bất kỳ trên giao diện và bấm nút `📤 Đồng bộ Google Sheet` để tái đối soát toàn vẹn tháng.
- **Bảo Vệ Chống Spam & Phá Hoại (Anti-Spam & Rate Limiting):**
  - Cooldown 10 giây ở phía Server và khóa nút bấm trên giao diện, từ chối mọi hành vi spam request liên tục.
  - Lớp bảo mật **Shared Secret Token** ngăn chặn các request giả mạo từ bên ngoài.

---

### 🔹 7. Trải Nghiệm Giao Diện, UI/UX & Đa Ngôn Ngữ
- **Thiết Kế Phong Cách Vintage Ledger:**
  - Giao diện thẻ giấy / mực in cổ điển trang nhã, font chữ kết hợp giữa *Space Grotesk*, *IBM Plex Mono* và *Inter*.
- **Hệ Thống Icon Vector SVG Tối Giản:**
  - Toàn bộ nút thao tác trên header và danh sách nhân viên sử dụng Icon Vector SVG sắc nét kèm tooltip rõ ràng (`setting.svg`, `key.svg`, `logout.svg`, `trash.svg`, `time.svg`, `filter.svg`).
- **Tab Navigation Co Giãn Mượt Mà (Expanding Pill Design):**
  - Tab không chọn: Chỉ hiển thị icon tinh gọn.
  - Tab đang chọn: Tự động mở rộng hiển thị cả icon và tên chức năng với hiệu ứng chuyển động êm ái.
- **Tối Ưu Hoàn Hảo Cho Thiết Bị Di Động (Mobile-First Bottom Bar):**
  - Trên điện thoại, hệ thống thanh điều hướng chuyển xuống đáy màn hình (Bottom Navigation Bar), vừa vặn ngón tay cái, mang lại trải nghiệm như Native App.
- **Hệ Thống Thông Báo Nổi Trung Tâm (Center Toast Popup):**
  - Hộp thông báo xuất hiện giữa màn hình với hiệu ứng trượt nhẹ, phân loại màu sắc rõ rệt (Xanh lá: Thành công, Đỏ: Lỗi, Vàng: Cảnh báo, Xanh dương: Thông tin).
- **Hỗ Trợ Song Ngữ Toàn Diện (Tiếng Việt & English):**
  - Hệ thống từ điển JSON linh hoạt cập nhật toàn bộ nhãn giao diện tức thì theo lựa chọn ngôn ngữ.

---

## 4. BẢNG TỔNG KẾT API ENDPOINTS

| Nhóm | Phương thức | Endpoint | Phân quyền | Chức năng |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Public | Đăng nhập tài khoản (TTS / Admin) |
| | `GET` | `/api/auth/me` | Logged In | Lấy thông tin tài khoản hiện tại |
| | `POST` | `/api/auth/change-password`| Logged In | Đổi mật khẩu cá nhân |
| **Employees** | `GET` | `/api/employees` | Logged In | Lấy danh sách nhân viên |
| | `POST` | `/api/employees` | Admin only | Thêm nhân viên mới |
| | `POST` | `/api/employees/:id/reset-password` | Admin only | Reset mật khẩu cho nhân viên |
| | `DELETE` | `/api/employees/:id` | Admin only | Xóa nhân viên |
| **Entries** | `GET` | `/api/entries` | Logged In (Scoped) | Lấy danh sách chấm công theo bộ lọc |
| | `POST` | `/api/entries` | Logged In | Tạo lượt chấm công mới (Check-in) |
| | `PUT` | `/api/entries/:id` | Logged In (Scoped) | Cập nhật lượt chấm công (Check-out) |
| | `DELETE` | `/api/entries/:id` | Admin only | Xóa bản ghi chấm công |
| **Settings** | `GET` | `/api/settings` | Admin only | Lấy cấu hình Webhook & Đồng bộ |
| | `POST` | `/api/settings` | Admin only | Cập nhật cấu hình Webhook URL & Secret |
| **Sync** | `POST` | `/api/sync/test` | Admin only | Kiểm tra kết nối Google Sheet Webhook |
| | `POST` | `/api/sync/month` | Admin only | Đồng bộ toàn bộ dữ liệu tháng sang Google Sheet |

---

*Tài liệu được biên soạn bởi Đội ngũ Kỹ thuật ASOL (Alpaca Solutions).*
