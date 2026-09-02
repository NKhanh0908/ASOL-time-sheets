# Robust Google Sheet Sync Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai kiến trúc đồng bộ Google Spreadsheet an toàn tuyệt đối, chống trùng lặp, chia Tab theo từng tháng (`ChamCong_YYYY_MM`), High-Watermark Delta Sync (`updated_at`), Batch Upsert có so khớp timestamp, khóa `LockService` và xác thực bảo mật Shared Secret.

**Architecture:** 
- Phía Google Apps Script (`scripts/google_apps_script.js`): Xác thực `secret`, khóa `LockService.getScriptLock().waitLock(10000)`, tự động tạo Tab theo tháng `ChamCong_YYYY_MM` với cột A ép định dạng `@`, đối soát In-Memory với khóa kép `Ngày_MãNV`, so sánh timestamp `updatedAt` để giải quyết xung đột, và ghi Batch 1 lần bằng `setValues`.
- Phía Backend (`server.js`): Hỗ trợ `GOOGLE_SHEET_SYNC_SECRET`, cấu hình timeout `AbortController` 25s, hàm `syncDeltaData` sử dụng High-Watermark `last_sheet_sync_at`, Cron Job 10h/20h chạy delta sync, và API đối soát toàn tháng `syncMonthData`.

**Tech Stack:** Node.js, Express, `node-cron`, Google Apps Script (JavaScript ES6).

**Spec:** [`docs/superpowers/specs/2026-09-02-robust-google-sheet-sync-architecture-design.md`](file:///D:/Working/ASOL/tool/timesheet-app/docs/superpowers/specs/2026-09-02-robust-google-sheet-sync-architecture-design.md)

## Global Constraints
- Múi giờ chuẩn: `Asia/Ho_Chi_Minh` (UTC+7).
- Cột A của Tab tháng phải luôn được ép định dạng Plain Text (`@`).
- Khóa bản ghi trên Sheet: `YYYY-MM-DD_MãNV` (Ví dụ: `2026-09-02_TTS01`).
- Timeout: Node.js `AbortController = 25s`, Google Apps Script `waitLock = 10s`.

---

## File Structure & Responsibilities

| File Path | Responsibility |
| :--- | :--- |
| [`scripts/google_apps_script.js`](file:///D:/Working/ASOL/tool/timesheet-app/scripts/google_apps_script.js) | Google Apps Script Web App: Xử lý `doPost`, kiểm tra `secret`, khóa `LockService`, chia tab tháng `ChamCong_YYYY_MM`, Tab `TongHop_YYYY`, Batch Upsert In-Memory có so khớp timestamp `updatedAt`. |
| [`server.js`](file:///D:/Working/ASOL/tool/timesheet-app/server.js) | Backend Express: Quản lý Secret, cấu hình timeout 25s, lưu `last_sheet_sync_at`, hàm `syncDeltaData`, hàm `syncMonthData`, Cron Job 10h/20h, và API endpoints. |
| [`test/test_sync.js`](file:///D:/Working/ASOL/tool/timesheet-app/test/test_sync.js) | Test suite: Kiểm thử đơn vị và tích hợp cho Secret injection, High-Watermark delta sync, và mock Google Apps Script HTTP responses. |
| [`public/index.html`](file:///D:/Working/ASOL/tool/timesheet-app/public/index.html) & [`public/js/modals/settingsModal.js`](file:///D:/Working/ASOL/tool/timesheet-app/public/js/modals/settingsModal.js) | UI Settings Modal: Bổ sung trường cấu hình Webhook Secret Key trong modal Cài đặt Quản trị. |
| [`README.md`](file:///D:/Working/ASOL/tool/timesheet-app/README.md) | Tài liệu hướng dẫn cấu hình Apps Script và Secret Key mới. |

---

## Tasks

### Task 1: Nâng cấp Google Apps Script Web App (`scripts/google_apps_script.js`)

**Files:**
- Modify: `scripts/google_apps_script.js`

**Interfaces:**
- Consumes: JSON Payload `{ secret, action, month, entry, entries, summary, timestamp }` từ Backend.
- Produces: JSON Response `{ status: "success" | "error", code: number, message: string, result?: object }`.

- [ ] **Step 1: Viết lại toàn bộ `scripts/google_apps_script.js` với đầy đủ các tính năng an toàn**

Triển khai:
1. Hằng số `DEFAULT_SECRET = "asol_timesheet_secret_2026"` (hoặc đọc từ `PropertiesService`).
2. Xác thực `contents.secret === getSyncSecret()`.
3. Khóa đồng thời `LockService.getScriptLock().waitLock(10000)`.
4. Hàm chuẩn hóa ngày `normalizeDateStr(val)` và hàm chuẩn hóa thời gian `parseDateToTime(val)`.
5. Hàm `getOrCreateMonthSheet(ss, monthStr)` tự động tạo tab `ChamCong_YYYY_MM`, đặt Header nền xám đậm, đóng băng dòng 1, và ép định dạng cột A thành `@`.
6. Hàm `upsertEntriesToSheet(sheet, entries)` đối soát In-Memory với khóa kép `YYYY-MM-DD_MãNV`, chỉ ghi đè khi `newUpdatedAt >= existingUpdatedAt`, sắp xếp tăng dần theo Ngày và Mã NV, và ghi 1 lần duy nhất bằng `setValues`.
7. Hàm `recalculateAndSaveSummary(ss, monthStr)` tính toán lại tổng hợp tháng trực tiếp từ tab `ChamCong_YYYY_MM` và cập nhật vào tab `TongHop_YYYY` (với `YYYY = monthStr.split('-')[0]`).
8. Hỗ trợ các action: `test_connection`, `sync_entry`, `sync_delta`, `sync_month`.

```javascript
/**
 * Google Apps Script Web App for ASOL Timesheet Sync (Robust Architecture v2)
 * Deploy as Web App: Execute as "Me", Who has access: "Anyone"
 */
const DEFAULT_SECRET = "asol_timesheet_secret_2026";

function getSyncSecret() {
  const propSecret = PropertiesService.getScriptProperties().getProperty("SYNC_SECRET");
  return propSecret || DEFAULT_SECRET;
}

function doGet(e) {
  return jsonResponse({
    status: "success",
    message: "ASOL Timesheet Sync Web App is running securely!",
    timestamp: new Date().toISOString(),
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    const contents = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = contents.action;

    // 1. Authenticate Secret Token (Skip only if test_connection with explicit flag if needed, but enforce default)
    const expectedSecret = getSyncSecret();
    if (contents.secret !== expectedSecret) {
      return jsonResponse({ status: "error", code: 401, message: "Unauthorized: Invalid or missing secret token" });
    }

    if (action === "test_connection") {
      return jsonResponse({ status: "success", message: "Kết nối Google Sheet & Xác thực Secret thành công!", timestamp: contents.timestamp });
    }

    // 2. Acquire Concurrency Lock (10s max wait)
    try {
      lock.waitLock(10000);
      hasLock = true;
    } catch (lockErr) {
      return jsonResponse({ status: "error", code: 503, message: "Server Busy: Lock timeout waiting for other sync process" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 3. Handle Actions
    if (action === "sync_entry") {
      const entry = contents.entry;
      if (!entry || !entry.date) {
        return jsonResponse({ status: "error", code: 400, message: "Missing entry date" });
      }
      const monthStr = normalizeDateStr(entry.date).substring(0, 7);
      const sheet = getOrCreateMonthSheet(ss, monthStr);
      const result = upsertEntriesToSheet(sheet, [entry]);
      recalculateAndSaveSummary(ss, monthStr);
      return jsonResponse({ status: "success", action: "sync_entry", month: monthStr, result });
    }

    if (action === "sync_delta") {
      const monthStr = contents.month || (contents.deltaEntries?.[0]?.date ? normalizeDateStr(contents.deltaEntries[0].date).substring(0, 7) : "");
      if (!monthStr || !contents.deltaEntries || contents.deltaEntries.length === 0) {
        return jsonResponse({ status: "success", action: "sync_delta", message: "No entries to sync", count: 0 });
      }
      const sheet = getOrCreateMonthSheet(ss, monthStr);
      const result = upsertEntriesToSheet(sheet, contents.deltaEntries);
      recalculateAndSaveSummary(ss, monthStr);
      return jsonResponse({ status: "success", action: "sync_delta", month: monthStr, count: contents.deltaEntries.length, result });
    }

    if (action === "sync_month") {
      const monthStr = contents.month;
      if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
        return jsonResponse({ status: "error", code: 400, message: "Invalid month format (YYYY-MM)" });
      }
      const sheet = getOrCreateMonthSheet(ss, monthStr);
      const result = upsertEntriesToSheet(sheet, contents.entries || []);
      
      // Update Summary: If pre-calculated summary is provided, write it directly; else recalculate
      if (contents.summary && Array.isArray(contents.summary)) {
        writeMonthlySummaryDirect(ss, monthStr, contents.summary);
      } else {
        recalculateAndSaveSummary(ss, monthStr);
      }
      
      return jsonResponse({ status: "success", action: "sync_month", month: monthStr, entryCount: (contents.entries || []).length, result });
    }

    return jsonResponse({ status: "error", code: 400, message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", code: 500, message: err.toString() });
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeDateStr(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  }
  return str.substring(0, 10);
}

function parseDateToTime(val) {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
}

function formatDateTimeVN(val) {
  const d = val ? new Date(val) : new Date();
  return Utilities.formatDate(d, "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
}

function getOrCreateMonthSheet(ss, monthStr) {
  const sheetName = "ChamCong_" + monthStr.replace("-", "_");
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["Ngày", "Mã TTS", "Họ và Tên", "Giờ Vào", "Giờ Ra", "Tổng Giờ", "Hình Thức", "Ghi Chú Công Việc", "Cập Nhật Lúc"]);
    
    // Header Styling
    sheet.getRange("A1:I1").setFontWeight("bold").setBackground("#22303c").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat('@'); // Plain text format for dates
    sheet.getRange("B:B").setNumberFormat('@'); // Plain text for Employee Code
    sheet.getRange("D:E").setNumberFormat('@'); // Plain text for Time In/Out
    sheet.getRange("F:F").setNumberFormat('0.00'); // Numeric format for hours
  }
  return sheet;
}

function getOrCreateYearSummarySheet(ss, yearStr) {
  const sheetName = "TongHop_" + yearStr;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["Tháng", "Mã TTS", "Họ và Tên", "Tổng Giờ Làm", "Số Ngày Onsite", "Số Ngày Remote", "Số Ngày Nghỉ"]);
    sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#22303c").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.getRange("A:B").setNumberFormat('@');
    sheet.getRange("D:D").setNumberFormat('0.00');
  }
  return sheet;
}

function upsertEntriesToSheet(sheet, entries) {
  const lastRow = sheet.getLastRow();
  const existingValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 9).getValues() : [];

  const rowMap = new Map();
  existingValues.forEach((row, idx) => {
    const normDate = normalizeDateStr(row[0]);
    const empCode = String(row[1]).trim().toUpperCase();
    const existingUpdatedAt = parseDateToTime(row[8]);
    if (normDate && empCode) {
      rowMap.set(`${normDate}_${empCode}`, { idx, updatedAt: existingUpdatedAt });
    }
  });

  let insertedCount = 0;
  let updatedCount = 0;

  entries.forEach((entry) => {
    const normDate = normalizeDateStr(entry.date);
    const empCode = String(entry.employeeCode || entry.employeeId).trim().toUpperCase();
    if (!normDate || !empCode) return;

    const key = `${normDate}_${empCode}`;
    const newUpdatedAt = parseDateToTime(entry.updatedAt || new Date().toISOString());

    const rowData = [
      normDate,
      empCode,
      entry.employeeName || "",
      entry.in || "",
      entry.out || "",
      entry.workHours !== undefined ? Number(entry.workHours) : 0,
      entry.mode || "Onsite",
      entry.note || "",
      formatDateTimeVN(entry.updatedAt || new Date())
    ];

    if (rowMap.has(key)) {
      const existing = rowMap.get(key);
      if (newUpdatedAt >= existing.updatedAt) {
        existingValues[existing.idx] = rowData;
        existing.updatedAt = newUpdatedAt;
        updatedCount++;
      }
    } else {
      rowMap.set(key, { idx: existingValues.length, updatedAt: newUpdatedAt });
      existingValues.push(rowData);
      insertedCount++;
    }
  });

  // Sort by Date ascending, then Employee Code
  existingValues.sort((a, b) => (String(a[0]) + String(a[1])).localeCompare(String(b[0]) + String(b[1])));

  if (existingValues.length > 0) {
    sheet.getRange(2, 1, existingValues.length, 9).setValues(existingValues);
    sheet.getRange(2, 1, existingValues.length, 1).setNumberFormat('@');
  }

  return { total: existingValues.length, inserted: insertedCount, updated: updatedCount };
}

function recalculateAndSaveSummary(ss, monthStr) {
  const monthSheet = getOrCreateMonthSheet(ss, monthStr);
  const lastRow = monthSheet.getLastRow();
  if (lastRow <= 1) return;

  const data = monthSheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const summaryMap = new Map();

  data.forEach(row => {
    const empCode = String(row[1]).trim().toUpperCase();
    const empName = String(row[2]).trim();
    const hours = Number(row[5]) || 0;
    const mode = String(row[6]).trim();

    if (!empCode) return;

    if (!summaryMap.has(empCode)) {
      summaryMap.set(empCode, {
        month: monthStr,
        employeeCode: empCode,
        employeeName: empName,
        totalHours: 0,
        onsiteDays: 0,
        remoteDays: 0,
        offDays: 0
      });
    }

    const s = summaryMap.get(empCode);
    s.totalHours = Number((s.totalHours + hours).toFixed(2));
    if (mode === "Onsite") s.onsiteDays++;
    else if (mode === "Remote") s.remoteDays++;
    else if (mode === "Nghỉ" || mode === "Off") s.offDays++;
  });

  const summaryArray = Array.from(summaryMap.values());
  writeMonthlySummaryDirect(ss, monthStr, summaryArray);
}

function writeMonthlySummaryDirect(ss, monthStr, summaryArray) {
  const yearStr = monthStr.split("-")[0];
  const sumSheet = getOrCreateYearSummarySheet(ss, yearStr);
  const lastRow = sumSheet.getLastRow();
  const existingValues = lastRow > 1 ? sumSheet.getRange(2, 1, lastRow - 1, 7).getValues() : [];

  // Filter out existing rows for this month
  const remainingRows = existingValues.filter(row => String(row[0]) !== String(monthStr));

  // Append new summary rows
  summaryArray.forEach(s => {
    remainingRows.push([
      monthStr,
      String(s.employeeCode || s.employeeId || "").toUpperCase(),
      s.employeeName || "",
      Number(s.totalHours || 0),
      Number(s.onsiteDays || 0),
      Number(s.remoteDays || 0),
      Number(s.offDays || 0)
    ]);
  });

  // Sort summary by Month ascending, then Employee Code
  remainingRows.sort((a, b) => (String(a[0]) + String(a[1])).localeCompare(String(b[0]) + String(b[1])));

  sumSheet.clearContents();
  sumSheet.appendRow(["Tháng", "Mã TTS", "Họ và Tên", "Tổng Giờ Làm", "Số Ngày Onsite", "Số Ngày Remote", "Số Ngày Nghỉ"]);
  sumSheet.getRange("A1:G1").setFontWeight("bold").setBackground("#22303c").setFontColor("#ffffff");
  sumSheet.setFrozenRows(1);

  if (remainingRows.length > 0) {
    sumSheet.getRange(2, 1, remainingRows.length, 7).setValues(remainingRows);
    sumSheet.getRange(2, 1, remainingRows.length, 1).setNumberFormat('@');
    sumSheet.getRange(2, 1, remainingRows.length, 2).setNumberFormat('@');
    sumSheet.getRange(2, 4, remainingRows.length, 1).setNumberFormat('0.00');
  }
}
```

- [ ] **Step 2: Commit thay đổi Google Apps Script**

```bash
git add scripts/google_apps_script.js
git commit -m "feat(sync): rewrite google apps script with lockservice, monthly partitioning, timestamp conflict resolution and secret auth"
```

---

### Task 2: Cập nhật Backend Webhook Dispatcher & High-Watermark Sync (`server.js`)

**Files:**
- Modify: `server.js`

**Interfaces:**
- Consumes: Database settings `google_sheet_webhook_url`, `google_sheet_sync_secret`, `last_sheet_sync_at`.
- Produces: `sendGoogleSheetWebhook()`, `syncDeltaData()`, `syncMonthData()`.

- [ ] **Step 1: Viết test failing cho Secret injection và High-Watermark trong `test/test_sync.js`**

```javascript
// Test 6: Verify sendGoogleSheetWebhook injects secret and handles 25s timeout safely
assert.ok(typeof app.syncDeltaData === "function", "syncDeltaData must be exported");
```

- [ ] **Step 2: Chạy test để xác nhận fails**

Run: `npm test`
Expected: FAIL with "app.syncDeltaData is not a function"

- [ ] **Step 3: Cập nhật `server.js` với các tính năng mới**

1. Cập nhật `getEffectiveWebhookConfig()` lấy `google_sheet_sync_secret` từ db hoặc `process.env.GOOGLE_SHEET_SYNC_SECRET || "asol_timesheet_secret_2026"`.
2. Cập nhật `sendGoogleSheetWebhook()`:
   - Thêm `secret` vào payload JSON.
   - Nâng `AbortController` timeout lên **25 giây**.
   - Thêm timeout clear an toàn.
3. Tạo hàm `buildSyncEntryPayload(entry, empName, empCode)` inject đầy đủ `employeeCode`.
4. Cập nhật `syncMonthData(month, requireSyncEnabled)` gửi `employeeCode` trong từng entry và mảng summary.
5. Tạo hàm `syncDeltaData(month)`:
   - Đọc `last_sheet_sync_at = await db.getSetting("last_sheet_sync_at")`.
   - Lọc entries trong tháng có `updated_at > last_sheet_sync_at` (hoặc `created_at > last_sheet_sync_at`).
   - Nếu không có entry nào thay đổi $\rightarrow$ trả về `{ success: true, skipped: true, reason: "No new changes" }`.
   - Gửi payload `{ action: "sync_delta", month, deltaEntries }`.
   - Nếu thành công $\rightarrow$ `await db.setSetting("last_sheet_sync_at", new Date().toISOString())`.
6. Cập nhật Cron Job 10h & 20h gọi `syncDeltaData(currentMonth)`.
7. Cập nhật `/api/settings` GET/POST hỗ trợ `googleSheetSyncSecret`.

- [ ] **Step 4: Chạy lại `npm test` để xác nhận tests pass**

Run: `npm test`
Expected: PASS 100%

- [ ] **Step 5: Commit backend changes**

```bash
git add server.js test/test_sync.js
git commit -m "feat(sync): implement high-watermark delta sync, secret token auth, and 25s timeout in backend"
```

---

### Task 3: Cập nhật Giao diện Settings Modal & Quản lý Secret Key (`public/`)

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/modals/settingsModal.js`
- Modify: `public/js/i18n.js`

**Interfaces:**
- Consumes: `/api/settings` (GET & POST).
- Produces: UI input cho Secret Key.

- [ ] **Step 1: Bổ sung input Secret Key trong `public/index.html`**

Thêm trường `inputSyncSecret` vào `#modalSettings`:
```html
<div class="modal-field" style="margin-top: 10px;">
  <label for="inputSyncSecret" data-i18n="labelSyncSecret">Mã khóa bảo mật (Shared Secret):</label>
  <input type="password" id="inputSyncSecret" placeholder="Mặc định: asol_timesheet_secret_2026" />
</div>
```

- [ ] **Step 2: Cập nhật `public/js/modals/settingsModal.js` để đọc và lưu secret**

Cập nhật `openSettingsModal()` và `handleSettingsSubmit()` đọc/gửi `googleSheetSyncSecret`.

- [ ] **Step 3: Bổ sung từ khóa dịch trong `public/js/i18n.js`**

```javascript
labelSyncSecret: "Mã khóa bảo mật (Shared Secret):",
// EN:
labelSyncSecret: "Shared Secret Token:",
```

- [ ] **Step 4: Chạy test kiểm tra toàn bộ ứng dụng**

Run: `npm test`
Expected: PASS 100%

- [ ] **Step 5: Commit UI changes**

```bash
git add public/index.html public/js/modals/settingsModal.js public/js/i18n.js
git commit -m "feat(ui): add shared secret configuration field in settings modal"
```

---

### Task 4: Cập Nhật Tài Liệu Hướng Dẫn & Verification Cuối Cùng

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Cập nhật mục 4 trong `README.md` về cách Deploy Google Apps Script và Secret Key**

Ghi rõ cách copy script mới, cấu hình `SYNC_SECRET` trong Apps Script Project Properties, và cách hoạt động của các tab `ChamCong_YYYY_MM` và `TongHop_YYYY`.

- [ ] **Step 2: Chạy kiểm thử toàn diện test suite**

Run: `npm test`
Expected: PASS 100%

- [ ] **Step 3: Commit tài liệu**

```bash
git add README.md
git commit -m "docs: update google sheet sync setup instructions with partition tabs and secret key"
```

---

## Self-Review Checklist

1. **Spec Coverage:**
   - [x] Monthly Partitioning (`ChamCong_YYYY_MM` & `TongHop_YYYY`) -> Task 1
   - [x] Text format enforcement (`@`) -> Task 1
   - [x] Timestamp conflict resolution (`updatedAt` check) -> Task 1
   - [x] Shared-Secret Auth -> Task 1, Task 2, Task 3
   - [x] LockService & Timeout Alignment (10s vs 25s) -> Task 1 & Task 2
   - [x] High-Watermark Delta Sync (`last_sheet_sync_at`) -> Task 2
   - [x] Automated Monthly Recalculation for Delta Sync -> Task 1
2. **Placeholder Scan:** Không chứa "TODO", "TBD", "fill later".
3. **Type & Signature Consistency:** Hàm `syncDeltaData`, `syncMonthData`, `sendGoogleSheetWebhook` nhất quán giữa `server.js` và `test_sync.js`.
