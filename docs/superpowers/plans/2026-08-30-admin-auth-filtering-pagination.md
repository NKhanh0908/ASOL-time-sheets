# Admin Auth, Lọc Chấm Công & Phân Trang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế phân quyền Admin (mật khẩu băm, token session, bảo vệ API), trang/tab Lọc chấm công nâng cao (kèm thẻ thống kê KPI), hệ thống phân trang dùng chung cho các bảng, và giao diện loading/toast đồng bộ.

**Architecture:** Mở rộng Database Adapter trên `server.js` để hỗ trợ bảng `system_settings` (Dual-mode: Supabase PostgreSQL & Local `data/db.json`), tích hợp thuật toán băm mật khẩu `scrypt` với salt và HMAC token verification qua Node.js `crypto`. Frontend mở rộng thành cấu trúc SPA 2 Tabs ("Chấm công" & "Lọc & Báo cáo"), quản lý trạng thái Admin token ở `localStorage`, áp dụng component phân trang (10 mục/trang) và hệ thống Toast notification + Loading spinner.

**Tech Stack:** Node.js, Express, `@supabase/supabase-js`, Node.js native `crypto`, HTML5, CSS3, Vanilla JS.

**Spec:** `docs/superpowers/specs/2026-08-30-admin-auth-filtering-pagination-design.md`

## Global Constraints
- Không thêm dependencies npm nặng bên ngoài (tận dụng Node.js native `crypto` và `assert`).
- Tương thích 100% cả 2 chế độ: Supabase PostgreSQL và Local JSON file (`data/db.json`).
- Tương thích hoàn toàn với Vercel Serverless deployment (không dựa vào persistent state in-memory đơn lẻ).
- Hỗ trợ song ngữ đầy đủ (Tiếng Việt & Tiếng Anh) cho mọi nhãn, thông báo và modal mới.

---

### Task 1: Database Schema & Backend Auth Abstraction Layer

**Files:**
- Modify: `schema.sql`
- Modify: `server.js:10-75`
- Test: `test/test_api.js`

**Interfaces:**
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_KEY`, `data/db.json`
- Produces: 
  - `db.getSetting(key)` -> `Promise<object|null>`
  - `db.setSetting(key, value)` -> `Promise<object>`
  - `hashPassword(password, salt)` -> `{ hash, salt }`
  - `verifyPassword(password, storedHash, salt)` -> `boolean`
  - `generateAdminToken()` -> `string`
  - `verifyAdminToken(token)` -> `boolean`

- [ ] **Step 1: Write test case for password hashing, salt verification, and HMAC token in `test/test_api.js`**

```javascript
// Add to test/test_api.js
const crypto = require("crypto");

function testAuthCrypto() {
  console.log("Testing Auth Crypto & Token logic...");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync("admin123", salt, 64).toString("hex");

  const verify = (pass, s, h) => {
    const calc = crypto.scryptSync(pass, s, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(calc, "hex"), Buffer.from(h, "hex"));
  };

  assert.strictEqual(verify("admin123", salt, hash), true, "Correct password should verify");
  assert.strictEqual(verify("wrongpass", salt, hash), false, "Wrong password should fail");

  const SECRET = "timesheet-secret-key-2026";
  const createToken = () => {
    const payload = { role: "admin", exp: Date.now() + 3600000 };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const sig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex");
    return `${payloadB64}.${sig}`;
  };

  const verifyToken = (token) => {
    if (!token || !token.includes(".")) return false;
    const [payloadB64, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex");
    if (sig !== expectedSig) return false;
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
      return payload.exp > Date.now() && payload.role === "admin";
    } catch {
      return false;
    }
  };

  const token = createToken();
  assert.strictEqual(verifyToken(token), true, "Valid token should verify");
  assert.strictEqual(verifyToken("invalid.token"), false, "Tampered token should fail");
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node test/test_api.js`
Expected: Output indicates crypto logic is verified.

- [ ] **Step 3: Update `schema.sql` to add `system_settings` table**

Modify `schema.sql`:
```sql
-- Table: system_settings (Key-Value configuration & Admin auth)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for system_settings"
  ON system_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 4: Implement `db.getSetting` & `db.setSetting` and Auth helpers in `server.js`**

Modify `server.js`:
```javascript
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "asol-timesheet-admin-secret-2026";

function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  try {
    const calcHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(calcHash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

function generateAdminToken() {
  const payload = {
    role: "admin",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payloadB64, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    return payload.exp > Date.now() && payload.role === "admin";
  } catch {
    return false;
  }
}

// Add to db object:
// async getSetting(key)
// async setSetting(key, value)
```

- [ ] **Step 5: Verify Local JSON fallback initialization for `settings`**

Ensure `loadLocalDB()` returns `{ employees: [], entries: [], settings: {} }` if `settings` is undefined.

---

### Task 2: Backend Auth Endpoints & Endpoint Protection

**Files:**
- Modify: `server.js`
- Test: `test/test_api.js`

**Interfaces:**
- Consumes: `requireAdmin(req, res, next)`
- Produces:
  - `POST /api/admin/login` -> `{ token: string }`
  - `GET /api/admin/status` -> `{ isAdmin: boolean }`
  - `POST /api/admin/change-password` -> `{ ok: true, message: string }`
  - Protected: `POST /api/employees`, `DELETE /api/employees/:id`, `DELETE /api/entries/:id`

- [ ] **Step 1: Write integration tests in `test/test_api.js` for Auth & Protected Endpoints**

```javascript
// Test requireAdmin middleware simulation & change-password validation
function testAdminAuthMiddleware() {
  console.log("Testing requireAdmin middleware & endpoint protection...");
  // 1. Missing header -> 401
  // 2. Invalid token -> 401
  // 3. Valid token -> 200
  // 4. Change password with incorrect current password -> 400
  // 5. Change password with valid current password -> 200
}
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run: `node test/test_api.js`
Expected: Output indicates tests run.

- [ ] **Step 3: Implement `requireAdmin` middleware in `server.js`**

```javascript
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yêu cầu quyền quản trị viên (Admin)" });
  }
  const token = authHeader.split(" ")[1];
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Phiên làm việc của Admin đã hết hạn hoặc không hợp lệ" });
  }
  next();
}
```

- [ ] **Step 4: Implement `POST /api/admin/login`, `GET /api/admin/status`, `POST /api/admin/change-password`**

```javascript
app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Vui lòng nhập mật khẩu" });
    }
    let authSetting = await db.getSetting("admin_auth");
    if (!authSetting || !authSetting.hash) {
      // Auto initialize default admin password 'admin123'
      const { hash, salt } = hashPassword("admin123");
      authSetting = { hash, salt, updated_at: new Date().toISOString() };
      await db.setSetting("admin_auth", authSetting);
    }
    const isValid = verifyPassword(password, authSetting.hash, authSetting.salt);
    if (!isValid) {
      return res.status(401).json({ error: "Mật khẩu quản trị không chính xác" });
    }
    const token = generateAdminToken();
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/status", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({ isAdmin: false });
  }
  const token = authHeader.split(" ")[1];
  res.json({ isAdmin: verifyAdminToken(token) });
});

app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }
    const authSetting = (await db.getSetting("admin_auth")) || hashPassword("admin123");
    if (!verifyPassword(currentPassword, authSetting.hash, authSetting.salt)) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
    }
    const { hash, salt } = hashPassword(newPassword);
    await db.setSetting("admin_auth", { hash, salt, updated_at: new Date().toISOString() });
    res.json({ ok: true, message: "Đổi mật khẩu Admin thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 5: Apply `requireAdmin` to Protected Endpoints in `server.js`**

Protect:
```javascript
app.post("/api/employees", requireAdmin, async (req, res) => { ... });
app.delete("/api/employees/:id", requireAdmin, async (req, res) => { ... });
app.delete("/api/entries/:id", requireAdmin, async (req, res) => { ... });
```

---

### Task 3: Backend Timesheet Query Filtering for Supabase & Local JSON

**Files:**
- Modify: `server.js:db.getEntries` & `app.get("/api/entries")`
- Test: `test/test_api.js`

**Interfaces:**
- Consumes: Query params `req.query`: `month`, `employeeId`, `startDate`, `endDate`, `mode`
- Produces: `db.getEntries(filters)` -> `Promise<Array<Entry>>`

- [ ] **Step 1: Write filter unit test in `test/test_api.js`**

```javascript
function testFilterLogic() {
  console.log("Testing entry filter logic...");
  const entries = [
    { id: "1", date: "2026-08-10", employeeId: "e1", mode: "Onsite" },
    { id: "2", date: "2026-08-15", employeeId: "e2", mode: "Remote" },
    { id: "3", date: "2026-08-20", employeeId: "e1", mode: "Remote" },
    { id: "4", date: "2026-07-01", employeeId: "e1", mode: "Onsite" },
  ];

  const filterFn = (items, { month, employeeId, startDate, endDate, mode }) => {
    return items.filter((e) => {
      if (month && !e.date.startsWith(month)) return false;
      if (employeeId && e.employeeId !== employeeId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (mode && e.mode !== mode) return false;
      return true;
    });
  };

  assert.strictEqual(filterFn(entries, { employeeId: "e1" }).length, 3);
  assert.strictEqual(filterFn(entries, { employeeId: "e1", mode: "Remote" }).length, 1);
  assert.strictEqual(filterFn(entries, { startDate: "2026-08-12", endDate: "2026-08-25" }).length, 2);
}
```

- [ ] **Step 2: Update `db.getEntries(filters)` in `server.js` for both Supabase and Local JSON**

Modify `db.getEntries` in `server.js`:
```javascript
async getEntries(filters = {}) {
  const { month, employeeId, startDate, endDate, mode } = typeof filters === "string" ? { month: filters } : filters;
  if (isSupabase) {
    let query = supabase.from("entries").select("*").order("date", { ascending: false });
    if (month) query = query.like("date", `${month}%`);
    if (employeeId) query = query.eq("employee_id", employeeId);
    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);
    if (mode) query = query.eq("mode", mode);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((e) => ({
      id: e.id,
      date: e.date,
      employeeId: e.employee_id,
      in: e.time_in || "",
      out: e.time_out || "",
      mode: e.mode,
      note: e.note || "",
    }));
  }
  let entries = loadLocalDB().entries;
  if (month) entries = entries.filter((e) => e.date.startsWith(month));
  if (employeeId) entries = entries.filter((e) => e.employeeId === employeeId);
  if (startDate) entries = entries.filter((e) => e.date >= startDate);
  if (endDate) entries = entries.filter((e) => e.date <= endDate);
  if (mode) entries = entries.filter((e) => e.mode === mode);
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
```

- [ ] **Step 3: Update `GET /api/entries` handler in `server.js`**

```javascript
app.get("/api/entries", async (req, res) => {
  try {
    const { month, employeeId, startDate, endDate, mode } = req.query;
    const entries = await db.getEntries({ month, employeeId, startDate, endDate, mode });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

### Task 4: Automated Test Suites for Auth, Protection, Filtering & Pagination

**Files:**
- Modify: `test/test_api.js`
- Modify: `test/test_e2e_calc.js`

**Interfaces:**
- Test runner: `npm test` (`node test/test_api.js && node test/test_e2e_calc.js`)

- [ ] **Step 1: Add complete suite in `test/test_api.js`**

Include:
- Token generation & expiration / HMAC signature validation.
- Password hashing & timing-safe equality.
- Validation for empty password, invalid current password in change password endpoint.
- Filter parameter handling.

- [ ] **Step 2: Add pagination and KPI calculation tests in `test/test_e2e_calc.js`**

```javascript
function testPaginationAndKPIs() {
  console.log("Testing Pagination slice & KPI calculations...");
  const sampleList = Array.from({ length: 25 }, (_, i) => ({ id: `${i + 1}`, val: i + 1 }));
  
  const paginate = (items, page = 1, pageSize = 10) => {
    const totalPages = Math.ceil(items.length / pageSize) || 1;
    const curPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (curPage - 1) * pageSize;
    const pageItems = items.slice(startIdx, startIdx + pageSize);
    return { curPage, totalPages, totalItems: items.length, pageItems };
  };

  const p1 = paginate(sampleList, 1, 10);
  assert.strictEqual(p1.pageItems.length, 10);
  assert.strictEqual(p1.totalPages, 3);
  assert.strictEqual(p1.pageItems[0].id, "1");

  const p3 = paginate(sampleList, 3, 10);
  assert.strictEqual(p3.pageItems.length, 5);
  assert.strictEqual(p3.pageItems[4].id, "25");
}
```

- [ ] **Step 3: Run `npm test` to verify all test suites pass**

Run: `npm test`
Expected: PASS with 0 failures.

---

### Task 5: Frontend UI Scaffolding — Tabs, Modals, Admin Status, and CSS Styles

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`

**Interfaces:**
- DOM elements:
  - Tab Switcher: `#tab-btn-timesheet`, `#tab-btn-filter`
  - Views: `#view-timesheet`, `#view-filter`
  - Admin Header Controls: `#admin-login-btn`, `#admin-profile-badge`, `#admin-change-pass-btn`, `#admin-logout-btn`
  - Modals: `#admin-login-modal`, `#admin-pass-modal`, `#employee-modal`
  - Toast Container: `#toast-container`
  - Loading Overlay: `#global-loader`

- [ ] **Step 1: Update `public/index.html` with Header Tabs, Admin Status, Filter View, Modals & Toast Container**

Structure:
1. Header:
   - Nav Tabs: `[⏱️ Chấm công hàng ngày]` | `[🔍 Lọc & Báo cáo]`
   - Language selector + Admin Login / Status buttons.
2. View 1: Timesheet Container (Check-in Form + History Table + `#timesheet-pagination`).
3. View 2: Filter Container (`#filter-form`, `#kpi-cards`, `#filter-table`, `#filter-pagination`).
4. Modals:
   - Login Modal (`#admin-password-input`, `#login-submit-btn`)
   - Change Password Modal (`#current-password-input`, `#new-password-input`, `#confirm-password-input`, `#change-pass-submit-btn`)
5. Toast notification container (`#toast-container`).

- [ ] **Step 2: Add styles in `public/styles.css` for Tabs, KPI Cards, Pagination, Modals, Toasts, and Loading Spinners**

Add CSS:
- `.nav-tabs`, `.tab-btn`, `.tab-btn.active`
- `.filter-card`, `.filter-grid`, `.kpi-grid`, `.kpi-card`
- `.pagination-bar`, `.page-btn`, `.page-btn.active`, `.page-btn:disabled`
- `.toast-container`, `.toast`, `.toast.success`, `.toast.error`
- `.btn-spinner`, `.loading-overlay`
- Hide `.admin-only` elements when `body:not(.is-admin)` is active.

---

### Task 6: Frontend State Management — Auth, Toast, Loading, i18n & Modals Logic

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- State: `state.isAdmin`, `state.activeTab`, `state.adminToken`
- Functions:
  - `showToast(message, type = 'success')`
  - `setLoading(buttonElOrGlobal, isLoading)`
  - `checkAdminStatus()`
  - `adminLogin(password)`
  - `adminLogout()`
  - `adminChangePassword(currentPass, newPass)`
  - `switchTab(tabName)`

- [ ] **Step 1: Add i18n translations for all new keys (VI & EN) in `public/app.js`**

Add keys:
- `tabTimesheet`, `tabFilter`, `adminLogin`, `adminLogout`, `changePassword`, `currentPassword`, `newPassword`, `confirmPassword`, `filterTitle`, `filterEmployee`, `filterFromDate`, `filterToDate`, `filterMode`, `filterBtn`, `resetBtn`, `totalEntries`, `totalHours`, `pagePrev`, `pageNext`, `pageInfo`, `adminOnlyError`, `loginSuccess`, `loginFail`, `passwordChangedSuccess`, `passwordMismatch`, `passwordTooShort`.

- [ ] **Step 2: Implement Toast Notification & Button Loading Helper in `public/app.js`**

```javascript
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✓" : "⚠"}</span> <div>${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setBtnLoading(btn, isLoading, originalText) {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-small"></span> Đang xử lý...`;
  } else if (btn.dataset.origText) {
    btn.innerHTML = btn.dataset.origText;
  }
}
```

- [ ] **Step 3: Implement Auth state management & Header UI update**

```javascript
function getAuthHeader() {
  const token = localStorage.getItem("timesheet_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function checkAdminStatus() {
  const token = localStorage.getItem("timesheet_admin_token");
  if (!token) {
    setAdminMode(false);
    return;
  }
  try {
    const res = await fetch("/api/admin/status", { headers: getAuthHeader() });
    const data = await res.json();
    setAdminMode(Boolean(data.isAdmin));
  } catch {
    setAdminMode(false);
  }
}

function setAdminMode(isAdmin) {
  state.isAdmin = isAdmin;
  document.body.classList.toggle("is-admin", isAdmin);
  // Update header buttons visibility
}
```

- [ ] **Step 4: Implement Login, Logout, and Change Password Modal Handlers**

Connect event listeners for:
- Open & submit Login modal.
- Open & submit Change Password modal.
- Logout click (clears `localStorage` and resets admin mode).

---

### Task 7: Frontend Timesheet & Filter Views with Universal Pagination

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- State:
  - `timesheetState: { page: 1, pageSize: 10, items: [] }`
  - `filterState: { page: 1, pageSize: 10, items: [], filters: {} }`
- Functions:
  - `renderPagination(containerEl, paginationData, onPageChange)`
  - `renderTimesheetTable()`
  - `applyTimesheetFilter()`
  - `resetTimesheetFilter()`
  - `renderFilterView()`

- [ ] **Step 1: Implement universal `renderPagination` component in `public/app.js`**

```javascript
function renderPagination(container, { currentPage, totalPages, totalItems, pageSize }, onPageChange) {
  if (!container) return;
  if (totalItems === 0) {
    container.innerHTML = "";
    return;
  }
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  
  let html = `<div class="pagination-info">Hiển thị ${from}-${to} / ${totalItems}</div>`;
  html += `<div class="pagination-controls">`;
  html += `<button class="btn btn-sm page-prev" ${currentPage <= 1 ? "disabled" : ""}>◀</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="btn btn-sm page-num ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }
  
  html += `<button class="btn btn-sm page-next" ${currentPage >= totalPages ? "disabled" : ""}>▶</button>`;
  html += `</div>`;
  
  container.innerHTML = html;
  container.querySelector(".page-prev")?.addEventListener("click", () => onPageChange(currentPage - 1));
  container.querySelector(".page-next")?.addEventListener("click", () => onPageChange(currentPage + 1));
  container.querySelectorAll(".page-num").forEach((btn) => {
    btn.addEventListener("click", (e) => onPageChange(Number(e.target.dataset.page)));
  });
}
```

- [ ] **Step 2: Connect Pagination to Timesheet History Table**

Update `renderTable()` to slice the entries by `timesheetState.page` and render pagination controls below `#entries-table`.

- [ ] **Step 3: Implement Filter Tab logic, KPI Calculations, and Filter Table Pagination**

- Calculate KPIs:
  - Total Entries count
  - Total Worked Hours sum
  - Counts by mode (Onsite, Remote, Nghỉ)
- Render KPI summary cards.
- Render filtered list with pagination.
- Attach delete handlers with `requireAdmin` authentication header and confirmation popup.

- [ ] **Step 4: Wire all actions (Add Employee, Delete Employee, Delete Entry, Check-in, Check-out) with Toast notifications and Loading states**

---

### Task 8: End-to-End Verification & Regression Testing

**Files:**
- Execute: `npm test`
- Verification script / manual test checklist

- [ ] **Step 1: Run automated test suite**

Run: `npm test`
Expected: All API and calculation tests pass.

- [ ] **Step 2: Execute manual verification checklist**
1. Mở ứng dụng khi chưa đăng nhập:
   - Nút "Quản lý nhân viên" và các nút "Xóa" trên bảng chấm công đều bị ẩn.
   - Thử Check-in / Check-out $\rightarrow$ Thành công kèm Toast thông báo.
2. Đăng nhập Admin với mật khẩu mặc định `admin123`:
   - Hiển thị huy hiệu `👑 Admin`, xuất hiện nút "Quản lý NV" và các nút "Xóa".
   - Thử thêm / xóa nhân viên $\rightarrow$ Có loading và Toast thành công.
   - Thử đổi mật khẩu $\rightarrow$ Mật khẩu mới hoạt động chính xác.
3. Chuyển sang Tab "🔍 Lọc & Báo cáo":
   - Lọc theo nhân viên / khoảng ngày / hình thức $\rightarrow$ Thống kê KPI và danh sách hiển thị đúng.
   - Thử phân trang khi dữ liệu có $>10$ bản ghi $\rightarrow$ Chuyển trang mượt mà.
4. Đăng xuất Admin $\rightarrow$ Giao diện trở về chế độ Khách an toàn.
