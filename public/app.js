const state = {
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

// ---------- i18n Dictionary ----------
const dict = {
  vi: {
    eyebrow: "ALPACA SOLUTIONS",
    appTitle: "Bảng làm việc Intern",
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
    footerNote: "Ghi nhận thời gian làm việc của thực tập sinh tại ASOL",
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
    eyebrow: "ALPACA SOLUTIONS",
    appTitle: "Intern Timesheet",
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
    footerNote: "Recording working hours of interns at ASOL",
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

let currentLang = localStorage.getItem("ts_lang") || "vi";

function t(key) {
  return dict[currentLang]?.[key] || dict["vi"][key] || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("ts_lang", lang);
  document.getElementById("langVi").classList.toggle("active", lang === "vi");
  document.getElementById("langEn").classList.toggle("active", lang === "en");

  // Update data-i18n
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (k && t(k)) el.textContent = t(k);
  });

  // Update placeholders
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const k = el.getAttribute("data-i18n-ph");
    if (k && t(k)) el.placeholder = t(k);
  });

  updatePlaceholder();
  renderEmployeeSelect();
  renderFilterEmployeeSelect();
  renderDayEntries();
  renderEmployeeList();
  renderSummary();
  if (state.filterData.isLoaded) renderFilterResults();
  updateEmpCount();
  onEmployeeOrDateChange();
}

// ---------- Toast Notification System ----------
function showToast(message, type = "success") {
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

function setBtnLoading(btn, isLoading, customText = "") {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-small"></span> ${customText || t("loading")}`;
  } else if (btn.dataset.origHtml) {
    btn.innerHTML = btn.dataset.origHtml;
  }
}

// ---------- Helpers ----------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyOf(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}

function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function hoursBetween(inStr, outStr, mode) {
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

function fmtHours(h) {
  return h.toFixed(2).replace(".", ",") + "h";
}

function weekdayLabelFor(dateStr) {
  const dayIdx = new Date(dateStr + "T00:00:00").getDay();
  return dict[currentLang].daysOfWeek[dayIdx];
}

function monthLabel(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-");
  return `${dict[currentLang].monthPrefix} ${parseInt(m, 10)}/${y}`;
}

function empName(id) {
  return state.employees.find((e) => e.id === id)?.name || t("deletedEmp");
}

function updateEmpCount() {
  const count = state.employees.length;
  document.getElementById("empCount").textContent = `${count} ${t("empCountLabel")}`;
}

function showError(msg) {
  showToast(msg, "error");
}

// ---------- Universal Pagination Component ----------
function renderPagination(container, { currentPage, totalItems, pageSize }, onPageChange) {
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

// ---------- API & Auth Helpers ----------
function getAuthHeaders() {
  const token = localStorage.getItem("timesheet_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(opts.headers || {}),
  };

  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Lỗi máy chủ");
  }
  return res.json();
}

async function checkAdminStatus() {
  const token = localStorage.getItem("timesheet_admin_token");
  if (!token) {
    setAdminMode(false);
    return;
  }
  try {
    const res = await api("/api/admin/status");
    setAdminMode(Boolean(res.isAdmin));
  } catch {
    setAdminMode(false);
  }
}

function setAdminMode(isAdmin) {
  state.isAdmin = isAdmin;
  document.body.classList.toggle("is-admin", isAdmin);

  const guestControls = document.getElementById("guestControls");
  const adminControls = document.getElementById("adminControls");

  if (isAdmin) {
    guestControls.style.display = "none";
    adminControls.style.display = "flex";
  } else {
    guestControls.style.display = "flex";
    adminControls.style.display = "none";
    localStorage.removeItem("timesheet_admin_token");
  }

  // Re-render UI where admin privileges affect actions
  renderDayEntries();
  if (state.filterData.isLoaded) renderFilterResults();
}

// ---------- Dynamic Placeholder & Form Behavior ----------
function updatePlaceholder() {
  const mode = document.getElementById("modeSelect").value;
  const noteInput = document.getElementById("noteInput");
  const timeGrid = document.getElementById("timeGrid");

  if (mode === "Nghỉ") {
    noteInput.placeholder = t("placeholderReason");
    timeGrid.style.opacity = "0.45";
  } else {
    noteInput.placeholder = t("placeholderTask");
    timeGrid.style.opacity = "1";
  }
}

document.getElementById("modeSelect").addEventListener("change", updatePlaceholder);

// Quick-fill current time for buttons
document.querySelectorAll(".btn-now").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (input) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      input.value = `${hh}:${mm}`;
    }
  });
});

// ---------- Smart Form Detection (Check-in vs Check-out) ----------
function onEmployeeOrDateChange() {
  const empId = empSelect.value;
  const date = dateInput.value;
  const entryIdInput = document.getElementById("entryIdInput");
  const btnSubmit = document.getElementById("btnSubmitEntry");
  const btnReset = document.getElementById("btnResetForm");

  if (!empId || !date) {
    resetFormState();
    return;
  }

  const mk = monthKeyOf(date);
  const monthEntries = state.entriesCache[mk] || [];
  const existingEntry = monthEntries.find((e) => e.date === date && e.employeeId === empId);

  if (existingEntry && existingEntry.in && !existingEntry.out && existingEntry.mode !== "Nghỉ") {
    // Đã check-in sáng, đang chờ check-out chiều
    entryIdInput.value = existingEntry.id;
    document.getElementById("inTime").value = existingEntry.in;
    document.getElementById("inTime").disabled = true;

    // Tự động điền giờ hiện tại vào outTime nếu chưa có
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("outTime").value = `${hh}:${mm}`;

    document.getElementById("modeSelect").value = existingEntry.mode || "Onsite";
    document.getElementById("noteInput").value = existingEntry.note || "";
    btnSubmit.textContent = t("btnCheckout");
    btnReset.style.display = "inline-block";
  } else {
    resetFormState();
  }
}

function resetFormState() {
  document.getElementById("entryIdInput").value = "";
  document.getElementById("inTime").disabled = false;
  document.getElementById("btnSubmitEntry").textContent = t("btnRecord");
  document.getElementById("btnResetForm").style.display = "none";
}

document.getElementById("empSelect").addEventListener("change", onEmployeeOrDateChange);
document.getElementById("btnResetForm").addEventListener("click", () => {
  resetFormState();
  document.getElementById("inTime").value = "";
  document.getElementById("outTime").value = "";
  document.getElementById("noteInput").value = "";
});

async function loadEmployees() {
  state.employees = await api("/api/employees");
  renderEmployeeSelect();
  renderFilterEmployeeSelect();
  renderEmployeeList();
  updateEmpCount();
}

async function ensureMonthLoaded(mk) {
  if (state.entriesCache[mk]) return state.entriesCache[mk];
  const data = await api(`/api/entries?month=${mk}`);
  state.entriesCache[mk] = data;
  return data;
}

// ---------- Tabs Navigation ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    const targetSection = document.getElementById(`tab-${btn.dataset.tab}`);
    if (targetSection) targetSection.classList.add("active");
  });
});

// ---------- 1. Cham Cong Tab ----------
const dateInput = document.getElementById("dateInput");
const weekdayLabel = document.getElementById("weekdayLabel");
const entryForm = document.getElementById("entryForm");
const empSelect = document.getElementById("empSelect");

dateInput.value = todayStr();

function renderEmployeeSelect() {
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

async function renderDayEntries() {
  const date = dateInput.value;
  if (!date) return;
  weekdayLabel.textContent = weekdayLabelFor(date);
  const mk = monthKeyOf(date);
  const list = document.getElementById("entryList");
  const paginationContainer = document.getElementById("timesheetPagination");
  list.innerHTML = `<div class="empty-state"><span class="loading-pulse"><span class="loading-spinner"></span> ${t("loading")}</span></div>`;

  try {
    const monthEntries = await ensureMonthLoaded(mk);
    const dayEntries = monthEntries.filter((e) => e.date === date);
    if (dayEntries.length === 0) {
      list.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
      paginationContainer.innerHTML = "";
      return;
    }

    // Paginate day entries if more than pageSize
    const totalItems = dayEntries.length;
    const startIdx = (state.timesheetPage - 1) * state.pageSize;
    const pageItems = dayEntries.slice(startIdx, startIdx + state.pageSize);

    list.innerHTML = "";
    pageItems.forEach((e) => {
      const hasBoth = e.in && e.out;
      const isWorking = e.in && !e.out && e.mode !== "Nghỉ";
      const h = hasBoth ? hoursBetween(e.in, e.out, e.mode) : 0;
      const isFullDay = hasBoth && ((timeToMinutes(e.out) - timeToMinutes(e.in)) / 60 > 5);

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
        btnDel.addEventListener("click", () => deleteEntry(e.id, mk));
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
    showError(err.message);
  }
}

async function quickCheckout(entry) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const outTime = `${hh}:${mm}`;

  try {
    const mk = monthKeyOf(entry.date);
    const updated = await api(`/api/entries/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify({ out: outTime }),
    });
    state.entriesCache[mk] = (state.entriesCache[mk] || []).map((e) =>
      e.id === entry.id ? updated : e
    );
    showToast(t("entryUpdated"), "success");
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
    onEmployeeOrDateChange();
  } catch (err) {
    showError(err.message);
  }
}

dateInput.addEventListener("change", () => {
  state.timesheetPage = 1;
  renderDayEntries();
  onEmployeeOrDateChange();
});

entryForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const employeeId = empSelect.value;
  const note = document.getElementById("noteInput").value.trim();
  const entryId = document.getElementById("entryIdInput").value;
  const btnSubmit = document.getElementById("btnSubmitEntry");

  if (!employeeId) return showError(t("errMissingFields"));
  if (!note) return showError(t("errNoteEmpty"));

  const payload = {
    date: dateInput.value,
    employeeId,
    in: document.getElementById("inTime").value,
    out: document.getElementById("outTime").value,
    mode: document.getElementById("modeSelect").value,
    note,
  };

  setBtnLoading(btnSubmit, true);
  try {
    const mk = monthKeyOf(payload.date);
    if (entryId) {
      const updated = await api(`/api/entries/${entryId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      state.entriesCache[mk] = (state.entriesCache[mk] || []).map((e) =>
        e.id === entryId ? updated : e
      );
      showToast(t("entryUpdated"), "success");
    } else {
      const created = await api("/api/entries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.entriesCache[mk] = [...(state.entriesCache[mk] || []), created];
      showToast(t("entrySaved"), "success");
    }

    resetFormState();
    document.getElementById("inTime").value = "";
    document.getElementById("outTime").value = "";
    document.getElementById("noteInput").value = "";
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
  } catch (err) {
    showError(err.message);
  } finally {
    setBtnLoading(btnSubmit, false);
  }
});

async function deleteEntry(id, mk) {
  if (!confirm(t("confirmDeleteEntry"))) return;
  try {
    await api(`/api/entries/${id}`, { method: "DELETE" });
    showToast(t("entryDeleted"), "success");
    if (mk && state.entriesCache[mk]) {
      state.entriesCache[mk] = state.entriesCache[mk].filter((e) => e.id !== id);
    }
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
    if (state.filterData.isLoaded) {
      state.filterData.items = state.filterData.items.filter((e) => e.id !== id);
      renderFilterResults();
    }
    onEmployeeOrDateChange();
  } catch (err) {
    showError(err.message);
  }
}

// ---------- 2. Tab Loc Cham Cong ----------
const filterForm = document.getElementById("filterForm");
const filterEmpSelect = document.getElementById("filterEmpSelect");
const filterStartDate = document.getElementById("filterStartDate");
const filterEndDate = document.getElementById("filterEndDate");
const filterModeSelect = document.getElementById("filterModeSelect");
const btnResetFilter = document.getElementById("btnResetFilter");

function renderFilterEmployeeSelect() {
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

filterForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btnApply = document.getElementById("btnApplyFilter");
  setBtnLoading(btnApply, true);

  const params = new URLSearchParams();
  if (filterEmpSelect.value) params.append("employeeId", filterEmpSelect.value);
  if (filterStartDate.value) params.append("startDate", filterStartDate.value);
  if (filterEndDate.value) params.append("endDate", filterEndDate.value);
  if (filterModeSelect.value) params.append("mode", filterModeSelect.value);

  try {
    const entries = await api(`/api/entries?${params.toString()}`);
    state.filterData.items = entries;
    state.filterData.page = 1;
    state.filterData.isLoaded = true;
    renderFilterResults();
  } catch (err) {
    showError(err.message);
  } finally {
    setBtnLoading(btnApply, false);
  }
});

btnResetFilter.addEventListener("click", () => {
  filterEmpSelect.value = "";
  filterStartDate.value = "";
  filterEndDate.value = "";
  filterModeSelect.value = "";
  state.filterData.items = [];
  state.filterData.page = 1;
  state.filterData.isLoaded = false;
  document.getElementById("filterKpis").style.display = "none";
  document.getElementById("filterEntryList").innerHTML = "";
  document.getElementById("filterPagination").innerHTML = "";
});

function renderFilterResults() {
  const list = document.getElementById("filterEntryList");
  const paginationContainer = document.getElementById("filterPagination");
  const kpiBox = document.getElementById("filterKpis");
  const items = state.filterData.items;

  if (items.length === 0) {
    kpiBox.style.display = "none";
    list.innerHTML = `<div class="empty-state">${t("emptyFilter")}</div>`;
    paginationContainer.innerHTML = "";
    return;
  }

  // Compute KPIs
  kpiBox.style.display = "grid";
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

  document.getElementById("kpiTotalDaysVal").textContent = items.length;
  document.getElementById("kpiTotalHoursVal").textContent = fmtHours(totalHours);
  document.getElementById("kpiBreakdownVal").textContent = `${onsiteCount} Onsite / ${remoteCount} Remote / ${offCount} ${t("modeOff")}`;

  // Paginate results
  const totalItems = items.length;
  const startIdx = (state.filterData.page - 1) * state.pageSize;
  const pageItems = items.slice(startIdx, startIdx + state.pageSize);

  list.innerHTML = "";
  pageItems.forEach((e) => {
    const hasBoth = e.in && e.out;
    const isWorking = e.in && !e.out && e.mode !== "Nghỉ";
    const h = hasBoth ? hoursBetween(e.in, e.out, e.mode) : 0;
    const isFullDay = hasBoth && ((timeToMinutes(e.out) - timeToMinutes(e.in)) / 60 > 5);

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
      btnDel.addEventListener("click", () => deleteEntry(e.id, monthKeyOf(e.date)));
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

// ---------- 3. Tab Nhan Vien (Admin Only) ----------
const empForm = document.getElementById("empForm");
const newEmpName = document.getElementById("newEmpName");

function renderEmployeeList() {
  const list = document.getElementById("empList");
  if (state.employees.length === 0) {
    list.innerHTML = `<div class="empty-state">${t("emptyEmp")}</div>`;
    return;
  }
  list.innerHTML = "";
  state.employees.forEach((e) => {
    const row = document.createElement("div");
    row.className = "emp-row";
    row.innerHTML = `<span class="name">${e.name}</span><button class="del-btn" aria-label="Xoá">🗑</button>`;
    row.querySelector(".del-btn").addEventListener("click", () => removeEmployee(e.id));
    list.appendChild(row);
  });
}

empForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const name = newEmpName.value.trim();
  if (!name) return;
  const btnSubmit = document.getElementById("btnAddEmpSubmit");
  setBtnLoading(btnSubmit, true);

  try {
    await api("/api/employees", { method: "POST", body: JSON.stringify({ name }) });
    showToast(t("empAdded"), "success");
    newEmpName.value = "";
    await loadEmployees();
    renderDayEntries();
  } catch (err) {
    showError(err.message);
  } finally {
    setBtnLoading(btnSubmit, false);
  }
});

async function removeEmployee(id) {
  if (!confirm(t("confirmDeleteEmp"))) return;
  try {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    showToast(t("empDeleted"), "success");
    await loadEmployees();
    renderDayEntries();
    renderSummary();
  } catch (err) {
    showError(err.message);
  }
}

// ---------- 4. Tab Tong Hop ----------
const monthInput = document.getElementById("monthInput");
const monthLabelEl = document.getElementById("monthLabel");
monthInput.value = monthKeyOf(todayStr());

async function renderSummary() {
  const mk = monthInput.value;
  monthLabelEl.textContent = monthLabel(mk);
  const box = document.getElementById("summaryTable");
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
    showError(err.message);
  }
}

monthInput.addEventListener("change", renderSummary);

// ---------- Modal Events & Admin Auth Handlers ----------
const modalAdminLogin = document.getElementById("modalAdminLogin");
const modalAdminChangePass = document.getElementById("modalAdminChangePass");
const formAdminLogin = document.getElementById("formAdminLogin");
const formAdminChangePass = document.getElementById("formAdminChangePass");

document.getElementById("btnOpenLoginModal").addEventListener("click", () => {
  document.getElementById("adminLoginPassword").value = "";
  modalAdminLogin.style.display = "flex";
});

document.getElementById("btnCloseLoginModal").addEventListener("click", () => {
  modalAdminLogin.style.display = "none";
});

document.getElementById("btnCancelLoginModal").addEventListener("click", () => {
  modalAdminLogin.style.display = "none";
});

document.getElementById("btnOpenChangePassModal").addEventListener("click", () => {
  document.getElementById("currentPassInput").value = "";
  document.getElementById("newPassInput").value = "";
  document.getElementById("confirmPassInput").value = "";
  modalAdminChangePass.style.display = "flex";
});

document.getElementById("btnCloseChangePassModal").addEventListener("click", () => {
  modalAdminChangePass.style.display = "none";
});

document.getElementById("btnCancelChangePassModal").addEventListener("click", () => {
  modalAdminChangePass.style.display = "none";
});

document.getElementById("btnLogoutAdmin").addEventListener("click", () => {
  localStorage.removeItem("timesheet_admin_token");
  setAdminMode(false);
  showToast(t("logoutSuccess"), "success");
});

formAdminLogin.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const password = document.getElementById("adminLoginPassword").value;
  const btnSubmit = document.getElementById("btnSubmitAdminLogin");
  setBtnLoading(btnSubmit, true);

  try {
    const res = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    localStorage.setItem("timesheet_admin_token", res.token);
    setAdminMode(true);
    modalAdminLogin.style.display = "none";
    showToast(t("loginSuccess"), "success");
  } catch (err) {
    showError(err.message);
  } finally {
    setBtnLoading(btnSubmit, false);
  }
});

formAdminChangePass.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const currentPassword = document.getElementById("currentPassInput").value;
  const newPassword = document.getElementById("newPassInput").value;
  const confirmPassword = document.getElementById("confirmPassInput").value;
  const btnSubmit = document.getElementById("btnSubmitChangePass");

  if (newPassword !== confirmPassword) {
    return showError(t("passMismatch"));
  }
  if (newPassword.length < 6) {
    return showError(t("passTooShort"));
  }

  setBtnLoading(btnSubmit, true);
  try {
    await api("/api/admin/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    modalAdminChangePass.style.display = "none";
    showToast(t("passChangedSuccess"), "success");
  } catch (err) {
    showError(err.message);
  } finally {
    setBtnLoading(btnSubmit, false);
  }
});

// Close modals when clicking backdrop
window.addEventListener("click", (e) => {
  if (e.target === modalAdminLogin) modalAdminLogin.style.display = "none";
  if (e.target === modalAdminChangePass) modalAdminChangePass.style.display = "none";
});

// ---------- Language Switcher Listeners ----------
document.getElementById("langVi").addEventListener("click", () => setLanguage("vi"));
document.getElementById("langEn").addEventListener("click", () => setLanguage("en"));

// ---------- Init ----------
(async function init() {
  try {
    setLanguage(currentLang);
    await checkAdminStatus();
    await loadEmployees();
    await renderDayEntries();
    await renderSummary();
  } catch (err) {
    showError(err.message);
  }
})();
