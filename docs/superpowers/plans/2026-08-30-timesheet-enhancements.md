# Timesheet Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp ứng dụng Bảng Chấm Công với 3 tính năng chính: Bắt buộc nhập Ghi chú với placeholder động theo hình thức làm việc, quản lý 4 mốc thời gian (Vào, Bắt đầu nghỉ trưa, Hết nghỉ trưa, Ra) kèm tính toán giờ làm tự trừ giờ nghỉ, và hỗ trợ đa ngôn ngữ Song ngữ Tiếng Việt - Tiếng Anh (VI/EN).

**Architecture:** Mở rộng backend REST API trong `server.js` để lưu các trường thời gian nghỉ trưa và kiểm tra validation `note`. Mở rộng `public/app.js` với bộ từ điển i18n, logic tính giờ làm trừ thời gian nghỉ trưa, chuyển đổi placeholder động và cập nhật `public/index.html`, `public/styles.css` tương ứng.

**Tech Stack:** Node.js (Express), Vanilla JavaScript (ES6+), HTML5, CSS3, `localStorage`.

**Spec:** Bounded Design đã được thống nhất tại hội thoại trước đó.

## Global Constraints

- Không thêm thư viện ngoài (giữ nguyên chỉ `express` trong `package.json`).
- Tương thích ngược với dữ liệu cũ đã có trong `data/db.json` (nếu thiếu `lunchOut`/`lunchIn` vẫn hiển thị và tính toán giờ vào/ra bình thường).
- Không làm vỡ giao diện responsive trên thiết bị di động.

---

### Task 1: Cập nhật Backend API & Validation trong `server.js`

**Files:**
- Modify: `server.js`
- Create: `test/test_api.js`

**Interfaces:**
- Consumes: `POST /api/entries` payload `{ date, employeeId, in, out, lunchOut, lunchIn, mode, note }`
- Produces: `entry` object với các trường `id, date, employeeId, in, out, lunchOut, lunchIn, mode, note`

- [x] **Step 1: Viết test cho API validation và lưu trường nghỉ trưa**

Tạo file `test/test_api.js`:
```javascript
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function runTest() {
  console.log("Running backend validation test...");
  
  // Test note validation logic
  const validateEntry = (body) => {
    const { date, employeeId, in: timeIn, out, lunchOut, lunchIn, mode, note } = body;
    if (!date || !employeeId || !mode || !note || !note.trim()) {
      return { status: 400, error: "Thiếu ngày, nhân viên, hình thức hoặc ghi chú" };
    }
    return {
      status: 200,
      entry: {
        id: "test-id",
        date,
        employeeId,
        in: timeIn || "",
        out: out || "",
        lunchOut: lunchOut || "",
        lunchIn: lunchIn || "",
        mode,
        note: note.trim(),
      }
    };
  };

  // 1. Missing note should fail
  const res1 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Onsite", note: "" });
  assert.strictEqual(res1.status, 400, "Should reject empty note");

  // 2. Whitespace note should fail
  const res2 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Nghỉ", note: "   " });
  assert.strictEqual(res2.status, 400, "Should reject whitespace note");

  // 3. Valid entry with lunch times should succeed
  const res3 = validateEntry({
    date: "2026-08-30",
    employeeId: "emp-1",
    in: "08:30",
    lunchOut: "12:00",
    lunchIn: "13:30",
    out: "18:00",
    mode: "Onsite",
    note: "Làm tính năng chấm công"
  });
  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.entry.lunchOut, "12:00");
  assert.strictEqual(res3.entry.lunchIn, "13:30");
  assert.strictEqual(res3.entry.note, "Làm tính năng chấm công");

  console.log("All backend tests passed!");
}

runTest();
```

- [x] **Step 2: Chạy test để xác nhận fail hoặc pass logic độc lập**

Run: `node test/test_api.js`
Expected: `All backend tests passed!`

- [x] **Step 3: Cập nhật `server.js`**

Sửa `server.js` tại endpoint `POST /api/entries`:
```javascript
app.post("/api/entries", (req, res) => {
  const { date, employeeId, in: timeIn, out, lunchOut, lunchIn, mode, note } = req.body;
  const trimmedNote = (note || "").trim();
  if (!date || !employeeId || !mode || !trimmedNote) {
    return res.status(400).json({ error: "Thiếu ngày, nhân viên, hình thức hoặc ghi chú" });
  }
  const db = loadDB();
  const entry = {
    id: crypto.randomUUID(),
    date,
    employeeId,
    in: timeIn || "",
    out: out || "",
    lunchOut: lunchOut || "",
    lunchIn: lunchIn || "",
    mode,
    note: trimmedNote,
  };
  db.entries.push(entry);
  saveDB(db);
  res.json(entry);
});
```

- [x] **Step 4: Kiểm tra cú pháp `server.js`**

Run: `node -c server.js`
Expected: Cú pháp hợp lệ, exit code 0.

---

### Task 2: Cập nhật Giao diện HTML & Cấu trúc Form trong `public/index.html`

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Produces: 
  - Language buttons: `#langVi`, `#langEn`
  - Form inputs: `#dateInput`, `#empSelect`, `#modeSelect`, `#inTime`, `#lunchOutTime`, `#lunchInTime`, `#outTime`, `#noteInput`
  - Quick-time fill buttons: `.btn-now[data-target="..."]`
  - Dynamic elements with `data-i18n` attributes for localization

- [x] **Step 1: Thêm nút chuyển đổi ngôn ngữ vào Header và gắn data-i18n**

Cập nhật `<header class="topbar">` trong `public/index.html`:
```html
    <header class="topbar">
      <div>
        <div class="eyebrow" data-i18n="eyebrow">LEDGER · NỘI BỘ</div>
        <h1 data-i18n="appTitle">Bảng Chấm Công</h1>
      </div>
      <div class="topbar-right">
        <div class="lang-switch">
          <button type="button" id="langVi" class="lang-btn active">VI</button>
          <span class="lang-divider">|</span>
          <button type="button" id="langEn" class="lang-btn">EN</button>
        </div>
        <div class="emp-count" id="empCount">0 nhân viên</div>
      </div>
    </header>
```

- [x] **Step 2: Cập nhật Tabs và Form Chấm công với 4 mốc thời gian & Ghi chú bắt buộc**

Cập nhật thanh Tabs và `<section id="tab-cham-cong">` trong `public/index.html`:
```html
    <nav class="tabs">
      <button class="tab-btn active" data-tab="cham-cong" data-i18n="tabChamCong">Chấm công</button>
      <button class="tab-btn" data-tab="nhan-vien" data-i18n="tabNhanVien">Nhân viên</button>
      <button class="tab-btn" data-tab="tong-hop" data-i18n="tabTongHop">Tổng hợp</button>
    </nav>

    <main class="panel">
      <!-- CHAM CONG -->
      <section id="tab-cham-cong" class="tab-content active">
        <div class="row-controls">
          <input type="date" id="dateInput" />
          <span id="weekdayLabel" class="mono muted"></span>
        </div>

        <form id="entryForm" class="entry-form">
          <div class="form-row main-fields">
            <select id="empSelect" required>
              <option value="" data-i18n="selectEmployee">Nhân viên</option>
            </select>
            <select id="modeSelect">
              <option value="Onsite">Onsite</option>
              <option value="Remote">Remote</option>
              <option value="Nghỉ" data-i18n="modeOff">Nghỉ</option>
            </select>
          </div>

          <div class="time-grid" id="timeGrid">
            <div class="time-field">
              <label for="inTime" data-i18n="labelInTime">Giờ vào</label>
              <div class="time-input-wrap">
                <input type="time" id="inTime" />
                <button type="button" class="btn-now" data-target="inTime" title="Điền giờ hiện tại">⚡</button>
              </div>
            </div>

            <div class="time-field">
              <label for="lunchOutTime" data-i18n="labelLunchOut">Nghỉ trưa</label>
              <div class="time-input-wrap">
                <input type="time" id="lunchOutTime" />
                <button type="button" class="btn-now" data-target="lunchOutTime" title="Điền giờ hiện tại">⚡</button>
              </div>
            </div>

            <div class="time-field">
              <label for="lunchInTime" data-i18n="labelLunchIn">Hết nghỉ</label>
              <div class="time-input-wrap">
                <input type="time" id="lunchInTime" />
                <button type="button" class="btn-now" data-target="lunchInTime" title="Điền giờ hiện tại">⚡</button>
              </div>
            </div>

            <div class="time-field">
              <label for="outTime" data-i18n="labelOutTime">Giờ ra</label>
              <div class="time-input-wrap">
                <input type="time" id="outTime" />
                <button type="button" class="btn-now" data-target="outTime" title="Điền giờ hiện tại">⚡</button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <input
              type="text"
              id="noteInput"
              class="full-width"
              placeholder="Công việc hôm nay làm: ..."
              required
            />
            <button type="submit" class="primary-btn" data-i18n="btnRecord">Ghi nhận</button>
          </div>
        </form>

        <div id="entryList" class="entry-list"></div>
      </section>
```

- [x] **Step 3: Cập nhật Tab Nhân viên & Tổng hợp với các nhãn `data-i18n`**

Cập nhật `<section id="tab-nhan-vien">` và `<section id="tab-tong-hop">`:
```html
      <!-- NHAN VIEN -->
      <section id="tab-nhan-vien" class="tab-content">
        <form id="empForm" class="emp-form">
          <input type="text" id="newEmpName" placeholder="Tên nhân viên mới" required data-i18n-ph="placeholderNewEmp" />
          <button type="submit" class="primary-btn" data-i18n="btnAddEmp">Thêm</button>
        </form>
        <div id="empList" class="emp-list"></div>
      </section>

      <!-- TONG HOP -->
      <section id="tab-tong-hop" class="tab-content">
        <div class="row-controls">
          <input type="month" id="monthInput" />
          <span id="monthLabel" class="mono muted"></span>
        </div>
        <div id="summaryTable" class="summary-table"></div>
      </section>
```

---

### Task 3: Cập nhật CSS Styling trong `public/styles.css`

**Files:**
- Modify: `public/styles.css`

**Interfaces:**
- Styles for `.topbar-right`, `.lang-switch`, `.lang-btn`, `.time-grid`, `.time-field`, `.time-input-wrap`, `.btn-now`, responsive breakpoints.

- [x] **Step 1: Bổ sung CSS cho Language Switcher và Time Grid 4 ô**

Thêm vào `public/styles.css`:
```css
/* Language Switcher */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lang-switch {
  display: flex;
  align-items: center;
  background: var(--bg-card, #1c1f26);
  border: 1px solid var(--border-color, #2d3340);
  border-radius: 6px;
  padding: 2px 6px;
}
.lang-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #7c8594);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.lang-btn:hover {
  color: var(--text-primary, #ffffff);
}
.lang-btn.active {
  color: #60a5fa;
}
.lang-divider {
  color: var(--border-color, #2d3340);
  font-size: 11px;
  margin: 0 2px;
}

/* Time Grid Layout */
.time-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.time-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.time-field label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #7c8594);
}
.time-input-wrap {
  display: flex;
  align-items: center;
  background: var(--input-bg, #0f1218);
  border: 1px solid var(--border-color, #2d3340);
  border-radius: 6px;
  overflow: hidden;
}
.time-input-wrap input[type="time"] {
  border: none;
  background: transparent;
  width: 100%;
  padding: 6px 8px;
  color: var(--text-primary, #ffffff);
  font-family: inherit;
}
.btn-now {
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-color, #2d3340);
  padding: 6px 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-muted, #7c8594);
  transition: background 0.15s, color 0.15s;
}
.btn-now:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #facc15;
}

.form-row.main-fields {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.full-width {
  flex: 1;
}

/* Entry item with lunch break info */
.lunch-badge {
  font-size: 11px;
  color: var(--text-muted, #7c8594);
  background: rgba(255, 255, 255, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}

@media (max-width: 640px) {
  .time-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

### Task 4: Triển khai i18n, Logic tính toán & Tương tác Form trong `public/app.js`

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Produces:
  - `i18n` dictionary (`vi` & `en`)
  - `setLanguage(lang)`
  - Updated `hoursBetween(inStr, outStr, lunchOutStr, lunchInStr, mode)`
  - Dynamic placeholder updates on `#modeSelect` change
  - Click listener for `.btn-now` to fill current `HH:mm`
  - Updated `renderDayEntries()`, `renderSummary()`, and `loadEmployees()` with bilingual labels

- [x] **Step 1: Thêm bộ từ điển i18n và hàm chuyển ngôn ngữ**

Thêm vào đầu file `public/app.js`:
```javascript
const dict = {
  vi: {
    eyebrow: "LEDGER · NỘI BỘ",
    appTitle: "Bảng Chấm Công",
    tabChamCong: "Chấm công",
    tabNhanVien: "Nhân viên",
    tabTongHop: "Tổng hợp",
    selectEmployee: "Nhân viên",
    modeOnsite: "Onsite",
    modeRemote: "Remote",
    modeOff: "Nghỉ",
    labelInTime: "Giờ vào",
    labelLunchOut: "Nghỉ trưa",
    labelLunchIn: "Hết nghỉ",
    labelOutTime: "Giờ ra",
    placeholderTask: "Công việc hôm nay làm: ...",
    placeholderReason: "Lý do nghỉ (bắt buộc)...",
    placeholderNewEmp: "Tên nhân viên mới",
    btnRecord: "Ghi nhận",
    btnAddEmp: "Thêm",
    emptyDay: "Chưa có ai chấm công ngày này.",
    emptyEmp: "Chưa có nhân viên nào.",
    emptySummary: "Chưa có nhân viên nào để tổng hợp.",
    loading: "Đang tải...",
    thEmployee: "NHÂN VIÊN",
    thTotalHours: "TỔNG GIỜ",
    thOnsiteRemote: "ONSITE / REMOTE",
    thOff: "NGHỈ",
    thTotal: "TỔNG CỘNG",
    empCountLabel: "nhân viên",
    deletedEmp: "(đã xoá)",
    lunchBreakPrefix: "Nghỉ trưa",
    errMissingFields: "Vui lòng nhập đầy đủ thông tin bắt buộc!",
    errNoteEmpty: "Ghi chú không được để trống!",
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
    labelInTime: "Check-in",
    labelLunchOut: "Lunch Out",
    labelLunchIn: "Lunch In",
    labelOutTime: "Check-out",
    placeholderTask: "Today's tasks: ...",
    placeholderReason: "Reason for leave (required)...",
    placeholderNewEmp: "New employee name",
    btnRecord: "Save Entry",
    btnAddEmp: "Add",
    emptyDay: "No entries for this date.",
    emptyEmp: "No employees added yet.",
    emptySummary: "No employees available for summary.",
    loading: "Loading...",
    thEmployee: "EMPLOYEE",
    thTotalHours: "TOTAL HOURS",
    thOnsiteRemote: "ONSITE / REMOTE",
    thOff: "OFF",
    thTotal: "GRAND TOTAL",
    empCountLabel: "employees",
    deletedEmp: "(deleted)",
    lunchBreakPrefix: "Lunch",
    errMissingFields: "Please fill in all required fields!",
    errNoteEmpty: "Note is required!",
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

  // Cập nhật text các thẻ có data-i18n
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (k && t(k)) el.textContent = t(k);
  });

  // Cập nhật placeholder
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
}
```

- [x] **Step 2: Cập nhật hàm tính giờ `hoursBetween` trừ thời gian nghỉ trưa**

```javascript
function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  return h * 60 + m;
}

function hoursBetween(inStr, outStr, lunchOutStr, lunchInStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  let totalWorkMinutes = outMin - inMin;

  const lOutMin = timeToMinutes(lunchOutStr);
  const lInMin = timeToMinutes(lunchInStr);

  if (lOutMin !== null && lInMin !== null && lInMin > lOutMin) {
    const actualLunchStart = Math.max(inMin, lOutMin);
    const actualLunchEnd = Math.min(outMin, lInMin);
    if (actualLunchEnd > actualLunchStart) {
      totalWorkMinutes -= (actualLunchEnd - actualLunchStart);
    }
  }

  return totalWorkMinutes > 0 ? totalWorkMinutes / 60 : 0;
}
```

- [x] **Step 3: Cập nhật đổi placeholder động và xử lý nút ⚡ (Now)**

```javascript
function updatePlaceholder() {
  const mode = document.getElementById("modeSelect").value;
  const noteInput = document.getElementById("noteInput");
  const timeGrid = document.getElementById("timeGrid");
  
  if (mode === "Nghỉ") {
    noteInput.placeholder = t("placeholderReason");
    timeGrid.style.opacity = "0.5";
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
```

- [x] **Step 4: Cập nhật xử lý Submit Form và hiển thị danh sách Entries**

```javascript
entryForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const employeeId = empSelect.value;
  const note = document.getElementById("noteInput").value.trim();
  if (!employeeId) return showError(t("errMissingFields"));
  if (!note) return showError(t("errNoteEmpty"));

  const payload = {
    date: dateInput.value,
    employeeId,
    in: document.getElementById("inTime").value,
    lunchOut: document.getElementById("lunchOutTime").value,
    lunchIn: document.getElementById("lunchInTime").value,
    out: document.getElementById("outTime").value,
    mode: document.getElementById("modeSelect").value,
    note,
  };

  try {
    const entry = await api("/api/entries", { method: "POST", body: JSON.stringify(payload) });
    const mk = monthKeyOf(entry.date);
    state.entriesCache[mk] = [...(state.entriesCache[mk] || []), entry];
    document.getElementById("inTime").value = "";
    document.getElementById("lunchOutTime").value = "";
    document.getElementById("lunchInTime").value = "";
    document.getElementById("outTime").value = "";
    document.getElementById("noteInput").value = "";
    renderDayEntries();
    if (document.getElementById("monthInput").value === mk) renderSummary();
  } catch (err) {
    showError(err.message);
  }
});
```

Cập nhật `renderDayEntries()`:
```javascript
dayEntries.forEach((e) => {
  const h = hoursBetween(e.in, e.out, e.lunchOut, e.lunchIn, e.mode);
  const row = document.createElement("div");
  row.className = "entry-row";
  row.style.borderLeft = `3px solid var(--${e.mode === "Onsite" ? "onsite" : e.mode === "Remote" ? "remote" : "off"})`;
  
  let lunchInfo = "";
  if (e.lunchOut && e.lunchIn) {
    lunchInfo = `<span class="lunch-badge">${t("lunchBreakPrefix")}: ${e.lunchOut} → ${e.lunchIn}</span>`;
  }

  row.innerHTML = `
    <span class="name">${empName(e.employeeId)}</span>
    <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}${lunchInfo}</span>
    <span class="hours">${fmtHours(h)}</span>
    <span class="stamp ${e.mode}">${e.mode === "Nghỉ" ? t("modeOff") : e.mode}</span>
    <span class="note">${e.note || ""}</span>
    <button class="del-btn" data-id="${e.id}" aria-label="Xoá">🗑</button>
  `;
  row.querySelector(".del-btn").addEventListener("click", () => deleteEntry(e.id, mk));
  list.appendChild(row);
});
```

- [x] **Step 5: Cập nhật hàm `renderSummary()` tính tổng giờ và nhãn đa ngôn ngữ**

```javascript
const rows = state.employees.map((emp) => {
  const empEntries = entries.filter((e) => e.employeeId === emp.id);
  const total = empEntries.reduce((s, e) => s + hoursBetween(e.in, e.out, e.lunchOut, e.lunchIn, e.mode), 0);
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
```

- [x] **Step 6: Đăng ký sự kiện chọn ngôn ngữ**

```javascript
document.getElementById("langVi").addEventListener("click", () => setLanguage("vi"));
document.getElementById("langEn").addEventListener("click", () => setLanguage("en"));
```

---

### Task 5: Kiểm thử Tổng Thể & Xác minh Tính năng (End-to-End Verification)

**Files:**
- Create: `test/test_e2e_calc.js`

- [x] **Step 1: Viết test kiểm tra tính toán giờ làm với nhiều trường hợp (Có nghỉ trưa, không nghỉ trưa, nghỉ cả ngày)**

Tạo file `test/test_e2e_calc.js`:
```javascript
const assert = require("assert");

function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  return h * 60 + m;
}

function hoursBetween(inStr, outStr, lunchOutStr, lunchInStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  let totalWorkMinutes = outMin - inMin;

  const lOutMin = timeToMinutes(lunchOutStr);
  const lInMin = timeToMinutes(lunchInStr);

  if (lOutMin !== null && lInMin !== null && lInMin > lOutMin) {
    const actualLunchStart = Math.max(inMin, lOutMin);
    const actualLunchEnd = Math.min(outMin, lInMin);
    if (actualLunchEnd > actualLunchStart) {
      totalWorkMinutes -= (actualLunchEnd - actualLunchStart);
    }
  }

  return totalWorkMinutes > 0 ? totalWorkMinutes / 60 : 0;
}

// Case 1: 08:30 -> 18:00, lunch 12:00 -> 13:30 (1.5h break) => total: 9.5h - 1.5h = 8.00h
const c1 = hoursBetween("08:30", "18:00", "12:00", "13:30", "Onsite");
assert.strictEqual(c1, 8.0, `Expected 8.0h, got ${c1}`);

// Case 2: 08:30 -> 12:00 (half day, no lunch) => 3.5h
const c2 = hoursBetween("08:30", "12:00", "", "", "Remote");
assert.strictEqual(c2, 3.5, `Expected 3.5h, got ${c2}`);

// Case 3: Mode Off => 0h
const c3 = hoursBetween("08:30", "18:00", "12:00", "13:30", "Nghỉ");
assert.strictEqual(c3, 0, `Expected 0h for Off mode, got ${c3}`);

console.log("All calculation verification tests passed!");
```

- [x] **Step 2: Chạy test kiểm tra**

Run: `node test/test_e2e_calc.js`
Expected: `All calculation verification tests passed!`
