const state = {
  employees: [],
  entriesCache: {}, // monthKey -> array
};

// ---------- i18n Dictionary ----------
const dict = {
  vi: {
    eyebrow: "LEDGER · NỘI BỘ",
    appTitle: "Bảng Chấm Công",
    tabChamCong: "Chấm công",
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
  },
  en: {
    eyebrow: "LEDGER · INTERNAL",
    appTitle: "Timesheet App",
    tabChamCong: "Timesheet",
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
  renderDayEntries();
  renderEmployeeList();
  renderSummary();
  updateEmpCount();
  onEmployeeOrDateChange();
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
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.style.display = "block";
  setTimeout(() => (box.style.display = "none"), 4000);
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

// ---------- API ----------
async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Lỗi máy chủ");
  }
  return res.json();
}

async function loadEmployees() {
  state.employees = await api("/api/employees");
  renderEmployeeSelect();
  renderEmployeeList();
  updateEmpCount();
}

async function ensureMonthLoaded(mk) {
  if (state.entriesCache[mk]) return state.entriesCache[mk];
  const data = await api(`/api/entries?month=${mk}`);
  state.entriesCache[mk] = data;
  return data;
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Cham cong tab ----------
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
  list.innerHTML = `<div class="empty-state"><span class="loading-pulse"><span class="loading-spinner"></span> ${t("loading")}</span></div>`;
  try {
    const monthEntries = await ensureMonthLoaded(mk);
    const dayEntries = monthEntries.filter((e) => e.date === date);
    if (dayEntries.length === 0) {
      list.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
      return;
    }
    list.innerHTML = "";
    dayEntries.forEach((e) => {
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

      row.innerHTML = `
        <span class="name">${empName(e.employeeId)}</span>
        <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}</span>
        ${statusBadge}
        <span class="stamp ${e.mode}">${modeText}</span>
        <span class="note">${e.note || ""}</span>
        <button class="del-btn" data-id="${e.id}" aria-label="Xoá">🗑</button>
      `;

      const btnQuick = row.querySelector(".btn-checkout-quick");
      if (btnQuick) {
        btnQuick.addEventListener("click", () => quickCheckout(e));
      }

      row.querySelector(".del-btn").addEventListener("click", () => deleteEntry(e.id, mk));
      list.appendChild(row);
    });
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
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
    onEmployeeOrDateChange();
  } catch (err) {
    showError(err.message);
  }
}

dateInput.addEventListener("change", () => {
  renderDayEntries();
  onEmployeeOrDateChange();
});

entryForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const employeeId = empSelect.value;
  const note = document.getElementById("noteInput").value.trim();
  const entryId = document.getElementById("entryIdInput").value;

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
    } else {
      const created = await api("/api/entries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.entriesCache[mk] = [...(state.entriesCache[mk] || []), created];
    }

    resetFormState();
    document.getElementById("inTime").value = "";
    document.getElementById("outTime").value = "";
    document.getElementById("noteInput").value = "";
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
  } catch (err) {
    showError(err.message);
  }
});

async function deleteEntry(id, mk) {
  try {
    await api(`/api/entries/${id}`, { method: "DELETE" });
    state.entriesCache[mk] = (state.entriesCache[mk] || []).filter((e) => e.id !== id);
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
    onEmployeeOrDateChange();
  } catch (err) {
    showError(err.message);
  }
}

// ---------- Nhan vien tab ----------
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
  try {
    await api("/api/employees", { method: "POST", body: JSON.stringify({ name }) });
    newEmpName.value = "";
    await loadEmployees();
    renderDayEntries();
  } catch (err) {
    showError(err.message);
  }
});

async function removeEmployee(id) {
  try {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    await loadEmployees();
    renderDayEntries();
    renderSummary();
  } catch (err) {
    showError(err.message);
  }
}

// ---------- Tong hop tab ----------
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
      const off = empEntries.filter((e) => e.mode === "Nghỉ").length;
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

// ---------- Language Switcher Listeners ----------
document.getElementById("langVi").addEventListener("click", () => setLanguage("vi"));
document.getElementById("langEn").addEventListener("click", () => setLanguage("en"));

// ---------- Init ----------
(async function init() {
  try {
    setLanguage(currentLang);
    await loadEmployees();
    await renderDayEntries();
    await renderSummary();
  } catch (err) {
    showError(err.message);
  }
})();
