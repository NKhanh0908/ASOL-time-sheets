# Tài liệu Đặc tả Thiết kế Toàn diện: Kiến trúc Đồng bộ Google Spreadsheet An Toàn & Chống Trùng Lặp Dữ Liệu

- **Dự án:** ASOL Timesheet App
- **Ngày cập nhật:** 02/09/2026
- **Trạng thái:** Đã tinh chỉnh chi tiết (Refined with Strict Guarantees)
- **Tác giả:** Antigravity Team & Alpaca Solutions Engineering

---

## 1. Bối cảnh & Vấn đề Cần Giải Quyết (Problem Statement)

Tính năng đồng bộ Google Spreadsheet ([`scripts/google_apps_script.js`](file:///D:/Working/ASOL/tool/timesheet-app/scripts/google_apps_script.js)) từng gặp phải các điểm nghẽn nghiêm trọng:

1. **Lệch kiểu dữ liệu Ngày tháng (`Date Format Mismatch`):**
   Google Apps Script đọc ô ngày của Sheet ra đối tượng `Date` (chuỗi dạng `"Sun Aug 30 2026..."`). Nếu không ép cứng định dạng Text (`@`), Google Sheets tự parse chuỗi ngày thành Date Object $\rightarrow$ Điều kiện so khớp luôn sai $\rightarrow$ Luôn chèn dòng mới (*append*) thay vì cập nhật dòng cũ $\rightarrow$ Gây trùng lặp dữ liệu.
2. **Xung đột Out-of-Order do mạng/retry:**
   Nếu do retry hoặc mạng chập chờn mà một request cũ đến sau một request mới, nếu không kiểm tra timestamp `updated_at`, dữ liệu mới sẽ bị ghi đè ngược bởi dữ liệu cũ.
3. **Lệch Timeout giữa Node.js và Google Apps Script:**
   Timeout của `AbortController` phía Node.js nếu ngắn hơn thời gian `waitLock()` của Google Apps Script sẽ khiến Node.js huỷ kết nối trước khi GAS kịp phản hồi $\rightarrow$ Gây lỗi timeout giả và retry chồng chéo.
4. **Nguy cơ bảo mật Web App không xác thực:**
   Apps Script Web App deploy ở chế độ "Anyone" nhưng chưa có cơ chế Shared-Secret Token hoặc chữ ký xác thực $\rightarrow$ Bất kỳ ai có URL đều có thể gửi payload giả mạo.
5. **Lệch múi giờ (Timezone Misalignment):**
   Node.js và Google Apps Script nếu không thống nhất múi giờ `Asia/Ho_Chi_Minh` (UTC+7) sẽ làm lệch giờ hiển thị và ngày chấm công.

---

## 2. Mục tiêu & Nguyên Tắc Thiết Kế (Design Principles)

- **Idempotency (Tính bất biến khi gọi lặp):** Mọi thao tác đồng bộ dù gọi 1 lần hay 10 lần đều cho ra kết quả duy nhất, chính xác.
- **Last-Write-Wins có kiểm soát (Timestamp Conflict Resolution):** Chỉ ghi đè dữ liệu cũ khi `entry.updatedAt >= existingUpdatedAt`.
- **Monthly Partitioning (Phân vùng theo tháng):** Mỗi tháng là một Tab riêng biệt `ChamCong_YYYY_MM`, cách ly an toàn dữ liệu lịch sử.
- **Shared Secret Authentication:** Xác thực bảo mật hai đầu giữa Backend và Google Apps Script.
- **Strict Format Enforcement:** Ép cứng định dạng `@` (Plain Text) cho cột Ngày ở cả cấp độ Schema Tab và trong mỗi lần Batch Write.

---

## 3. Kiến trúc Tổng Thể & Luồng Điều Phối (Architecture Overview)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TIMESHEET APP (Node.js/Express)                      │
│                                                                                  │
│   [⚡ Realtime Check-in]      [⏰ Cron Job 10h & 20h]      [📤 Nút Đồng Bộ Tay]   │
│             │                           │                            │           │
│             ▼                           ▼                            ▼           │
│     (1 Record Delta)             (Changed Records)            (Full Month)       │
│             │                           │                            │           │
│             └───────────────────────────┼────────────────────────────┘           │
│                                         ▼                                        │
│     [Sync Dispatcher] -> Tạo Payload kèm Secret Token + Timezone ICT (UTC+7)     │
│     Node AbortController Timeout = 25s                                           │
└─────────────────────────────────────────┼────────────────────────────────────────┘
                                          │ POST JSON Payload
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE APPS SCRIPT WEB APP                               │
│                                                                                  │
│  1. Xác thực Shared-Secret: payload.secret === SCRIPT_SECRET                      │
│  2. Khóa Concurrency: LockService.getScriptLock().waitLock(10000) (10s max)      │
│  3. Mở/Tạo Tab tháng: "ChamCong_YYYY_MM" & Ép định dạng '@' cho Cột A            │
│  4. In-Memory Reconcile Map: So khớp Key "YYYY-MM-DD_MãNV"                       │
│  5. So sánh Timestamp: Chỉ ghi đè nếu new.updatedAt >= existing.updatedAt        │
│  6. Batch Write 1 lần duy nhất: sheet.getRange().setValues()                     │
│  7. Cập nhật Tab Tổng Hợp Năm: "TongHop_YYYY"                                    │
│  8. Release Lock & Trả lời HTTP 200 JSON                                         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Bảo Mật & Xác Thực Webhook (Security & Authentication)

### 4.1. Cơ chế Shared-Secret Token
- **Cấu hình Backend (`.env` hoặc `settings`):**
  - `GOOGLE_SHEET_SYNC_SECRET`: Mã bí mật ngẫu nhiên (ví dụ: `asol_ts_sec_8f93a1...`).
- **Giao thức gửi:**
  - Mỗi payload gửi từ Backend luôn chứa:
    ```json
    {
      "secret": "asol_ts_sec_8f93a1...",
      "action": "sync_delta",
      "timestamp": "2026-09-02T07:30:00.000Z",
      ...
    }
    ```
- **Xác thực tại Google Apps Script:**
  - Trong Google Apps Script, lưu secret trong `PropertiesService.getScriptProperties().getProperty("SYNC_SECRET")` hoặc khai báo biến hằng số `SCRIPT_SECRET`.
  - Nếu `contents.secret !== SCRIPT_SECRET`, từ chối ngay lập tức với mã lỗi:
    `{ "status": "error", "code": 401, "message": "Unauthorized: Invalid Secret" }`.

---

## 5. Quy Chuẩn Múi Giờ & Định Dạng Cột (Timezone & Data Formatting)

### 5.1. Múi giờ Thống Nhất: `Asia/Ho_Chi_Minh` (UTC+7)
- **Node.js Server:**
  - Các trường giờ `in`, `out` lưu dưới dạng chuỗi cục bộ `HH:mm` (ví dụ: `08:30`, `17:30`).
  - Trường `date` lưu dạng `YYYY-MM-DD`.
  - Trường `updatedAt` lưu chuẩn ISO `YYYY-MM-DDTHH:mm:ss.sssZ`.
- **Google Apps Script (`appsscript.json`):**
  - Cấu hình `"timeZone": "Asia/Ho_Chi_Minh"`.
  - Khi hiển thị timestamp đồng bộ cột I: format thành `YYYY-MM-DD HH:mm:ss` theo giờ Việt Nam.

### 5.2. Ép Định Dạng Cột Ngày (Column A Format Enforcement)
- Khi khởi tạo Tab mới `ChamCong_YYYY_MM`:
  `sheet.getRange("A:A").setNumberFormat('@');`
- Khi ghi dữ liệu: Đảm bảo giá trị ngày luôn là chuỗi thuần `YYYY-MM-DD` (không truyền raw Date object) và gọi `sheet.getRange(2, 1, rows.length, 1).setNumberFormat('@')` để ngăn ngừa Google Sheets tự parse thành Date object nếu người dùng lỡ đổi format cột.

---

## 6. Chiến Lược Khóa & Khớp Nối Timeout (Locking & Timeout Alignment)

### 6.1. Khớp nối Timeout (Timeout Alignment):
- **Phía Google Apps Script:**
  - `lock.waitLock(10000)`: Chờ khóa tối đa **10 giây**.
  - Thời gian xử lý Batch In-Memory: **~1-2 giây**.
  - Tổng thời gian xử lý tối đa của GAS $\approx 12\text{ giây}$.
  - Nếu không lấy được khóa trong 10s $\rightarrow$ Trả về `{ status: "error", code: 503, message: "Lock Timeout: Server Busy" }`.
- **Phía Node.js Backend:**
  - Cấu hình `AbortController` timeout là **25 giây** ($25\text{s} > 12\text{s}$).
  - Đảm bảo Node.js **không bao giờ abort sớm** khi GAS đang trong hàng đợi xử lý hợp lệ.

### 6.2. Trade-off của `LockService.getScriptLock()`:
- `LockService.getScriptLock()` khóa toàn cục trên cấp độ Spreadsheet.
- **Đánh giá Trade-off:** Đối với hệ thống chấm công quy mô ~50 người, mỗi thao tác batch write chỉ chiếm giữ khóa khoảng 0.2 - 0.5 giây. Việc serialize toàn bộ request giúp triệt tiêu hoàn toàn race conditions giữa các tab mà không gây nghẽn hàng đợi đáng kể.

---

## 7. Cấu Trúc Bảng Tính & Thuật Toán Google Apps Script

### 7.1. Cấu Trúc Tab Chấm Công Tháng: `ChamCong_YYYY_MM`
| Cột | Tên Cột | Định Dạng | Mô tả |
| :--- | :--- | :--- | :--- |
| **A** | Ngày | Text (`@`) | `YYYY-MM-DD` |
| **B** | Mã TTS | Text (`@`) | Mã nhân viên (`TTS01`, `KHANH`,...) |
| **C** | Họ và Tên | Text | Tên nhân viên |
| **D** | Giờ Vào | Text (`@`) | `HH:mm` (hoặc rỗng) |
| **E** | Giờ Ra | Text (`@`) | `HH:mm` (hoặc rỗng) |
| **F** | Tổng Giờ | Number (`0.00`) | Số giờ thực tế đã trừ trưa (ví dụ `7.50`) |
| **G** | Hình Thức | Text | `Onsite` / `Remote` / `Nghỉ` |
| **H** | Ghi Chú | Text | Nội dung công việc |
| **I** | Cập Nhật Lúc | Text (`@`) | `YYYY-MM-DD HH:mm:ss` (Giờ VN) |

### 7.2. Cấu Trúc Tab Tổng Hợp Năm: `TongHop_YYYY`
| Cột | Tên Cột | Định Dạng | Mô tả |
| :--- | :--- | :--- | :--- |
| **A** | Tháng | Text (`@`) | `YYYY-MM` |
| **B** | Mã TTS | Text (`@`) | Mã nhân viên |
| **C** | Họ và Tên | Text | Tên nhân viên |
| **D** | Tổng Giờ Làm | Number (`0.00`) | Tích lũy giờ làm trong tháng |
| **E** | Ngày Onsite | Number (`0`) | Số ngày Onsite |
| **F** | Ngày Remote | Number (`0`) | Số ngày Remote |
| **G** | Ngày Nghỉ | Number (`0`) | Số ngày Nghỉ |

---

## 8. Thuật Toán Cập Nhật & Đối Soát Chi Tiết

### 8.1. Thuật toán `upsertEntriesToSheet` (kèm Timestamp Conflict Check)
```javascript
function upsertEntriesToSheet(sheet, entries) {
  const lastRow = sheet.getLastRow();
  const existingValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 9).getValues() : [];
  
  // In-Memory Index Map: Key -> { rowIndex, updatedAt }
  const rowMap = new Map();
  existingValues.forEach((row, idx) => {
    const normDate = normalizeDateStr(row[0]);
    const empCode = String(row[1]).trim().toUpperCase();
    const existingUpdatedAt = parseDateToTime(row[8]);
    if (normDate && empCode) {
      rowMap.set(`${normDate}_${empCode}`, { idx, updatedAt: existingUpdatedAt });
    }
  });

  entries.forEach((entry) => {
    const normDate = normalizeDateStr(entry.date);
    const empCode = String(entry.employeeCode || entry.employeeId).trim().toUpperCase();
    const key = `${normDate}_${empCode}`;
    const newUpdatedAt = parseDateToTime(entry.updatedAt || new Date().toISOString());

    const rowData = [
      normDate,
      empCode,
      entry.employeeName || "",
      entry.in || "",
      entry.out || "",
      entry.workHours !== undefined ? entry.workHours : "",
      entry.mode || "Onsite",
      entry.note || "",
      formatDateTimeVN(entry.updatedAt || new Date())
    ];

    if (rowMap.has(key)) {
      const existing = rowMap.get(key);
      // Chỉ ghi đè nếu bản ghi mới có timestamp >= timestamp bản ghi hiện có trên Sheet
      if (newUpdatedAt >= existing.updatedAt) {
        existingValues[existing.idx] = rowData;
        existing.updatedAt = newUpdatedAt;
      }
    } else {
      rowMap.set(key, { idx: existingValues.length, updatedAt: newUpdatedAt });
      existingValues.push(rowData);
    }
  });

  // Sắp xếp tăng dần theo Ngày & Mã TTS
  existingValues.sort((a, b) => (String(a[0]) + String(a[1])).localeCompare(String(b[0]) + String(b[1])));

  if (existingValues.length > 0) {
    sheet.getRange(2, 1, existingValues.length, 9).setValues(existingValues);
    sheet.getRange(2, 1, existingValues.length, 1).setNumberFormat('@'); // Ép cứng Text cột A
  }
}
```

### 8.2. Thuật toán Cập Nhật `TongHop_YYYY`
- **Khi Full Month Sync (`action: "sync_month"`):**
  - Backend đã tính toán sẵn mảng `summary` chính xác từ cơ sở dữ liệu.
  - GAS chỉ cần đọc Tab `TongHop_YYYY`, xóa/thay thế các dòng của `month` tương ứng và ghi mảng `summary` mới bằng 1 lệnh batch.
- **Khi Delta Sync (`action: "sync_delta"` hoặc `sync_entry`):**
  - Để tránh tính sai tổng hợp do delta chỉ chứa một vài bản ghi, GAS sẽ **tính toán lại tổng hợp tháng trực tiếp từ toàn bộ dữ liệu trong Tab `ChamCong_YYYY_MM`** hiện có trên RAM, sau đó cập nhật lại các dòng tương ứng của tháng đó trong `TongHop_YYYY`.
  - Điều này đảm bảo Tab `TongHop_YYYY` **luôn luôn khớp 100%** với dữ liệu thực tế trên `ChamCong_YYYY_MM`.

---

## 9. Xử Lý Lỗi Vận Hành & Edge Cases (Operational Resilience)

| Trường Hợp Lỗi (Edge Case) | Hành Vi Hệ Thống & Cách Xử Lý |
| :--- | :--- |
| **Lỗi Lock Timeout (503)** | GAS trả về `{ status: "error", code: 503, message: "Lock timeout" }`. Backend ghi log cảnh báo, không cập nhật `last_sheet_sync_at` để lần Cron Job sau tự động sync lại. |
| **Sai Secret (401)** | GAS trả về `{ status: "error", code: 401 }`. Backend log lỗi bảo mật nghiêm trọng. |
| **Tab tháng bị Admin xóa/đổi tên thủ công** | GAS kiểm tra `getSheetByName("ChamCong_YYYY_MM")`. Nếu không tìm thấy, tự động gọi `setupMonthlySheet` tái tạo lại tab mới với Header chuẩn và format `@`. |
| **Network Failure / Timeout** | Node.js `AbortController (25s)` bắt lỗi `AbortError` $\rightarrow$ Trả về `{ success: false, error: "Timeout" }` an toàn, không làm crash app. |
| **Google Apps Script Quota Exceeded** | Backend bắt mã lỗi HTTP 429/500 từ Google, lưu log và chờ chu kỳ sync định kỳ tiếp theo. |

---

## 10. Kế Hoạch Kiểm Thử Toàn Diện (Comprehensive Test Plan)

1. **Unit Tests (`test/test_sync.js`):**
   - Kiểm thử logic tính toán `aggregateMonthSummary`.
   - Kiểm thử cơ chế High-Watermark `updated_at` (bỏ qua bản ghi cũ, chỉ lấy delta).
   - Kiểm thử Secret Token được inject đúng trong payload.
2. **Integration & Concurrency Tests:**
   - Test gửi 2 request song song đến mock server xác nhận thứ tự timestamp.
   - Test out-of-order payloads (payload cũ gửi sau không được đè payload mới).
3. **Google Apps Script Manual Verification:**
   - Deploy script mới lên Google Sheet thực tế.
   - Chạy Test connection $\rightarrow$ Sync Entry $\rightarrow$ Sync Delta $\rightarrow$ Sync Month.
   - Kiểm tra trực tiếp trên Google Sheet: Tab `ChamCong_2026_09` và `TongHop_2026` hiển thị chuẩn định dạng, không lệch ngày, không có dòng trùng.
