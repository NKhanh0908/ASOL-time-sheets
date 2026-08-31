# Google Spreadsheet Sync Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate bidirectional/real-time attendance and monthly batch summary synchronization from Timesheet App into Google Spreadsheets via Google Apps Script Webhook.

**Architecture:** Non-blocking async webhook dispatcher in Node.js/Express backend triggered by real-time check-in/out mutations and on-demand monthly sync requests; dual-mode storage (Supabase/local JSON) for settings with `.env` fallback; standalone Google Apps Script web app handling `sync_entry`, `sync_month`, and `test_connection`; Admin UI modal for URL configuration and connection testing, with one-click monthly sync button on the Monthly Summary tab.

**Tech Stack:** Node.js, Express, Native ES6 Modules, Google Apps Script (JavaScript), Supabase PostgreSQL / Local JSON DB, Native Fetch API.

**Spec:** [`docs/superpowers/specs/2026-08-31-google-sheets-sync-design.md`](file:///D:/Working/ASOL/tool/timesheet-app/docs/superpowers/specs/2026-08-31-google-sheets-sync-design.md)

---

## Global Constraints

- Backend must execute real-time webhook calls asynchronously without blocking or delaying client check-in/out API responses.
- Database settings must use existing `db.getSetting` / `db.setSetting` abstraction supporting both Supabase and `data/db.json`.
- Webhook URL fallback must check `process.env.GOOGLE_SHEET_WEBHOOK_URL` if not set in database.
- Settings management and manual month sync must be protected by `requireAdmin` middleware and restricted to Admin users in frontend UI.
- All new UI elements must support full Vietnamese and English localization through `public/js/i18n.js`.
- No new heavy external dependencies; use native Node.js `fetch` / `crypto` and native ES6 modules in browser.

---

### Task 1: Google Apps Script Webhook Template & Standalone Script

**Files:**
- Create: `scripts/google_apps_script.js`
- Test: `test/test_sync.js`

**Interfaces:**
- Consumes: Google Apps Script Webhook payloads (`sync_entry`, `sync_month`, `test_connection`).
- Produces: Google Apps Script `doPost(e)` entry point writing to `NhatKy_ChamCong` and `TongHop_Thang` sheets.

- [ ] **Step 1: Write Google Apps Script handler template**

Create `scripts/google_apps_script.js` with functions:
- `doPost(e)`: Main HTTP POST dispatcher.
- `handleTestConnection(data)`: Validates connectivity and returns `{ status: "success", message: "Kết nối Google Sheet thành công!" }`.
- `handleSyncEntry(data)`: Upserts a row in sheet `NhatKy_ChamCong` matching `[Date, EmployeeId]`.
- `handleSyncMonth(data)`: Upserts monthly attendance records in `NhatKy_ChamCong` and updates the aggregated employee summary table in `TongHop_Thang`.
- `setupSheets(ss)`: Ensures sheets and styled header rows exist.

```javascript
/**
 * Google Apps Script Web App for ASOL Timesheet Sync
 * Deploy as Web App: Execute as "Me", Who has access: "Anyone"
 */
function doPost(e) {
  try {
    const contents = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = contents.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets(ss);

    if (action === "test_connection") {
      return jsonResponse({ status: "success", message: "Kết nối Google Sheet thành công!", timestamp: contents.timestamp });
    }

    if (action === "sync_entry") {
      const result = handleSyncEntry(ss, contents.entry);
      return jsonResponse({ status: "success", action: "sync_entry", result });
    }

    if (action === "sync_month") {
      const result = handleSyncMonth(ss, contents.month, contents.entries || [], contents.summary || []);
      return jsonResponse({ status: "success", action: "sync_month", result });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function setupSheets(ss) {
  let entrySheet = ss.getSheetByName("NhatKy_ChamCong");
  if (!entrySheet) {
    entrySheet = ss.insertSheet("NhatKy_ChamCong");
    entrySheet.appendRow(["Ngày", "Mã NV", "Tên NV", "Giờ Vào", "Giờ Ra", "Tổng Giờ", "Hình Thức", "Ghi Chú", "Cập Nhật Lúc"]);
    entrySheet.getRange("A1:I1").setFontWeight("bold").setBackground("#e9ecef");
  }

  let summarySheet = ss.getSheetByName("TongHop_Thang");
  if (!summarySheet) {
    summarySheet = ss.insertSheet("TongHop_Thang");
    summarySheet.appendRow(["Tháng", "Mã NV", "Tên NV", "Tổng Giờ Làm", "Số Ngày Onsite", "Số Ngày Remote", "Số Ngày Nghỉ"]);
    summarySheet.getRange("A1:G1").setFontWeight("bold").setBackground("#e9ecef");
  }
}

function handleSyncEntry(ss, entry) {
  if (!entry || !entry.date || !entry.employeeId) return { updated: false, error: "Missing entry info" };
  const sheet = ss.getSheetByName("NhatKy_ChamCong");
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    const rowDate = String(data[i][0]).substring(0, 10);
    const rowEmpId = String(data[i][1]);
    if (rowDate === String(entry.date) && rowEmpId === String(entry.employeeId)) {
      foundRow = i + 1;
      break;
    }
  }

  const rowValues = [
    entry.date,
    entry.employeeId,
    entry.employeeName || "",
    entry.in || "",
    entry.out || "",
    entry.workHours !== undefined ? entry.workHours : "",
    entry.mode || "Onsite",
    entry.note || "",
    entry.updatedAt || new Date().toISOString()
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    return { row: foundRow, type: "updated" };
  } else {
    sheet.appendRow(rowValues);
    return { row: sheet.getLastRow(), type: "inserted" };
  }
}

function handleSyncMonth(ss, month, entries, summary) {
  entries.forEach(entry => handleSyncEntry(ss, entry));

  const sumSheet = ss.getSheetByName("TongHop_Thang");
  const sumData = sumSheet.getDataRange().getValues();
  
  // Remove existing rows for the same month
  for (let i = sumData.length - 1; i >= 1; i--) {
    if (String(sumData[i][0]) === String(month)) {
      sumSheet.deleteRow(i + 1);
    }
  }

  // Append new summary rows
  summary.forEach(s => {
    sumSheet.appendRow([
      month,
      s.employeeId,
      s.employeeName,
      s.totalHours || 0,
      s.onsiteDays || 0,
      s.remoteDays || 0,
      s.offDays || 0
    ]);
  });

  return { month, entryCount: entries.length, summaryCount: summary.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/google_apps_script.js
git commit -m "feat(sync): add Google Apps Script webhook integration script"
```

---

### Task 2: Backend Sync Service, Settings & Sync API Endpoints

**Files:**
- Modify: `server.js`
- Create: `test/test_sync.js`

**Interfaces:**
- Consumes: `db.getSetting`, `db.setSetting`, `process.env.GOOGLE_SHEET_WEBHOOK_URL`.
- Produces: 
  - `GET /api/settings`
  - `POST /api/settings`
  - `POST /api/sync/test`
  - `POST /api/sync/month`
  - `sendGoogleSheetWebhook(payload)` async helper invoked on `POST /api/entries` and `PUT /api/entries/:id`.

- [ ] **Step 1: Write failing test in `test/test_sync.js`**

Create `test/test_sync.js` testing:
1. `calculateHours` / `aggregateMonthSummary` utility logic.
2. Webhook payload formatting for `sync_entry` and `sync_month`.
3. Non-blocking error handling when webhook URL is invalid or unreachable.

```javascript
process.env.NODE_ENV = "test";
const assert = require("assert");
const app = require("../server");

async function runSyncTests() {
  console.log("Running Google Sheet Sync Backend Test Suite...");

  // 1. Test payload generator helper
  assert.ok(typeof app.buildSyncEntryPayload === "function", "buildSyncEntryPayload must be exported");
  const sampleEntry = {
    date: "2026-08-31",
    employeeId: "emp-1",
    in: "08:30",
    out: "17:30",
    mode: "Onsite",
    note: "Completed tasks"
  };
  const payload = app.buildSyncEntryPayload(sampleEntry, "Nguyễn Văn A");
  assert.strictEqual(payload.action, "sync_entry");
  assert.strictEqual(payload.entry.employeeName, "Nguyễn Văn A");
  assert.strictEqual(payload.entry.workHours, 7.5);

  // 2. Test month summary calculation helper
  assert.ok(typeof app.aggregateMonthSummary === "function", "aggregateMonthSummary must be exported");
  const employees = [{ id: "emp-1", name: "Nguyễn Văn A" }, { id: "emp-2", name: "Trần Thị B" }];
  const entries = [
    { date: "2026-08-01", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Onsite" },
    { date: "2026-08-02", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Remote" },
    { date: "2026-08-03", employeeId: "emp-1", in: "", out: "", mode: "Nghỉ" },
    { date: "2026-08-01", employeeId: "emp-2", in: "08:30", out: "12:30", mode: "Onsite" }
  ];
  const summary = app.aggregateMonthSummary(employees, entries);
  assert.strictEqual(summary.length, 2);
  assert.strictEqual(summary[0].totalHours, 15);
  assert.strictEqual(summary[0].onsiteDays, 1);
  assert.strictEqual(summary[0].remoteDays, 1);
  assert.strictEqual(summary[0].offDays, 1);
  assert.strictEqual(summary[1].totalHours, 4);

  // 3. Test non-blocking dispatch with invalid URL
  let threw = false;
  try {
    await app.sendGoogleSheetWebhook({ action: "test" }, "http://invalid-url-that-does-not-exist.local");
  } catch {
    threw = true;
  }
  assert.strictEqual(threw, false, "sendGoogleSheetWebhook must catch errors internally and never throw");

  console.log("✅ Sync backend test suite passed successfully!");
}

runSyncTests().catch((err) => {
  console.error("❌ Sync backend test failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test_sync.js`
Expected: FAIL with "buildSyncEntryPayload is not a function"

- [ ] **Step 3: Implement Webhook helper and API routes in `server.js`**

Add helper functions and endpoints to `server.js`:
1. `calculateWorkHours(inTime, outTime, mode)`: Logic for calculating hours with 1h30 lunch deduction when $> 5$h.
2. `buildSyncEntryPayload(entry, employeeName)`
3. `aggregateMonthSummary(employees, entries)`
4. `getEffectiveWebhookConfig()`: Reads from DB, falls back to `process.env.GOOGLE_SHEET_WEBHOOK_URL`.
5. `sendGoogleSheetWebhook(payload, customUrl)`: Safe async HTTP POST using native `fetch` with 5000ms timeout, wrapped in `try/catch`.
6. Routes:
   - `GET /api/settings` (protected by `requireAdmin`)
   - `POST /api/settings` (protected by `requireAdmin`)
   - `POST /api/sync/test` (protected by `requireAdmin`)
   - `POST /api/sync/month` (protected by `requireAdmin`)
7. Wire `sendGoogleSheetWebhook` non-blocking in `POST /api/entries` and `PUT /api/entries/:id`.
8. Export helpers on `app` object for tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_sync.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js test/test_sync.js
git commit -m "feat(api): implement Google Sheet sync endpoints, async webhook dispatcher, and test suite"
```

---

### Task 3: Frontend API & Localization (i18n)

**Files:**
- Modify: `public/js/api.js`
- Modify: `public/js/i18n.js`

**Interfaces:**
- Consumes: REST endpoints `/api/settings`, `/api/sync/test`, `/api/sync/month`.
- Produces: 
  - `fetchSettings()`, `updateSettings(data)`, `testSyncConnection(url)`, `syncMonthToGoogleSheets(month)` exported from `public/js/api.js`.
  - Translation keys in `public/js/i18n.js` (`vi` and `en`).

- [ ] **Step 1: Update `public/js/api.js`**

Add exported functions to `public/js/api.js`:
```javascript
// Settings & Sync API
export async function fetchSettings() {
  return api("/api/settings");
}

export async function updateSettings(settings) {
  return api("/api/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export async function testSyncConnection(url) {
  return api("/api/sync/test", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function syncMonthToGoogleSheets(month) {
  return api("/api/sync/month", {
    method: "POST",
    body: JSON.stringify({ month }),
  });
}
```

- [ ] **Step 2: Update `public/js/i18n.js`**

Add translation keys to both `vi` and `en` dictionaries in `public/js/i18n.js`:
- `settingsModalTitle`: "Cài đặt & Tích hợp" / "Settings & Integrations"
- `googleSheetSyncSection`: "Tích hợp Google Spreadsheet" / "Google Spreadsheet Integration"
- `labelWebhookUrl`: "Google Apps Script Webhook URL" / "Google Apps Script Webhook URL"
- `placeholderWebhookUrl`: "https://script.google.com/macros/s/.../exec" / "https://script.google.com/macros/s/.../exec"
- `labelEnableSync`: "Tự động đồng bộ khi chấm công (Real-time)" / "Auto-sync on check-in/out (Real-time)"
- `btnTestConnection`: "Kiểm tra kết nối" / "Test Connection"
- `btnSaveSettings`: "Lưu cài đặt" / "Save Settings"
- `btnSyncGoogleSheet`: "Đồng bộ Google Sheet" / "Sync to Google Sheets"
- `testingConnection`: "Đang kiểm tra kết nối..." / "Testing connection..."
- `savingSettings`: "Đang lưu cài đặt..." / "Saving settings..."
- `settingsSaved`: "Đã lưu cài đặt thành công!" / "Settings saved successfully!"
- `syncingMonth`: "Đang đồng bộ dữ liệu tháng..." / "Syncing month data..."
- `syncMonthSuccess`: "Đồng bộ Google Sheet thành công!" / "Google Sheet synced successfully!"

- [ ] **Step 3: Verify existing tests pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/js/api.js public/js/i18n.js
git commit -m "feat(client): add sync API wrappers and i18n localization dictionaries"
```

---

### Task 4: Admin Settings Modal & Header UI

**Files:**
- Create: `public/js/modals/settingsModal.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: `fetchSettings`, `updateSettings`, `testSyncConnection` from `public/js/api.js`, `showToast` from `public/js/utils/ui.js`.
- Produces: `initSettingsModal()` exported from `public/js/modals/settingsModal.js`.

- [ ] **Step 1: Create `public/js/modals/settingsModal.js`**

Implement `initSettingsModal()` and `openSettingsModal()`:
- Fetches current settings on modal open.
- Wires "Kiểm tra kết nối" button to `testSyncConnection(urlInput.value)` with loading spinner and status badge.
- Wires "Lưu cài đặt" to `updateSettings({ googleSheetWebhookUrl, googleSheetSyncEnabled })`.
- Displays feedback via `showToast()`.

- [ ] **Step 2: Update `public/index.html`**

1. Add Settings gear button in header inside `.header-right` with class `admin-only` and `id="openSettingsBtn"`:
```html
<button id="openSettingsBtn" class="action-btn admin-only" data-i18n-title="settingsModalTitle" title="Cài đặt">
  ⚙️
</button>
```
2. Add Settings Modal container markup `#settingsModal` with form inputs (Webhook URL, auto-sync toggle, test connection button, save button, close button).

- [ ] **Step 3: Update `public/styles.css`**

Add CSS styles for Settings modal:
- Modal layout, form fields, toggle switch styling (`.switch-label`, `.toggle-checkbox`).
- Test result banner indicator (success / error).

- [ ] **Step 4: Wire in `public/js/main.js`**

Import and call `initSettingsModal()` in `public/js/main.js`.

- [ ] **Step 5: Run tests to ensure no regressions**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/js/modals/settingsModal.js public/index.html public/styles.css public/js/main.js
git commit -m "feat(ui): add admin settings modal for Google Sheet sync configuration"
```

---

### Task 5: Monthly Summary Sync Button & Trigger UI

**Files:**
- Modify: `public/js/tabs/tongHop.js`
- Modify: `public/styles.css`

**Interfaces:**
- Consumes: `syncMonthToGoogleSheets(month)` from `public/js/api.js`, `showToast` from `public/js/utils/ui.js`, `t` from `public/js/i18n.js`.
- Produces: Action bar button "📤 Đồng bộ Google Sheet" on Monthly Summary tab.

- [ ] **Step 1: Update `public/js/tabs/tongHop.js`**

1. Add "📤 Đồng bộ Google Sheet" button markup next to `#monthInput` with class `btn-sync-sheet admin-only` and `id="syncMonthBtn"`.
2. In `initTongHopTab()`, wire click event on `#syncMonthBtn`:
   - Retrieves selected month from `#monthInput`.
   - Disables button and displays loading spinner.
   - Calls `syncMonthToGoogleSheets(month)`.
   - Shows top-center toast with count of synced entries on success.
   - Restores button state on finish/error.

- [ ] **Step 2: Update `public/styles.css`**

Add button styling for `.btn-sync-sheet` matching the vintage ledger theme with responsive flex wrapping for mobile screens.

- [ ] **Step 3: Verify existing tests pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/js/tabs/tongHop.js public/styles.css
git commit -m "feat(ui): add Google Sheet monthly batch sync button on summary tab"
```

---

### Task 6: Automated Verification & Documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Test: `test/test_api.js`, `test/test_e2e_calc.js`, `test/test_sync.js`

**Interfaces:**
- Consumes: Full test suite.
- Produces: Updated `npm test` script and README documentation for Google Sheets setup.

- [ ] **Step 1: Update `package.json`**

Update `scripts.test`:
```json
"test": "node test/test_api.js && node test/test_e2e_calc.js && node test/test_sync.js"
```

- [ ] **Step 2: Update `README.md`**

Add section: **"📊 Tích Hợp Google Spreadsheet Sync"** with step-by-step setup instructions for deploying the Google Apps Script Web App.

- [ ] **Step 3: Run complete test suite**

Run: `npm test`
Expected: PASS with all 3 test suites passing.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "docs: add Google Sheet sync setup guide and include sync tests in npm test"
```
