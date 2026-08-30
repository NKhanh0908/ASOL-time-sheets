const state = {
  employees: [],
  entriesCache: {}, // monthKey -> array
};

// ---------- Helpers ----------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthKeyOf(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}
function hoursBetween(inStr, outStr) {
  if (!inStr || !outStr) return 0;
  const [ih, im] = inStr.split(":").map(Number);
  const [oh, om] = outStr.split(":").map(Number);
  const diff = oh * 60 + om - (ih * 60 + im);
  return diff > 0 ? diff / 60 : 0;
}
function fmtHours(h) {
  return h.toFixed(2).replace(".", ",") + "h";
}
function weekdayVN(dateStr) {
  const days = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
  return days[new Date(dateStr + "T00:00:00").getDay()];
}
function monthLabel(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-");
  return `Tháng ${parseInt(m, 10)}/${y}`;
}
function empName(id) {
  return state.employees.find((e) => e.id === id)?.name || "(đã xoá)";
}
function showError(msg) {
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.style.display = "block";
  setTimeout(() => (box.style.display = "none"), 4000);
}

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
  document.getElementById("empCount").textContent = `${state.employees.length} nhân viên`;
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
  empSelect.innerHTML = '<option value="">Nhân viên</option>';
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
  weekdayLabel.textContent = weekdayVN(date);
  const mk = monthKeyOf(date);
  const list = document.getElementById("entryList");
  list.innerHTML = '<div class="empty-state">Đang tải...</div>';
  try {
    const monthEntries = await ensureMonthLoaded(mk);
    const dayEntries = monthEntries.filter((e) => e.date === date);
    if (dayEntries.length === 0) {
      list.innerHTML = '<div class="empty-state">Chưa có ai chấm công ngày này.</div>';
      return;
    }
    list.innerHTML = "";
    dayEntries.forEach((e) => {
      const h = hoursBetween(e.in, e.out);
      const row = document.createElement("div");
      row.className = "entry-row";
      row.style.borderLeft = `3px solid var(--${e.mode === "Onsite" ? "onsite" : e.mode === "Remote" ? "remote" : "off"})`;
      row.innerHTML = `
        <span class="name">${empName(e.employeeId)}</span>
        <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}</span>
        <span class="hours">${fmtHours(h)}</span>
        <span class="stamp ${e.mode}">${e.mode}</span>
        ${e.note ? `<span class="note">${e.note}</span>` : ""}
        <button class="del-btn" data-id="${e.id}" aria-label="Xoá">🗑</button>
      `;
      row.querySelector(".del-btn").addEventListener("click", () => deleteEntry(e.id, mk));
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = '<div class="empty-state">Không tải được dữ liệu.</div>';
    showError(err.message);
  }
}

dateInput.addEventListener("change", renderDayEntries);

entryForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const employeeId = empSelect.value;
  if (!employeeId) return;
  const payload = {
    date: dateInput.value,
    employeeId,
    in: document.getElementById("inTime").value,
    out: document.getElementById("outTime").value,
    mode: document.getElementById("modeSelect").value,
    note: document.getElementById("noteInput").value,
  };
  try {
    const entry = await api("/api/entries", { method: "POST", body: JSON.stringify(payload) });
    const mk = monthKeyOf(entry.date);
    state.entriesCache[mk] = [...(state.entriesCache[mk] || []), entry];
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
    list.innerHTML = '<div class="empty-state">Chưa có nhân viên nào.</div>';
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
    box.innerHTML = '<div class="empty-state">Chưa có nhân viên nào để tổng hợp.</div>';
    return;
  }
  box.innerHTML = '<div class="empty-state">Đang tải...</div>';
  try {
    const entries = await ensureMonthLoaded(mk);
    let grand = 0;
    const rows = state.employees.map((emp) => {
      const rows = entries.filter((e) => e.employeeId === emp.id);
      const total = rows.reduce((s, e) => s + hoursBetween(e.in, e.out), 0);
      const onsite = rows.filter((e) => e.mode === "Onsite").length;
      const remote = rows.filter((e) => e.mode === "Remote").length;
      const off = rows.filter((e) => e.mode === "Nghỉ").length;
      grand += total;
      return { name: emp.name, total, onsite, remote, off };
    });
    box.innerHTML = `
      <div class="summary-row header">
        <div>NHÂN VIÊN</div><div>TỔNG GIỜ</div><div>ONSITE / REMOTE</div><div>NGHỈ</div>
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
        <div>TỔNG CỘNG</div><div class="mono-cell">${fmtHours(grand)}</div><div></div><div></div>
      </div>
    `;
  } catch (err) {
    box.innerHTML = '<div class="empty-state">Không tải được dữ liệu.</div>';
    showError(err.message);
  }
}

monthInput.addEventListener("change", renderSummary);

// ---------- Init ----------
(async function init() {
  try {
    await loadEmployees();
    await renderDayEntries();
    await renderSummary();
  } catch (err) {
    showError(err.message);
  }
})();
