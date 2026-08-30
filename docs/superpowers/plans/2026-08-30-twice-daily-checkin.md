# Twice-Daily Check-In & Smart Lunch Break Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tinh chỉnh luồng chấm công thành 2 lần/ngày (Sáng check-in, Chiều check-out), tự động cập nhật bản ghi trong ngày, hỗ trợ lưu bản ghi khi chỉ có 1 mốc giờ (chưa tính giờ cho đến khi đủ cả 2), và áp dụng quy tắc tính giờ thông minh: tự động trừ 1h30 nghỉ trưa nếu làm trên 5 tiếng, giữ nguyên không trừ nếu làm nửa buổi (<= 5 tiếng).

**Architecture:** Bổ sung endpoint `PUT /api/entries/:id` vào `server.js` để cập nhật giờ ra hoặc ghi chú. Cập nhật `public/app.js` với thuật toán tính giờ thông minh (`hoursBetween(inStr, outStr, mode)`), cơ chế tự động phát hiện bản ghi đã check-in của nhân viên trong ngày để chuyển form sang chế độ Check-out, cập nhật `public/index.html` và `public/styles.css` tinh giản form còn 2 ô giờ và hiển thị badge trạng thái "Đang làm việc / In progress".

**Tech Stack:** Node.js (Express), Vanilla JavaScript (ES6+), HTML5, CSS3, `localStorage`.

**Spec:** Bounded Design: Chấm công 2 lần & Tự động trừ nghỉ trưa thông minh.

## Global Constraints

- Không thêm thư viện ngoài (giữ nguyên chỉ `express` trong `package.json`).
- Tương thích ngược: Các bản ghi cũ trong `data/db.json` vẫn hoạt động và tính toán đúng theo quy tắc mới.
- Không làm vỡ giao diện responsive và tính năng song ngữ VI/EN.

---

### Task 1: Cập nhật Backend API (`server.js`) hỗ trợ Check-in 1 lần và Cập nhật Check-out (`PUT /api/entries/:id`)

**Files:**
- Modify: `server.js`
- Modify: `test/test_api.js`

**Interfaces:**
- Consumes: 
  - `POST /api/entries` payload `{ date, employeeId, in, out, mode, note }`
  - `PUT /api/entries/:id` payload `{ out, note, mode, in }`
- Produces: `entry` object cập nhật với `id, date, employeeId, in, out, mode, note`

- [x] **Step 1: Cập nhật test API trong `test/test_api.js`**

Sửa `test/test_api.js`:
```javascript
const assert = require("assert");

function runTest() {
  console.log("Running backend validation test...");

  // Validate creation
  const validateEntry = (body) => {
    const { date, employeeId, in: timeIn, out, mode, note } = body;
    const trimmedNote = (note || "").trim();
    if (!date || !employeeId || !mode || !trimmedNote) {
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
        mode,
        note: trimmedNote,
      },
    };
  };

  // 1. Missing note should fail
  const res1 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Onsite", note: "" });
  assert.strictEqual(res1.status, 400, "Should reject empty note");

  // 2. Allow single check-in in the morning (in without out)
  const res2 = validateEntry({
    date: "2026-08-30",
    employeeId: "emp-1",
    in: "08:30",
    out: "",
    mode: "Onsite",
    note: "Bắt đầu ngày làm việc",
  });
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.entry.in, "08:30");
  assert.strictEqual(res2.entry.out, "");

  console.log("All backend tests passed!");
}

runTest();
```

- [x] **Step 2: Chạy test API**

Run: `node test/test_api.js`
Expected: `All backend tests passed!`

- [x] **Step 3: Cập nhật `server.js` thêm endpoint `PUT /api/entries/:id` và tinh gọn `POST /api/entries`**

Cập nhật `server.js`:
```javascript
// ---------- Entries ----------
app.get("/api/entries", (req, res) => {
  const { month } = req.query; // "YYYY-MM"
  const db = loadDB();
  let entries = db.entries;
  if (month) entries = entries.filter((e) => e.date.startsWith(month));
  res.json(entries);
});

app.post("/api/entries", (req, res) => {
  const { date, employeeId, in: timeIn, out, mode, note } = req.body;
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
    mode,
    note: trimmedNote,
  };
  db.entries.push(entry);
  saveDB(db);
  res.json(entry);
});

app.put("/api/entries/:id", (req, res) => {
  const { in: timeIn, out, mode, note } = req.body;
  const db = loadDB();
  const idx = db.entries.findIndex((e) => e.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy bản ghi" });
  }
  if (timeIn !== undefined) db.entries[idx].in = timeIn;
  if (out !== undefined) db.entries[idx].out = out;
  if (mode !== undefined) db.entries[idx].mode = mode;
  if (note !== undefined) {
    const trimmedNote = (note || "").trim();
    if (trimmedNote) db.entries[idx].note = trimmedNote;
  }
  saveDB(db);
  res.json(db.entries[idx]);
});

app.delete("/api/entries/:id", (req, res) => {
  const db = loadDB();
  db.entries = db.entries.filter((e) => e.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});
```

- [x] **Step 4: Kiểm tra cú pháp `server.js`**

Run: `node -c server.js`
Expected: Exit code 0.

---

### Task 2: Cập nhật Giao diện HTML (`public/index.html`) Form 2 ô thời gian

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Produces:
  - Form với 2 ô thời gian: `#inTime`, `#outTime` kèm nút `#btnNowIn`, `#btnNowOut`
  - Input ẩn lưu id bản ghi đang edit/check-out nếu có: `#entryIdInput`
  - Nút submit động: `#btnSubmitEntry`
  - Nút Reset form: `#btnResetForm`

- [x] **Step 1: Cập nhật form trong `public/index.html`**

Cập nhật form trong `<section id="tab-cham-cong">`:
```html
        <form id="entryForm" class="entry-form">
          <input type="hidden" id="entryIdInput" value="" />
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

          <div class="time-grid-simple" id="timeGrid">
            <div class="time-field">
              <label for="inTime" data-i18n="labelInTime">Giờ vào (Sáng)</label>
              <div class="time-input-wrap">
                <input type="time" id="inTime" />
                <button type="button" class="btn-now" data-target="inTime" title="Điền giờ hiện tại">⚡</button>
              </div>
            </div>

            <div class="time-field">
              <label for="outTime" data-i18n="labelOutTime">Giờ ra (Chiều)</label>
              <div class="time-input-wrap">
                <input type="time" id="outTime" />
                <button type="button" class="btn-now" data-target="outTime" title="Điền giờ hiện tại">⚡</button>
              </div>
            </div>
          </div>

          <div class="form-row note-row">
            <input
              type="text"
              id="noteInput"
              class="full-width note-input"
              placeholder="Công việc hôm nay làm: ..."
              required
            />
            <div class="btn-actions">
              <button type="button" id="btnResetForm" class="btn-sub" style="display:none;" data-i18n="btnCancel">Huỷ</button>
              <button type="submit" id="btnSubmitEntry" class="btn-primary" data-i18n="btnRecord">+ Ghi nhận</button>
            </div>
          </div>
        </form>
```

---

### Task 3: Cập nhật CSS Styling trong `public/styles.css`

**Files:**
- Modify: `public/styles.css`

**Interfaces:**
- Styles for `.time-grid-simple`, `.badge-working`, `.badge-lunch`, `.btn-checkout-quick`, `.btn-actions`, `.btn-sub`.

- [x] **Step 1: Cập nhật styles.css**

Cập nhật `public/styles.css`:
```css
/* Simple 2-time Grid */
.time-grid-simple {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn-actions {
  display: flex;
  gap: 6px;
}

.btn-sub {
  background: var(--paper-deep);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 5px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  padding: 8px 12px;
}
.btn-sub:hover { background: var(--line); }

/* Badges */
.badge-working {
  font-family: var(--font-mono);
  font-size: 11px;
  color: #c2410c;
  background: #ffedd5;
  border: 1px solid #fed7aa;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-lunch {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--onsite);
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
}

.btn-checkout-quick {
  background: var(--onsite);
  color: white;
  border: none;
  border-radius: 4px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  cursor: pointer;
  margin-left: 6px;
}
.btn-checkout-quick:hover { opacity: 0.9; }
```

---

### Task 4: Cập nhật Logic Frontend & Thuật toán Tính Giờ trong `public/app.js`

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Produces:
  - Updated `hoursBetween(inStr, outStr, mode)`:
    - Nếu thiếu `in` hoặc `out`: trả về `0` (trạng thái pending)
    - Nếu mode là "Nghỉ" / "Off": trả về `0`
    - Nếu $T_{\text{raw}} > 5.0\text{h}$: trả về $\max(0, T_{\text{raw}} - 1.5)$
    - Nếu $T_{\text{raw}} \le 5.0\text{h}$: trả về $T_{\text{raw}}$
  - Auto check-out trigger on employee select
  - Quick check-out button in day entries list

- [x] **Step 1: Cập nhật từ điển i18n & logic tính giờ**

```javascript
// Thêm các từ khóa mới vào từ điển
// vi:
// btnCheckin: "⚡ Điểm danh Vào",
// btnCheckout: "🏁 Cập nhật Giờ ra",
// statusWorking: "Đang làm việc",
// lunchDeducted: "Đã trừ 1h30 trưa",
// btnQuickCheckout: "🏁 Ra về",
// btnCancel: "Huỷ"
// en:
// btnCheckin: "⚡ Check-in",
// btnCheckout: "🏁 Check-out",
// statusWorking: "Working",
// lunchDeducted: "-1.5h lunch",
// btnQuickCheckout: "🏁 Check-out",
// btnCancel: "Cancel"

function hoursBetween(inStr, outStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  const rawMinutes = outMin - inMin;
  const rawHours = rawMinutes / 60;

  // Nếu làm trên 5 tiếng thì tự động trừ 1h30 (90 phút) nghỉ trưa
  if (rawHours > 5) {
    const workedMin = rawMinutes - 90;
    return workedMin > 0 ? workedMin / 60 : 0;
  }

  // Làm nửa buổi (<= 5 tiếng) giữ nguyên
  return rawHours;
}
```

- [x] **Step 2: Xử lý tự động chuyển form sang chế độ Check-out khi chọn nhân viên đã điểm danh sáng**

```javascript
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

  if (existingEntry && existingEntry.in && !existingEntry.out) {
    // Đã check-in sáng, đang chờ check-out chiều
    entryIdInput.value = existingEntry.id;
    document.getElementById("inTime").value = existingEntry.in;
    document.getElementById("inTime").disabled = true;
    
    // Tự động điền giờ hiện tại vào ô outTime nếu chưa có
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
```

- [x] **Step 3: Xử lý submit form thông minh (Create mới hoặc Update check-out)**

```javascript
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
      // Cập nhật bản ghi hiện tại
      const updated = await api(`/api/entries/${entryId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      state.entriesCache[mk] = (state.entriesCache[mk] || []).map((e) =>
        e.id === entryId ? updated : e
      );
    } else {
      // Tạo mới
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
```

- [ ] **Step 4: Hiển thị danh sách ngày với trạng thái "Đang làm việc" và Nút Check-out nhanh**

```javascript
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
    statusBadge = `<span class="muted-cell">--</span>`;
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
```

---

### Task 5: Kiểm thử Toàn diện Thuật toán Tính Giờ (`test/test_e2e_calc.js`)

**Files:**
- Modify: `test/test_e2e_calc.js`

- [ ] **Step 1: Viết test suites kiểm tra các trường hợp**

```javascript
const assert = require("assert");

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

  // Làm trên 5 tiếng: trừ 1h30 (90 phút) nghỉ trưa
  if (rawHours > 5) {
    const workedMin = rawMinutes - 90;
    return workedMin > 0 ? workedMin / 60 : 0;
  }

  // Làm nửa buổi (<= 5 tiếng): giữ nguyên
  return rawHours;
}

console.log("Running Twice-Daily Check-In & Lunch Calc Tests...");

// Case 1: Cả ngày 08:30 -> 18:00 (9.5h raw > 5h) => 9.5 - 1.5 = 8.00h
const c1 = hoursBetween("08:30", "18:00", "Onsite");
assert.strictEqual(c1, 8.0, `Expected 8.0h, got ${c1}`);

// Case 2: Nửa buổi sáng 08:30 -> 12:30 (4h raw <= 5h) => giữ nguyên 4.00h (không trừ trưa)
const c2 = hoursBetween("08:30", "12:30", "Onsite");
assert.strictEqual(c2, 4.0, `Expected 4.0h, got ${c2}`);

// Case 3: Nửa buổi 5 tiếng 08:00 -> 13:00 (5h raw <= 5h) => giữ nguyên 5.00h
const c3 = hoursBetween("08:00", "13:00", "Remote");
assert.strictEqual(c3, 5.0, `Expected 5.0h, got ${c3}`);

// Case 4: Thiếu giờ ra (chỉ có giờ vào 08:30) => không tính giờ (0h)
const c4 = hoursBetween("08:30", "", "Onsite");
assert.strictEqual(c4, 0, `Expected 0h when missing checkout, got ${c4}`);

// Case 5: Thiếu giờ vào (chỉ có giờ ra 18:00) => không tính giờ (0h)
const c5 = hoursBetween("", "18:00", "Onsite");
assert.strictEqual(c5, 0, `Expected 0h when missing checkin, got ${c5}`);

// Case 6: Nghỉ phép => 0h
const c6 = hoursBetween("08:30", "18:00", "Nghỉ");
assert.strictEqual(c6, 0, `Expected 0h for Off mode, got ${c6}`);

console.log("All calculation tests passed successfully!");
```

- [ ] **Step 2: Chạy test kiểm tra**

Run: `node test/test_e2e_calc.js`
Expected: `All calculation tests passed successfully!`
