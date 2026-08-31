# Frontend Modularization (ES Modules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Refactor monolithic `public/app.js` (~1079 lines) into clean, standalone ES Modules with clear responsibilities, 100% Vite-ready structure, and update `public/index.html` to use native module loading without requiring extra build tools.

**Architecture:** Split frontend into layer-based ES modules (`js/state.js`, `js/i18n.js`, `js/api.js`, `js/utils/time.js`, `js/utils/ui.js`, `js/tabs/*.js`, `js/modals/*.js`, and `js/main.js`). Communication occurs via standard `import/export` and centralized state.

**Tech Stack:** Vanilla JavaScript (ES6+ Modules), HTML5, CSS3, Express backend.

**Spec:** [`docs/superpowers/specs/2026-08-31-frontend-modularization-design.md`](file:///D:/Working/ASOL/tool/timesheet-app/docs/superpowers/specs/2026-08-31-frontend-modularization-design.md)

## Global Constraints

- Must maintain 100% feature parity with existing UI behavior (bilingual VI/EN, lunch deduction, timesheet recording/quick-checkout, filtering with KPIs, admin login/change password, pagination, toast alerts).
- Pure native browser ES Modules (`<script type="module">`) with explicit `.js` relative imports for future Vite compatibility.
- Existing tests (`npm test`) must continue to pass without regression.

---

### Task 1: Core State & Utility Modules (`state.js`, `utils/time.js`, `utils/ui.js`)

**Files:**
- Create: `public/js/state.js`
- Create: `public/js/utils/time.js`
- Create: `public/js/utils/ui.js`
- Test: `test/test_e2e_calc.js`

**Interfaces:**
- `state.js` exports: `state`, `invalidateEntriesCache(monthKey)`
- `utils/time.js` exports: `todayStr()`, `monthKeyOf(dateStr)`, `timeToMinutes(tStr)`, `hoursBetween(inStr, outStr, mode)`, `fmtHours(h)`, `weekdayLabelFor(dateStr)`, `monthLabel(mk)`
- `utils/ui.js` exports: `showToast(message, type)`, `setBtnLoading(btn, isLoading, customText)`, `renderPagination(container, opts, onPageChange)`

- [x] **Step 1: Create `public/js/state.js`**

```javascript
export const state = {
  employees: [],
  entriesCache: {}, // monthKey -> array
  isAdmin: false,
  adminToken: localStorage.getItem("timesheet_admin_token") || null,
  timesheetPage: 1,
  pageSize: 10,
  filterData: {
    items: [],
    page: 1,
    isLoaded: false,
  },
};

export function invalidateEntriesCache(monthKey) {
  if (monthKey) {
    delete state.entriesCache[monthKey];
  } else {
    state.entriesCache = {};
  }
}
```

- [x] **Step 2: Create `public/js/utils/time.js`**

```javascript
import { dict, currentLang } from "../i18n.js";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKeyOf(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}

export function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function hoursBetween(inStr, outStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  const rawMinutes = outMin - inMin;
  const rawHours = rawMinutes / 60;

  // Nếu làm trên 5 tiếng: Tự động trừ 1h30 (90 phút) nghỉ trưa
  if (rawHours > 5) {
    const workedMin = rawMinutes - 90;
    return workedMin > 0 ? workedMin / 60 : 0;
  }

  // Làm nửa buổi (<= 5 tiếng): Không trừ
  return rawHours;
}

export function fmtHours(h) {
  return h.toFixed(2).replace(".", ",") + "h";
}

export function weekdayLabelFor(dateStr) {
  const dayIdx = new Date(dateStr + "T00:00:00").getDay();
  return dict[currentLang].daysOfWeek[dayIdx];
}

export function monthLabel(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-");
  return `${dict[currentLang].monthPrefix} ${parseInt(m, 10)}/${y}`;
}
```

- [x] **Step 3: Create `public/js/utils/ui.js`**

```javascript
import { t } from "../i18n.js";

export function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : "⚠";
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function setBtnLoading(btn, isLoading, customText = "") {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-small"></span> ${customText || t("loading")}`;
  } else if (btn.dataset.origHtml) {
    btn.innerHTML = btn.dataset.origHtml;
  }
}

export function renderPagination(container, { currentPage, totalItems, pageSize }, onPageChange) {
  if (!container) return;
  if (!totalItems || totalItems <= pageSize) {
    container.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const curPage = Math.max(1, Math.min(currentPage, totalPages));
  const from = (curPage - 1) * pageSize + 1;
  const to = Math.min(curPage * pageSize, totalItems);

  let html = `<div class="pagination-bar">`;
  html += `<div class="pagination-info">Hiển thị ${from}-${to} / ${totalItems}</div>`;
  html += `<div class="pagination-controls">`;
  html += `<button type="button" class="page-btn page-prev" ${curPage <= 1 ? "disabled" : ""}>◀</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= curPage - 1 && i <= curPage + 1)) {
      html += `<button type="button" class="page-btn page-num ${i === curPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    } else if (i === curPage - 2 || i === curPage + 2) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  html += `<button type="button" class="page-btn page-next" ${curPage >= totalPages ? "disabled" : ""}>▶</button>`;
  html += `</div></div>`;

  container.innerHTML = html;
  container.querySelector(".page-prev")?.addEventListener("click", () => onPageChange(curPage - 1));
  container.querySelector(".page-next")?.addEventListener("click", () => onPageChange(curPage + 1));
  container.querySelectorAll(".page-num").forEach((btn) => {
    btn.addEventListener("click", (e) => onPageChange(Number(e.target.dataset.page)));
  });
}
```

- [x] **Step 4: Verify syntax and unit test runner**

Run: `npm test`
Expected: PASS

---

### Task 2: i18n & API Client Modules (`i18n.js`, `api.js`)

**Files:**
- Create: `public/js/i18n.js`
- Create: `public/js/api.js`

**Interfaces:**
- `i18n.js` exports: `dict`, `currentLang`, `t(key)`, `setLanguage(lang, callbacks)`, `initI18n(callbacks)`
- `api.js` exports: `api(path, opts)`, `fetchEmployees()`, `createEmployee(name)`, `deleteEmployee(id)`, `fetchEntries(filters)`, `createEntry(entry)`, `updateEntry(id, patch)`, `deleteEntry(id)`, `loginAdmin(password)`, `getAdminStatus()`, `changeAdminPassword(currentPassword, newPassword)`

- [x] **Step 1: Create `public/js/i18n.js`**

```javascript
export const dict = {
  vi: {
    eyebrow: "LEDGER · NỘI BỘ",
    appTitle: "Bảng Chấm Công",
    tabChamCong: "Chấm công",
    tabLocChamCong: "Lọc chấm công",
    tabNhanVien: "Nhân viên",
    tabTongHop: "Tổng hợp",
    selectEmployee: "Chọn nhân viên",
    modeOnsite: "Onsite",
    modeRemote: "Remote",
    modeOff: "Nghỉ",
    labelInTime: "Giờ vào (Sáng)",
    labelOutTime: "Giờ ra (Chiều)",
    placeholderTask: "Công việc hôm nay làm: ...",
    placeholderReason: "Lý do nghỉ (bắt buộc)...",
    placeholderNewEmp: "Tên nhân viên mới",
    btnRecord: "+ Ghi nhận",
    btnCheckin: "⚡ Điểm danh Vào",
    btnCheckout: "🏁 Cập nhật Giờ ra",
    btnQuickCheckout: "🏁 Check-out",
    btnCancel: "Huỷ",
    btnAddEmp: "+ Thêm",
    emptyDay: "Chưa có ai chấm công ngày này.",
    emptyEmp: "Chưa có nhân viên nào.",
    emptySummary: "Chưa có nhân viên nào để tổng hợp.",
    emptyFilter: "Không tìm thấy dữ liệu chấm công phù hợp.",
    loading: "Đang tải...",
    statusWorking: "Đang làm việc",
    lunchDeducted: "Đã trừ 1h30 trưa",
    thEmployee: "NHÂN VIÊN",
    thTotalHours: "TỔNG GIỜ",
    thOnsiteRemote: "ONSITE / REMOTE",
    thOff: "NGHỈ",
    thTotal: "TỔNG CỘNG",
    empCountLabel: "nhân viên",
    deletedEmp: "(đã xoá)",
    errMissingFields: "Vui lòng chọn nhân viên và nhập đầy đủ thông tin!",
    errNoteEmpty: "Ghi chú không được để trống!",
    footerNote: "Dữ liệu lưu trên server nội bộ — mọi người trong team dùng chung một bảng.",
    daysOfWeek: ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"],
    monthPrefix: "Tháng",
    adminLogin: "Admin",
    btnChangePass: "Đổi MK",
    btnLogout: "Đăng xuất",
    modalLoginTitle: "🔐 Đăng nhập Quản trị viên (Admin)",
    labelAdminPass: "Mật khẩu Admin:",
    btnSubmitLogin: "Đăng nhập",
    modalChangePassTitle: "🔑 Đổi mật khẩu Admin",
    labelCurrentPass: "Mật khẩu hiện tại:",
    labelNewPass: "Mật khẩu mới (tối thiểu 6 ký tự):",
    labelConfirmPass: "Xác nhận mật khẩu mới:",
    btnSubmitSave: "Lưu mật khẩu",
    filterLabelEmp: "Nhân viên",
    filterAllEmployees: "-- Tất cả nhân viên --",
    filterLabelFromDate: "Từ ngày",
    filterLabelToDate: "Đến ngày",
    filterLabelMode: "Hình thức",
    filterAllModes: "-- Tất cả hình thức --",
    btnApplyFilter: "🔍 Lọc dữ liệu",
    btnResetFilter: "🔄 Đặt lại",
    kpiTotalDays: "Tổng số công",
    kpiTotalHours: "Tổng giờ làm",
    kpiBreakdown: "Phân loại",
    loginSuccess: "Đăng nhập Admin thành công!",
    logoutSuccess: "Đã đăng xuất tài khoản Admin",
    passChangedSuccess: "Đổi mật khẩu Admin thành công!",
    passMismatch: "Mật khẩu xác nhận không khớp!",
    passTooShort: "Mật khẩu mới phải có ít nhất 6 ký tự!",
    confirmDeleteEntry: "Bạn có chắc muốn xoá bản ghi chấm công này?",
    confirmDeleteEmp: "Bạn có chắc muốn xoá nhân viên này và toàn bộ dữ liệu liên quan?",
    entryDeleted: "Đã xoá bản ghi chấm công",
    empDeleted: "Đã xoá nhân viên",
    empAdded: "Thêm nhân viên thành công",
    entrySaved: "Ghi nhận chấm công thành công",
    entryUpdated: "Cập nhật chấm công thành công",
  },
  en: {
    eyebrow: "LEDGER · INTERNAL",
    appTitle: "Timesheet App",
    tabChamCong: "Timesheet",
    tabLocChamCong: "Filter & Search",
    tabNhanVien: "Employees",
    tabTongHop: "Summary",
    selectEmployee: "Select Employee",
    modeOnsite: "Onsite",
    modeRemote: "Remote",
    modeOff: "Off",
    labelInTime: "Check-in (Morning)",
    labelOutTime: "Check-out (Evening)",
    placeholderTask: "Today's tasks: ...",
    placeholderReason: "Reason for leave (required)...",
    placeholderNewEmp: "New employee name",
    btnRecord: "+ Record",
    btnCheckin: "⚡ Check-in",
    btnCheckout: "🏁 Update Check-out",
    btnQuickCheckout: "🏁 Check-out",
    btnCancel: "Cancel",
    btnAddEmp: "+ Add",
    emptyDay: "No entries for this date.",
    emptyEmp: "No employees added yet.",
    emptySummary: "No employees available for summary.",
    emptyFilter: "No timesheet entries found.",
    loading: "Loading...",
    statusWorking: "Working",
    lunchDeducted: "-1.5h lunch",
    thEmployee: "EMPLOYEE",
    thTotalHours: "TOTAL HOURS",
    thOnsiteRemote: "ONSITE / REMOTE",
    thOff: "OFF",
    thTotal: "GRAND TOTAL",
    empCountLabel: "employees",
    deletedEmp: "(deleted)",
    errMissingFields: "Please select an employee and fill all required fields!",
    errNoteEmpty: "Note cannot be empty!",
    footerNote: "Data saved on internal server — shared across the team.",
    daysOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthPrefix: "Month",
    adminLogin: "Admin",
    btnChangePass: "Change PW",
    btnLogout: "Logout",
    modalLoginTitle: "🔐 Administrator Login",
    labelAdminPass: "Admin Password:",
    btnSubmitLogin: "Login",
    modalChangePassTitle: "🔑 Change Admin Password",
    labelCurrentPass: "Current Password:",
    labelNewPass: "New Password (min 6 chars):",
    labelConfirmPass: "Confirm New Password:",
    btnSubmitSave: "Save Password",
    filterLabelEmp: "Employee",
    filterAllEmployees: "-- All Employees --",
    filterLabelFromDate: "From Date",
    filterLabelToDate: "To Date",
    filterLabelMode: "Work Mode",
    filterAllModes: "-- All Modes --",
    btnApplyFilter: "🔍 Filter Data",
    btnResetFilter: "🔄 Reset",
    kpiTotalDays: "Total Days",
    kpiTotalHours: "Total Hours",
    kpiBreakdown: "Breakdown",
    loginSuccess: "Admin login successful!",
    logoutSuccess: "Logged out from Admin",
    passChangedSuccess: "Admin password updated successfully!",
    passMismatch: "Password confirmation does not match!",
    passTooShort: "New password must be at least 6 characters!",
    confirmDeleteEntry: "Are you sure you want to delete this timesheet entry?",
    confirmDeleteEmp: "Are you sure you want to delete this employee and their entries?",
    entryDeleted: "Timesheet entry deleted",
    empDeleted: "Employee deleted",
    empAdded: "Employee added successfully",
    entrySaved: "Timesheet entry recorded",
    entryUpdated: "Timesheet entry updated",
  },
};

export let currentLang = localStorage.getItem("ts_lang") || "vi";

export function t(key) {
  return dict[currentLang]?.[key] || dict["vi"][key] || key;
}

export function setLanguage(lang, callbacks = {}) {
  currentLang = lang;
  localStorage.setItem("ts_lang", lang);
  const langVi = document.getElementById("langVi");
  const langEn = document.getElementById("langEn");
  if (langVi) langVi.classList.toggle("active", lang === "vi");
  if (langEn) langEn.classList.toggle("active", lang === "en");

  // Update data-i18n text
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (k && t(k)) el.textContent = t(k);
  });

  // Update placeholders
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const k = el.getAttribute("data-i18n-ph");
    if (k && t(k)) el.placeholder = t(k);
  });

  // Trigger optional callbacks to re-render dynamic views
  if (typeof callbacks.onLanguageChange === "function") {
    callbacks.onLanguageChange();
  }
}
```

- [x] **Step 2: Create `public/js/api.js`**

```javascript
import { state } from "./state.js";

function getAuthHeaders() {
  const token = state.adminToken || localStorage.getItem("timesheet_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(opts.headers || {}),
  };

  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Lỗi máy chủ (${res.status})`);
  }
  return res.json();
}

// Employees API
export async function fetchEmployees() {
  return api("/api/employees");
}

export async function createEmployee(name) {
  return api("/api/employees", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteEmployee(id) {
  return api(`/api/employees/${id}`, { method: "DELETE" });
}

// Entries API
export async function fetchEntries(filters = {}) {
  const params = new URLSearchParams();
  if (typeof filters === "string") {
    params.set("month", filters);
  } else {
    if (filters.month) params.set("month", filters.month);
    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.mode) params.set("mode", filters.mode);
  }
  const qs = params.toString();
  return api(`/api/entries${qs ? `?${qs}` : ""}`);
}

export async function createEntry(entry) {
  return api("/api/entries", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function updateEntry(id, patch) {
  return api(`/api/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteEntry(id) {
  return api(`/api/entries/${id}`, { method: "DELETE" });
}

// Admin Auth API
export async function loginAdmin(password) {
  return api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function getAdminStatus() {
  return api("/api/admin/status");
}

export async function changeAdminPassword(currentPassword, newPassword) {
  return api("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
```

- [x] **Step 3: Verification**

Run: `npm test`
Expected: PASS

---

### Task 3: Admin Auth & Modal Module (`modals/adminAuth.js`)

**Files:**
- Create: `public/js/modals/adminAuth.js`

**Interfaces:**
- `modals/adminAuth.js` exports: `initAdminAuth(onAdminStateChange)`, `updateAdminUI()`, `checkAdminStatus(onAdminStateChange)`

- [x] **Step 1: Create `public/js/modals/adminAuth.js`**

```javascript
import { state } from "../state.js";
import { getAdminStatus, loginAdmin, changeAdminPassword } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";

export function updateAdminUI() {
  const guestControls = document.getElementById("guestControls");
  const adminControls = document.getElementById("adminControls");

  if (state.isAdmin) {
    if (guestControls) guestControls.style.display = "none";
    if (adminControls) adminControls.style.display = "flex";
    document.querySelectorAll(".admin-only").forEach((el) => (el.style.display = ""));
  } else {
    if (guestControls) guestControls.style.display = "flex";
    if (adminControls) adminControls.style.display = "none";
    document.querySelectorAll(".admin-only").forEach((el) => {
      if (el.tagName === "BUTTON" && el.classList.contains("tab-btn")) {
        el.style.display = "none";
      } else if (el.classList.contains("del-btn")) {
        el.style.display = "none";
      }
    });
  }
}

export async function checkAdminStatus(onAdminStateChange) {
  if (!state.adminToken) {
    state.isAdmin = false;
    updateAdminUI();
    return;
  }
  try {
    const res = await getAdminStatus();
    state.isAdmin = Boolean(res.isAdmin);
    if (!state.isAdmin) {
      state.adminToken = null;
      localStorage.removeItem("timesheet_admin_token");
    }
  } catch {
    state.isAdmin = false;
  }
  updateAdminUI();
  if (typeof onAdminStateChange === "function") {
    onAdminStateChange(state.isAdmin);
  }
}

export function initAdminAuth(onAdminStateChange) {
  const modalAdminLogin = document.getElementById("modalAdminLogin");
  const modalAdminChangePass = document.getElementById("modalAdminChangePass");
  const formAdminLogin = document.getElementById("formAdminLogin");
  const formAdminChangePass = document.getElementById("formAdminChangePass");

  const btnOpenLoginModal = document.getElementById("btnOpenLoginModal");
  const btnCloseLoginModal = document.getElementById("btnCloseLoginModal");
  const btnCancelLoginModal = document.getElementById("btnCancelLoginModal");

  const btnOpenChangePassModal = document.getElementById("btnOpenChangePassModal");
  const btnCloseChangePassModal = document.getElementById("btnCloseChangePassModal");
  const btnCancelChangePassModal = document.getElementById("btnCancelChangePassModal");
  const btnLogoutAdmin = document.getElementById("btnLogoutAdmin");

  btnOpenLoginModal?.addEventListener("click", () => {
    const passInput = document.getElementById("adminLoginPassword");
    if (passInput) passInput.value = "";
    if (modalAdminLogin) modalAdminLogin.style.display = "flex";
  });

  const closeLogin = () => {
    if (modalAdminLogin) modalAdminLogin.style.display = "none";
  };
  btnCloseLoginModal?.addEventListener("click", closeLogin);
  btnCancelLoginModal?.addEventListener("click", closeLogin);

  btnOpenChangePassModal?.addEventListener("click", () => {
    const cur = document.getElementById("currentPassInput");
    const np = document.getElementById("newPassInput");
    const cp = document.getElementById("confirmPassInput");
    if (cur) cur.value = "";
    if (np) np.value = "";
    if (cp) cp.value = "";
    if (modalAdminChangePass) modalAdminChangePass.style.display = "flex";
  });

  const closeChangePass = () => {
    if (modalAdminChangePass) modalAdminChangePass.style.display = "none";
  };
  btnCloseChangePassModal?.addEventListener("click", closeChangePass);
  btnCancelChangePassModal?.addEventListener("click", closeChangePass);

  window.addEventListener("click", (e) => {
    if (e.target === modalAdminLogin) modalAdminLogin.style.display = "none";
    if (e.target === modalAdminChangePass) modalAdminChangePass.style.display = "none";
  });

  formAdminLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = (document.getElementById("adminLoginPassword")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitAdminLogin");
    setBtnLoading(btnSubmit, true);
    try {
      const res = await loginAdmin(password);
      state.adminToken = res.token;
      state.isAdmin = true;
      localStorage.setItem("timesheet_admin_token", res.token);
      showToast(t("loginSuccess"), "success");
      closeLogin();
      updateAdminUI();
      if (typeof onAdminStateChange === "function") {
        onAdminStateChange(true);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });

  btnLogoutAdmin?.addEventListener("click", () => {
    state.adminToken = null;
    state.isAdmin = false;
    localStorage.removeItem("timesheet_admin_token");
    showToast(t("logoutSuccess"), "success");
    updateAdminUI();
    if (typeof onAdminStateChange === "function") {
      onAdminStateChange(false);
    }
  });

  formAdminChangePass?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = (document.getElementById("currentPassInput")?.value || "").trim();
    const newPassword = (document.getElementById("newPassInput")?.value || "").trim();
    const confirmPassword = (document.getElementById("confirmPassInput")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitChangePass");

    if (newPassword !== confirmPassword) {
      return showToast(t("passMismatch"), "error");
    }
    if (newPassword.length < 6) {
      return showToast(t("passTooShort"), "error");
    }

    setBtnLoading(btnSubmit, true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      showToast(t("passChangedSuccess"), "success");
      closeChangePass();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
```

- [x] **Step 2: Verification**

Run: `npm test`
Expected: PASS

---

### Task 4: Tab Modules (`tabs/chamCong.js`, `tabs/locChamCong.js`, `tabs/nhanVien.js`, `tabs/tongHop.js`)

**Files:**
- Create: `public/js/tabs/chamCong.js`
- Create: `public/js/tabs/locChamCong.js`
- Create: `public/js/tabs/nhanVien.js`
- Create: `public/js/tabs/tongHop.js`

**Interfaces:**
- `chamCong.js` exports: `initChamCongTab(refreshAll)`, `renderEmployeeSelect()`, `renderDayEntries()`, `updateEmpCount()`, `ensureMonthLoaded(monthKey)`
- `locChamCong.js` exports: `initLocChamCongTab()`, `renderFilterEmployeeSelect()`, `renderFilterResults()`
- `nhanVien.js` exports: `initNhanVienTab(onEmployeeListChanged)`, `loadEmployees()`, `renderEmployeeList()`
- `tongHop.js` exports: `initTongHopTab()`, `renderSummary()`

- [x] **Step 1: Create `public/js/tabs/chamCong.js`**

```javascript
import { state, invalidateEntriesCache } from "../state.js";
import { fetchEntries, createEntry, updateEntry, deleteEntry } from "../api.js";
import { t } from "../i18n.js";
import { todayStr, monthKeyOf, timeToMinutes, hoursBetween, fmtHours, weekdayLabelFor } from "../utils/time.js";
import { showToast, setBtnLoading, renderPagination } from "../utils/ui.js";

export function empName(id) {
  return state.employees.find((e) => e.id === id)?.name || t("deletedEmp");
}

export function updateEmpCount() {
  const count = state.employees.length;
  const el = document.getElementById("empCount");
  if (el) el.textContent = `${count} ${t("empCountLabel")}`;
}

export async function ensureMonthLoaded(mk) {
  if (state.entriesCache[mk]) return state.entriesCache[mk];
  const list = await fetchEntries({ month: mk });
  state.entriesCache[mk] = list;
  return list;
}

export function renderEmployeeSelect() {
  const empSelect = document.getElementById("empSelect");
  if (!empSelect) return;
  const keep = empSelect.value;
  empSelect.innerHTML = `<option value="">${t("selectEmployee")}</option>`;
  state.employees.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    empSelect.appendChild(opt);
  });
  empSelect.value = keep;
}

export async function renderDayEntries() {
  const dateInput = document.getElementById("dateInput");
  const weekdayLabel = document.getElementById("weekdayLabel");
  const list = document.getElementById("entryList");
  const paginationContainer = document.getElementById("timesheetPagination");
  if (!dateInput || !list) return;

  const date = dateInput.value;
  if (!date) return;
  if (weekdayLabel) weekdayLabel.textContent = weekdayLabelFor(date);

  const mk = monthKeyOf(date);
  list.innerHTML = `<div class="empty-state"><span class="loading-pulse"><span class="loading-spinner"></span> ${t("loading")}</span></div>`;

  try {
    const monthEntries = await ensureMonthLoaded(mk);
    const dayEntries = monthEntries.filter((e) => e.date === date);
    if (dayEntries.length === 0) {
      list.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
      if (paginationContainer) paginationContainer.innerHTML = "";
      return;
    }

    const totalItems = dayEntries.length;
    const startIdx = (state.timesheetPage - 1) * state.pageSize;
    const pageItems = dayEntries.slice(startIdx, startIdx + state.pageSize);

    list.innerHTML = "";
    pageItems.forEach((e) => {
      const hasBoth = e.in && e.out;
      const isWorking = e.in && !e.out && e.mode !== "Nghỉ";
      const h = hasBoth ? hoursBetween(e.in, e.out, e.mode) : 0;
      const isFullDay = hasBoth && (timeToMinutes(e.out) - timeToMinutes(e.in)) / 60 > 5;

      const row = document.createElement("div");
      row.className = "entry-row";
      row.style.borderLeft = `3px solid var(--${e.mode === "Onsite" ? "onsite" : e.mode === "Remote" ? "remote" : "off"})`;

      let statusBadge = "";
      if (isWorking) {
        statusBadge = `
          <span class="badge-working">${t("statusWorking")}</span>
          <button class="btn-checkout-quick" data-id="${e.id}">${t("btnQuickCheckout")}</button>
        `;
      } else if (hasBoth) {
        statusBadge = `<span class="hours">${fmtHours(h)}</span> ${isFullDay ? `<span class="badge-lunch">${t("lunchDeducted")}</span>` : ""}`;
      } else {
        statusBadge = `<span class="muted mono">--:--</span>`;
      }

      const modeText = e.mode === "Nghỉ" ? t("modeOff") : e.mode;
      const delBtnHtml = state.isAdmin
        ? `<button class="del-btn admin-only" data-id="${e.id}" aria-label="Xoá">🗑</button>`
        : "";

      row.innerHTML = `
        <span class="name">${empName(e.employeeId)}</span>
        <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}</span>
        ${statusBadge}
        <span class="stamp ${e.mode}">${modeText}</span>
        <span class="note">${e.note || ""}</span>
        ${delBtnHtml}
      `;

      const btnQuick = row.querySelector(".btn-checkout-quick");
      if (btnQuick) {
        btnQuick.addEventListener("click", () => quickCheckout(e));
      }

      const btnDel = row.querySelector(".del-btn");
      if (btnDel) {
        btnDel.addEventListener("click", () => deleteDayEntry(e.id, mk));
      }

      list.appendChild(row);
    });

    renderPagination(
      paginationContainer,
      { currentPage: state.timesheetPage, totalItems, pageSize: state.pageSize },
      (newPage) => {
        state.timesheetPage = newPage;
        renderDayEntries();
      }
    );
  } catch (err) {
    list.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
    showToast(err.message, "error");
  }
}

async function quickCheckout(entry) {
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  try {
    await updateEntry(entry.id, { out: nowTime });
    showToast(t("entryUpdated"), "success");
    invalidateEntriesCache(monthKeyOf(entry.date));
    await renderDayEntries();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteDayEntry(id, mk) {
  if (!confirm(t("confirmDeleteEntry"))) return;
  try {
    await deleteEntry(id);
    showToast(t("entryDeleted"), "success");
    invalidateEntriesCache(mk);
    await renderDayEntries();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initChamCongTab(refreshAll) {
  const dateInput = document.getElementById("dateInput");
  const entryForm = document.getElementById("entryForm");
  const empSelect = document.getElementById("empSelect");
  const entryIdInput = document.getElementById("entryIdInput");
  const inTimeInput = document.getElementById("inTime");
  const outTimeInput = document.getElementById("outTime");
  const noteInput = document.getElementById("noteInput");
  const btnResetForm = document.getElementById("btnResetForm");
  const btnSubmitEntry = document.getElementById("btnSubmitEntry");

  if (dateInput) dateInput.value = todayStr();

  function updatePlaceholder() {
    const isOff = document.querySelector('input[name="mode"]:checked')?.value === "Nghỉ";
    if (noteInput) {
      noteInput.placeholder = isOff ? t("placeholderReason") : t("placeholderTask");
    }
  }

  function resetForm() {
    if (entryIdInput) entryIdInput.value = "";
    if (empSelect) empSelect.value = "";
    if (inTimeInput) inTimeInput.value = "";
    if (outTimeInput) outTimeInput.value = "";
    if (noteInput) noteInput.value = "";
    const onsiteRadio = document.querySelector('input[name="mode"][value="Onsite"]');
    if (onsiteRadio) onsiteRadio.checked = true;
    if (btnResetForm) btnResetForm.style.display = "none";
    if (btnSubmitEntry) btnSubmitEntry.textContent = t("btnRecord");
    updatePlaceholder();
  }

  async function onEmployeeOrDateChange() {
    const empId = empSelect?.value;
    const date = dateInput?.value;
    if (!empId || !date) {
      if (btnSubmitEntry) btnSubmitEntry.textContent = t("btnRecord");
      return;
    }

    const mk = monthKeyOf(date);
    const entries = await ensureMonthLoaded(mk);
    const existing = entries.find((e) => e.employeeId === empId && e.date === date);

    if (existing) {
      if (entryIdInput) entryIdInput.value = existing.id;
      if (inTimeInput) inTimeInput.value = existing.in || "";
      if (outTimeInput) outTimeInput.value = existing.out || "";
      if (noteInput) noteInput.value = existing.note || "";
      const radio = document.querySelector(`input[name="mode"][value="${existing.mode}"]`);
      if (radio) radio.checked = true;
      if (btnResetForm) btnResetForm.style.display = "inline-flex";

      if (existing.in && !existing.out && existing.mode !== "Nghỉ") {
        const now = new Date();
        const currentHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        if (outTimeInput && !outTimeInput.value) outTimeInput.value = currentHM;
        if (btnSubmitEntry) btnSubmitEntry.textContent = t("btnCheckout");
      } else {
        if (btnSubmitEntry) btnSubmitEntry.textContent = t("btnRecord");
      }
    } else {
      if (entryIdInput) entryIdInput.value = "";
      const now = new Date();
      const currentHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (now.getHours() < 12) {
        if (inTimeInput) inTimeInput.value = currentHM;
        if (outTimeInput) outTimeInput.value = "";
      } else {
        if (inTimeInput && !inTimeInput.value) inTimeInput.value = "08:30";
        if (outTimeInput) outTimeInput.value = currentHM;
      }
      if (btnResetForm) btnResetForm.style.display = "none";
      if (btnSubmitEntry) btnSubmitEntry.textContent = t("btnCheckin");
    }
    updatePlaceholder();
  }

  document.querySelectorAll('input[name="mode"]').forEach((r) => {
    r.addEventListener("change", updatePlaceholder);
  });

  empSelect?.addEventListener("change", onEmployeeOrDateChange);
  dateInput?.addEventListener("change", () => {
    state.timesheetPage = 1;
    renderDayEntries();
    onEmployeeOrDateChange();
  });

  btnResetForm?.addEventListener("click", resetForm);

  entryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = dateInput?.value;
    const employeeId = empSelect?.value;
    const mode = document.querySelector('input[name="mode"]:checked')?.value || "Onsite";
    const timeIn = (inTimeInput?.value || "").trim();
    const out = (outTimeInput?.value || "").trim();
    const note = (noteInput?.value || "").trim();
    const id = entryIdInput?.value;

    if (!employeeId) return showToast(t("errMissingFields"), "error");
    if (!note) return showToast(t("errNoteEmpty"), "error");

    setBtnLoading(btnSubmitEntry, true);
    try {
      if (id) {
        await updateEntry(id, { in: timeIn, out, mode, note });
        showToast(t("entryUpdated"), "success");
      } else {
        await createEntry({ date, employeeId, in: timeIn, out, mode, note });
        showToast(t("entrySaved"), "success");
      }
      invalidateEntriesCache(monthKeyOf(date));
      resetForm();
      await renderDayEntries();
      if (typeof refreshAll === "function") refreshAll();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmitEntry, false);
    }
  });
}
```

- [x] **Step 2: Create `public/js/tabs/locChamCong.js`**

```javascript
import { state, invalidateEntriesCache } from "../state.js";
import { fetchEntries, deleteEntry } from "../api.js";
import { t } from "../i18n.js";
import { timeToMinutes, hoursBetween, fmtHours, monthKeyOf } from "../utils/time.js";
import { showToast, setBtnLoading, renderPagination } from "../utils/ui.js";
import { empName } from "./chamCong.js";

export function renderFilterEmployeeSelect() {
  const filterEmpSelect = document.getElementById("filterEmpSelect");
  if (!filterEmpSelect) return;
  const keep = filterEmpSelect.value;
  filterEmpSelect.innerHTML = `<option value="">${t("filterAllEmployees")}</option>`;
  state.employees.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    filterEmpSelect.appendChild(opt);
  });
  filterEmpSelect.value = keep;
}

export function renderFilterResults() {
  const list = document.getElementById("filterEntryList");
  const paginationContainer = document.getElementById("filterPagination");
  const kpiBox = document.getElementById("filterKpis");
  const items = state.filterData.items;

  if (!list) return;

  if (items.length === 0) {
    if (kpiBox) kpiBox.style.display = "none";
    list.innerHTML = `<div class="empty-state">${t("emptyFilter")}</div>`;
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  // Compute KPIs
  if (kpiBox) kpiBox.style.display = "grid";
  let totalHours = 0;
  let onsiteCount = 0;
  let remoteCount = 0;
  let offCount = 0;

  items.forEach((e) => {
    if (e.mode === "Onsite") onsiteCount++;
    else if (e.mode === "Remote") remoteCount++;
    else if (e.mode === "Nghỉ" || e.mode === "Off") offCount++;

    if (e.in && e.out && e.mode !== "Nghỉ" && e.mode !== "Off") {
      totalHours += hoursBetween(e.in, e.out, e.mode);
    }
  });

  const kpiDays = document.getElementById("kpiTotalDaysVal");
  const kpiHours = document.getElementById("kpiTotalHoursVal");
  const kpiBreakdown = document.getElementById("kpiBreakdownVal");
  if (kpiDays) kpiDays.textContent = items.length;
  if (kpiHours) kpiHours.textContent = fmtHours(totalHours);
  if (kpiBreakdown) {
    kpiBreakdown.textContent = `${onsiteCount} Onsite / ${remoteCount} Remote / ${offCount} ${t("modeOff")}`;
  }

  // Paginate results
  const totalItems = items.length;
  const startIdx = (state.filterData.page - 1) * state.pageSize;
  const pageItems = items.slice(startIdx, startIdx + state.pageSize);

  list.innerHTML = "";
  pageItems.forEach((e) => {
    const hasBoth = e.in && e.out;
    const isWorking = e.in && !e.out && e.mode !== "Nghỉ";
    const h = hasBoth ? hoursBetween(e.in, e.out, e.mode) : 0;
    const isFullDay = hasBoth && (timeToMinutes(e.out) - timeToMinutes(e.in)) / 60 > 5;

    const row = document.createElement("div");
    row.className = "entry-row";
    row.style.borderLeft = `3px solid var(--${e.mode === "Onsite" ? "onsite" : e.mode === "Remote" ? "remote" : "off"})`;

    let statusBadge = "";
    if (isWorking) {
      statusBadge = `<span class="badge-working">${t("statusWorking")}</span>`;
    } else if (hasBoth) {
      statusBadge = `<span class="hours">${fmtHours(h)}</span> ${isFullDay ? `<span class="badge-lunch">${t("lunchDeducted")}</span>` : ""}`;
    } else {
      statusBadge = `<span class="muted mono">--:--</span>`;
    }

    const modeText = e.mode === "Nghỉ" ? t("modeOff") : e.mode;
    const delBtnHtml = state.isAdmin
      ? `<button class="del-btn admin-only" data-id="${e.id}" aria-label="Xoá">🗑</button>`
      : "";

    row.innerHTML = `
      <span class="date-tag">${e.date}</span>
      <span class="name">${empName(e.employeeId)}</span>
      <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}</span>
      ${statusBadge}
      <span class="stamp ${e.mode}">${modeText}</span>
      <span class="note">${e.note || ""}</span>
      ${delBtnHtml}
    `;

    const btnDel = row.querySelector(".del-btn");
    if (btnDel) {
      btnDel.addEventListener("click", () => deleteFilterEntry(e.id, e.date));
    }

    list.appendChild(row);
  });

  renderPagination(
    paginationContainer,
    { currentPage: state.filterData.page, totalItems, pageSize: state.pageSize },
    (newPage) => {
      state.filterData.page = newPage;
      renderFilterResults();
    }
  );
}

async function deleteFilterEntry(id, date) {
  if (!confirm(t("confirmDeleteEntry"))) return;
  try {
    await deleteEntry(id);
    showToast(t("entryDeleted"), "success");
    invalidateEntriesCache(monthKeyOf(date));
    state.filterData.items = state.filterData.items.filter((i) => i.id !== id);
    renderFilterResults();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initLocChamCongTab() {
  const formFilter = document.getElementById("formFilter");
  const btnResetFilter = document.getElementById("btnResetFilter");
  const filterEmpSelect = document.getElementById("filterEmpSelect");
  const filterStartDate = document.getElementById("filterStartDate");
  const filterEndDate = document.getElementById("filterEndDate");
  const filterModeSelect = document.getElementById("filterModeSelect");
  const btnApplyFilter = document.getElementById("btnApplyFilter");

  formFilter?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const employeeId = filterEmpSelect?.value || "";
    const startDate = filterStartDate?.value || "";
    const endDate = filterEndDate?.value || "";
    const mode = filterModeSelect?.value || "";

    setBtnLoading(btnApplyFilter, true);
    try {
      const items = await fetchEntries({ employeeId, startDate, endDate, mode });
      state.filterData.items = items;
      state.filterData.page = 1;
      state.filterData.isLoaded = true;
      renderFilterResults();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnApplyFilter, false);
    }
  });

  btnResetFilter?.addEventListener("click", () => {
    if (filterEmpSelect) filterEmpSelect.value = "";
    if (filterStartDate) filterStartDate.value = "";
    if (filterEndDate) filterEndDate.value = "";
    if (filterModeSelect) filterModeSelect.value = "";
    state.filterData.items = [];
    state.filterData.page = 1;
    state.filterData.isLoaded = false;
    const kpis = document.getElementById("filterKpis");
    const list = document.getElementById("filterEntryList");
    const pag = document.getElementById("filterPagination");
    if (kpis) kpis.style.display = "none";
    if (list) list.innerHTML = "";
    if (pag) pag.innerHTML = "";
  });
}
```

- [x] **Step 3: Create `public/js/tabs/nhanVien.js`**

```javascript
import { state } from "../state.js";
import { fetchEmployees, createEmployee, deleteEmployee } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";

export function renderEmployeeList(onDeleteCallback) {
  const list = document.getElementById("empList");
  if (!list) return;
  if (state.employees.length === 0) {
    list.innerHTML = `<div class="empty-state">${t("emptyEmp")}</div>`;
    return;
  }
  list.innerHTML = "";
  state.employees.forEach((e) => {
    const row = document.createElement("div");
    row.className = "emp-row";
    row.innerHTML = `<span class="name">${e.name}</span><button class="del-btn" aria-label="Xoá">🗑</button>`;
    row.querySelector(".del-btn").addEventListener("click", () => removeEmployee(e.id, onDeleteCallback));
    list.appendChild(row);
  });
}

export async function loadEmployees(onChangedCallback) {
  try {
    state.employees = await fetchEmployees();
    renderEmployeeList(onChangedCallback);
    if (typeof onChangedCallback === "function") {
      onChangedCallback();
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function removeEmployee(id, onChangedCallback) {
  if (!confirm(t("confirmDeleteEmp"))) return;
  try {
    await deleteEmployee(id);
    showToast(t("empDeleted"), "success");
    await loadEmployees(onChangedCallback);
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initNhanVienTab(onChangedCallback) {
  const empForm = document.getElementById("empForm");
  const newEmpName = document.getElementById("newEmpName");
  const btnSubmit = document.getElementById("btnAddEmpSubmit");

  empForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = (newEmpName?.value || "").trim();
    if (!name) return;

    setBtnLoading(btnSubmit, true);
    try {
      await createEmployee(name);
      showToast(t("empAdded"), "success");
      if (newEmpName) newEmpName.value = "";
      await loadEmployees(onChangedCallback);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
```

- [x] **Step 4: Create `public/js/tabs/tongHop.js`**

```javascript
import { state } from "../state.js";
import { t } from "../i18n.js";
import { todayStr, monthKeyOf, hoursBetween, fmtHours, monthLabel } from "../utils/time.js";
import { showToast } from "../utils/ui.js";
import { ensureMonthLoaded } from "./chamCong.js";

export async function renderSummary() {
  const monthInput = document.getElementById("monthInput");
  const monthLabelEl = document.getElementById("monthLabel");
  const box = document.getElementById("summaryTable");
  if (!monthInput || !box) return;

  const mk = monthInput.value;
  if (monthLabelEl) monthLabelEl.textContent = monthLabel(mk);

  if (state.employees.length === 0) {
    box.innerHTML = `<div class="empty-state">${t("emptySummary")}</div>`;
    return;
  }

  box.innerHTML = `<div class="empty-state"><span class="loading-pulse"><span class="loading-spinner"></span> ${t("loading")}</span></div>`;
  try {
    const entries = await ensureMonthLoaded(mk);
    let grand = 0;
    const rows = state.employees.map((emp) => {
      const empEntries = entries.filter((e) => e.employeeId === emp.id);
      const total = empEntries.reduce((s, e) => s + (e.in && e.out ? hoursBetween(e.in, e.out, e.mode) : 0), 0);
      const onsite = empEntries.filter((e) => e.mode === "Onsite").length;
      const remote = empEntries.filter((e) => e.mode === "Remote").length;
      const off = empEntries.filter((e) => e.mode === "Nghỉ" || e.mode === "Off").length;
      grand += total;
      return { name: emp.name, total, onsite, remote, off };
    });

    box.innerHTML = `
      <div class="summary-row header">
        <div>${t("thEmployee")}</div><div>${t("thTotalHours")}</div><div>${t("thOnsiteRemote")}</div><div>${t("thOff")}</div>
      </div>
      ${rows
        .map(
          (r, i) => `
        <div class="summary-row ${i % 2 === 0 ? "even" : "odd"}">
          <div>${r.name}</div>
          <div class="mono-cell">${fmtHours(r.total)}</div>
          <div class="muted-cell">${r.onsite} / ${r.remote}</div>
          <div class="muted-cell">${r.off}</div>
        </div>`
        )
        .join("")}
      <div class="summary-row total">
        <div>${t("thTotal")}</div><div class="mono-cell">${fmtHours(grand)}</div><div></div><div></div>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${t("emptySummary")}</div>`;
    showToast(err.message, "error");
  }
}

export function initTongHopTab() {
  const monthInput = document.getElementById("monthInput");
  if (monthInput && !monthInput.value) {
    monthInput.value = monthKeyOf(todayStr());
  }
  monthInput?.addEventListener("change", renderSummary);
}
```

- [x] **Step 5: Verification**

Run: `npm test`
Expected: PASS

---

### Task 5: Main Orchestrator & HTML Integration (`public/js/main.js`, `public/index.html`)

**Files:**
- Create: `public/js/main.js`
- Modify: `public/index.html`

- [x] **Step 1: Create `public/js/main.js`**

```javascript
import { state } from "./state.js";
import { currentLang, setLanguage } from "./i18n.js";
import { initAdminAuth, checkAdminStatus, updateAdminUI } from "./modals/adminAuth.js";
import { initChamCongTab, renderEmployeeSelect, renderDayEntries, updateEmpCount } from "./tabs/chamCong.js";
import { initLocChamCongTab, renderFilterEmployeeSelect, renderFilterResults } from "./tabs/locChamCong.js";
import { initNhanVienTab, loadEmployees, renderEmployeeList } from "./tabs/nhanVien.js";
import { initTongHopTab, renderSummary } from "./tabs/tongHop.js";

// Re-render callback when employee list changes
function onEmployeeDataChanged() {
  renderEmployeeSelect();
  renderFilterEmployeeSelect();
  renderDayEntries();
  renderSummary();
  updateEmpCount();
}

// Re-render callback when language changes
function onLanguageChanged() {
  renderEmployeeSelect();
  renderFilterEmployeeSelect();
  renderDayEntries();
  renderEmployeeList(onEmployeeDataChanged);
  renderSummary();
  if (state.filterData.isLoaded) renderFilterResults();
  updateEmpCount();
}

// Tabs Navigation Switcher
function initTabNavigation() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetSection = document.getElementById(`tab-${tabName}`);
      if (targetSection) targetSection.classList.add("active");

      if (tabName === "tong-hop") renderSummary();
      if (tabName === "cham-cong") renderDayEntries();
    });
  });
}

// Language Switcher Buttons
function initLanguageSwitcher() {
  document.getElementById("langVi")?.addEventListener("click", () => {
    setLanguage("vi", { onLanguageChange: onLanguageChanged });
  });
  document.getElementById("langEn")?.addEventListener("click", () => {
    setLanguage("en", { onLanguageChange: onLanguageChanged });
  });
}

// App Initialization
(async function init() {
  try {
    initTabNavigation();
    initLanguageSwitcher();

    initAdminAuth(() => {
      renderDayEntries();
      if (state.filterData.isLoaded) renderFilterResults();
    });

    initChamCongTab(renderSummary);
    initLocChamCongTab();
    initNhanVienTab(onEmployeeDataChanged);
    initTongHopTab();

    setLanguage(currentLang, { onLanguageChange: onLanguageChanged });
    await checkAdminStatus();
    await loadEmployees(onEmployeeDataChanged);
    await renderDayEntries();
    await renderSummary();
  } catch (err) {
    console.error("Initialization error:", err);
  }
})();
```

- [x] **Step 2: Update `public/index.html` to load `js/main.js` as module**

In `public/index.html`, replace:
```html
<script src="app.js"></script>
```
with:
```html
<script type="module" src="js/main.js"></script>
```

- [x] **Step 3: Verification & Cleanup**

Run: `npm test`
Expected: PASS

---

### Task 6: Final Verification & Compatibility Check

**Files:**
- Test: Local API & Calculation test suite (`npm test`)
- Verify: ES Module structure & import paths

- [x] **Step 1: Run complete automated test suite**

Run: `npm test`
Expected: All backend and calculation tests pass with code 0.

- [x] **Step 2: Static verification of ES Modules**

Verify that all import statements across `public/js/**/*.js` have exact relative paths with `.js` extensions.

- [x] **Step 3: Verification commit**

```bash
git status
```
Confirm all new modular files are tracked properly.
