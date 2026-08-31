# Google Spreadsheet Sync Integration Design Specification

- **Date:** 2026-08-31
- **Status:** Approved / Spec
- **Target Repository:** `timesheet-app` (ASOL)

---

## 1. Overview & Business Goals

The **Google Spreadsheet Sync** feature enables the Timesheet application to automatically replicate intern attendance data and monthly timesheet summaries into a designated Google Spreadsheet via an HTTP Webhook (Google Apps Script Web App).

### Key Objectives:
1. **Real-time Event Synchronization:** Automatically post attendance updates (Check-in, Check-out, Leave/Off) to Google Sheets as soon as they are recorded.
2. **On-demand Batch Sync:** Allow administrators to trigger a one-click synchronization of an entire month's data (both raw entries and monthly employee summary calculations).
3. **Flexible URL Configuration:** Support configuring the Webhook URL via Admin UI (stored in DB/settings) with fallback to `GOOGLE_SHEET_WEBHOOK_URL` in `.env`.
4. **Dual Sheet Layout:** Organize the Google Spreadsheet into two dedicated sheets:
   - `NhatKy_ChamCong` (Daily Attendance Log / Entries).
   - `TongHop_Thang` (Monthly Summary KPIs & aggregated hours per employee).
5. **Fault Tolerance & Non-blocking Execution:** Real-time webhooks execute asynchronously in the background. Failures do not block or fail user check-in operations.

---

## 2. Architecture & Data Flow

```
[ Frontend Client ]
   │
   ├─► Check-in / Check-out / Off ──────────┐
   │                                        │
   └─► Admin: "Sync Month" button ─────┐    │
                                       ▼    ▼
                              [ Express Server (server.js) ]
                                       │
                                       ├─► Local DB / Supabase DB
                                       │
                                       └─► [ Webhook Sync Service ] (Async fetch)
                                                │
                                                ▼ (HTTP POST JSON)
                                 [ Google Apps Script Web App ]
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                         Sheet: NhatKy_ChamCong   Sheet: TongHop_Thang
```

---

## 3. Detailed Specifications

### 3.1. Settings & Storage Model

#### Database Schema / Table (`settings`)
- **Key-Value Store:**
  - Key: `google_sheet_webhook_url` (Text: Webhook URL string).
  - Key: `google_sheet_sync_enabled` (Boolean string: `"true"` / `"false"`).
- **Dual DB Adapter Support:**
  - In `data/db.json`: Stored under root property `"settings": { "googleSheetWebhookUrl": "", "googleSheetSyncEnabled": true }`.
  - In Supabase PostgreSQL: Table `settings (key text primary key, value text, updated_at timestamp with time zone default now())`.

#### Environment Variable Fallback
- If `google_sheet_webhook_url` is empty in the database, the server reads `process.env.GOOGLE_SHEET_WEBHOOK_URL`.

---

### 3.2. Backend API Endpoints

#### 1. `GET /api/settings`
- **Auth:** Requires Admin token (`requireAdmin`).
- **Response:**
  ```json
  {
    "googleSheetWebhookUrl": "https://script.google.com/macros/s/.../exec",
    "googleSheetSyncEnabled": true,
    "hasEnvFallback": true
  }
  ```

#### 2. `POST /api/settings`
- **Auth:** Requires Admin token (`requireAdmin`).
- **Request Body:**
  ```json
  {
    "googleSheetWebhookUrl": "https://script.google.com/macros/s/.../exec",
    "googleSheetSyncEnabled": true
  }
  ```
- **Response:** Updated settings object.

#### 3. `POST /api/sync/test`
- **Auth:** Requires Admin token (`requireAdmin`).
- **Request Body:** Optional `{ url: "..." }` to test a new unsaved URL, or tests the currently saved URL.
- **Behavior:** Sends `{ action: "test_connection", timestamp: "..." }` to the target Google Apps Script URL.
- **Response:** `{ success: true, message: "Kết nối Google Sheet thành công!" }` or HTTP 400/502 with error details.

#### 4. `POST /api/sync/month`
- **Auth:** Requires Admin token (`requireAdmin`).
- **Request Body:** `{ month: "2026-08" }`
- **Behavior:**
  1. Fetches all entries for the specified month from the database.
  2. Aggregates monthly summary KPIs for each employee (total hours, onsite days, remote days, off days).
  3. Dispatches `{ action: "sync_month", month: "2026-08", entries: [...], summary: [...] }` to Google Apps Script.
- **Response:** `{ success: true, count: 25, message: "Đồng bộ tháng 2026-08 thành công!" }`.

---

### 3.3. Webhook Payload Specifications

#### Action 1: `sync_entry` (Real-time Event)
Sent asynchronously upon creation or update of an entry:
```json
{
  "action": "sync_entry",
  "entry": {
    "date": "2026-08-31",
    "employeeId": "emp-uuid-1",
    "employeeName": "Nguyễn Văn A",
    "in": "08:30",
    "out": "17:30",
    "workHours": 7.5,
    "mode": "Onsite",
    "note": "Xong task",
    "updatedAt": "2026-08-31T14:30:00.000Z"
  }
}
```

#### Action 2: `sync_month` (Batch Sync Event)
```json
{
  "action": "sync_month",
  "month": "2026-08",
  "entries": [
    {
      "date": "2026-08-31",
      "employeeId": "emp-uuid-1",
      "employeeName": "Nguyễn Văn A",
      "in": "08:30",
      "out": "17:30",
      "workHours": 7.5,
      "mode": "Onsite",
      "note": "Xong task"
    }
  ],
  "summary": [
    {
      "employeeId": "emp-uuid-1",
      "employeeName": "Nguyễn Văn A",
      "totalHours": 160.0,
      "onsiteDays": 20,
      "remoteDays": 2,
      "offDays": 0
    }
  ]
}
```

#### Action 3: `test_connection`
```json
{
  "action": "test_connection",
  "source": "timesheet-app",
  "timestamp": "2026-08-31T14:30:00.000Z"
}
```

---

### 3.4. Google Apps Script Web App Template (`scripts/google_apps_script.js`)

A clean, standalone Apps Script script implementing `doPost(e)`:
- Initializes sheets `NhatKy_ChamCong` and `TongHop_Thang` with styled headers if not existing.
- **Handling `sync_entry`:**
  - Searches `NhatKy_ChamCong` for existing row matching `[Date, EmployeeId]`.
  - If found: Updates columns (Giờ Ra, Tổng Giờ, Hình Thức, Ghi Chú, Cập Nhật Lúc).
  - If not found: Appends a new row `[Ngày, Mã NV, Tên NV, Giờ Vào, Giờ Ra, Tổng Giờ, Hình Thức, Ghi Chú, Cập Nhật Lúc]`.
- **Handling `sync_month`:**
  - Clears/Replaces existing rows for that `month` in `NhatKy_ChamCong` or updates in place.
  - Rewrites the `TongHop_Thang` sheet section for that `month` with the aggregated summary table.
- Returns `ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON)`.

---

### 3.5. Frontend User Interface

1. **Admin Settings Modal (`public/js/modals/settingsModal.js`):**
   - Accessible via Settings gear icon or Admin dropdown in header.
   - Input: **Google Sheet Webhook URL**.
   - Toggle: **Bật/Tắt tự động đồng bộ (Auto Sync)**.
   - Button: **"Kiểm tra kết nối"** (shows loading spinner $\rightarrow$ green check / red error message).
   - Button: **"Lưu cài đặt"**.

2. **Monthly Summary Tab (`public/js/tabs/tongHop.js`):**
   - Action bar: Add **"📤 Đồng bộ Google Sheet"** button next to month picker.
   - Triggers `POST /api/sync/month`, displays Top-Center Toast with success/error outcome.

3. **Internationalization (`public/js/i18n.js`):**
   - Add translation keys for both Vietnamese and English:
     - `modalSettingsTitle`, `labelWebhookUrl`, `btnTestConnection`, `btnSyncGoogleSheet`, `syncSuccessToast`, `syncErrorToast`, etc.

---

## 4. Error Handling & Edge Cases

| Scenario | Handling Strategy |
|---|---|
| Webhook URL not configured | Skip real-time sync silently; disable/warn on manual sync button. |
| Google Apps Script times out / network error | Log error on server without crashing or failing the user's check-in response. |
| Invalid Webhook URL during Test Connection | Return HTTP 400 with user-friendly error toast explaining the issue. |
| Re-check-in / Checkout updates existing entry | `sync_entry` sends the full updated entry; Apps Script matches by `(Date, EmployeeId)` and updates the row. |
| Employee with no entries in month | Summary calculation outputs 0 hours and reflects 0 days accurately. |

---

## 5. Verification & Testing Plan

1. **Unit & API Testing (`test/test_sync.js`):**
   - Test Settings retrieval, update, and env fallback.
   - Test payload creation for `sync_entry` and `sync_month` calculations.
   - Test mock Webhook dispatch and error resilience.
2. **E2E Testing:**
   - Test connection to Google Apps Script Web App.
   - Perform Check-in and Check-out; verify row appears/updates in `NhatKy_ChamCong`.
   - Trigger "Đồng bộ Google Sheet" on Month view; verify both sheets are populated accurately.
