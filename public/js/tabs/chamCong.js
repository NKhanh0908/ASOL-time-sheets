import { state } from "../state.js";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { todayStr, monthKeyOf, timeToMinutes, hoursBetween, fmtHours, weekdayLabelFor } from "../utils/time.js";
import { showToast, setBtnLoading, renderPagination, showConfirmDialog } from "../utils/ui.js";

export function empName(id) {
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) {
    if (!state.isAdmin && state.currentUser && state.currentUser.id === id) {
      return state.currentUser.code ? `[${state.currentUser.code}] ${state.currentUser.name}` : state.currentUser.name;
    }
    return t("deletedEmp");
  }
  return emp.code ? `[${emp.code}] ${emp.name}` : emp.name;
}

export function updateEmpCount() {
  const count = state.employees.length;
  const el = document.getElementById("empCount");
  if (el) el.textContent = `${count} ${t("empCountLabel")}`;
}

export async function ensureMonthLoaded(mk) {
  if (state.entriesCache[mk]) return state.entriesCache[mk];
  const data = await api(`/api/entries?month=${mk}`);
  state.entriesCache[mk] = data;
  return data;
}

export function renderEmployeeSelect() {
  const empSelect = document.getElementById("empSelect");
  if (!empSelect) return;

  if (!state.isAdmin && state.currentUser) {
    empSelect.innerHTML = `<option value="${state.currentUser.id}">[${state.currentUser.code}] ${state.currentUser.name}</option>`;
    empSelect.value = state.currentUser.id;
    empSelect.required = false;
    empSelect.disabled = false;
    return;
  }

  empSelect.disabled = false;
  empSelect.required = true;
  const keep = empSelect.value;
  empSelect.innerHTML = `<option value="">${t("selectEmployee")}</option>`;
  state.employees.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.code ? `[${e.code}] ${e.name}` : e.name;
    empSelect.appendChild(opt);
  });
  empSelect.value = keep;
}

/**
 * Điều khiển trạng thái khóa/mở giữa Giờ vào (Check-in) và Giờ ra (Check-out)
 * - "no_checkin": Chưa check-in -> inTime MỞ, outTime KHÓA (kèm nút fill)
 * - "waiting_checkout": Đã check-in sáng, chờ check-out -> inTime KHÓA, outTime MỞ (kèm nút fill)
 * - "completed_locked": Đã hoàn tất cả 2 mốc hoặc nghỉ -> Toàn bộ form KHÓA (chống ghi nhận đè)
 * - "off": Nghỉ -> Cả 2 mốc giờ đều KHÓA & Xóa rỗng
 */
export function applyTimeFieldLockState(stateType) {
  const inTimeInput = document.getElementById("inTime");
  const outTimeInput = document.getElementById("outTime");
  const inTimeWrap = inTimeInput?.closest(".time-input-wrap");
  const outTimeWrap = outTimeInput?.closest(".time-input-wrap");
  const btnNowIn = document.querySelector('.btn-now[data-target="inTime"]');
  const btnNowOut = document.querySelector('.btn-now[data-target="outTime"]');
  const noteInput = document.getElementById("noteInput");
  const modeSelect = document.getElementById("modeSelect");
  const btnSubmit = document.getElementById("btnSubmitEntry");
  const tagChips = document.querySelectorAll(".tag-chip");

  if (stateType === "completed_locked") {
    if (inTimeInput) inTimeInput.disabled = true;
    if (outTimeInput) outTimeInput.disabled = true;
    if (btnNowIn) btnNowIn.disabled = true;
    if (btnNowOut) btnNowOut.disabled = true;
    if (noteInput) noteInput.disabled = true;
    if (modeSelect) modeSelect.disabled = true;
    if (btnSubmit) btnSubmit.disabled = true;
    tagChips.forEach((chip) => { chip.disabled = true; });
    inTimeWrap?.classList.add("disabled");
    outTimeWrap?.classList.add("disabled");
  } else if (stateType === "off") {
    if (inTimeInput) { inTimeInput.disabled = true; inTimeInput.value = ""; }
    if (outTimeInput) { outTimeInput.disabled = true; outTimeInput.value = ""; }
    if (btnNowIn) btnNowIn.disabled = true;
    if (btnNowOut) btnNowOut.disabled = true;
    if (noteInput) noteInput.disabled = false;
    if (modeSelect) modeSelect.disabled = false;
    if (btnSubmit) btnSubmit.disabled = false;
    tagChips.forEach((chip) => { chip.disabled = false; });
    inTimeWrap?.classList.add("disabled");
    outTimeWrap?.classList.add("disabled");
  } else if (stateType === "waiting_checkout") {
    if (inTimeInput) inTimeInput.disabled = true;
    if (outTimeInput) outTimeInput.disabled = false;
    if (btnNowIn) btnNowIn.disabled = true;
    if (btnNowOut) btnNowOut.disabled = false;
    if (noteInput) noteInput.disabled = false;
    if (modeSelect) modeSelect.disabled = false;
    if (btnSubmit) btnSubmit.disabled = false;
    tagChips.forEach((chip) => { chip.disabled = false; });
    inTimeWrap?.classList.add("disabled");
    outTimeWrap?.classList.remove("disabled");
  } else if (stateType === "no_checkin") {
    if (inTimeInput) inTimeInput.disabled = false;
    if (outTimeInput) { outTimeInput.disabled = true; outTimeInput.value = ""; }
    if (btnNowIn) btnNowIn.disabled = false;
    if (btnNowOut) btnNowOut.disabled = true;
    if (noteInput) noteInput.disabled = false;
    if (modeSelect) modeSelect.disabled = false;
    if (btnSubmit) btnSubmit.disabled = false;
    tagChips.forEach((chip) => { chip.disabled = false; });
    inTimeWrap?.classList.remove("disabled");
    outTimeWrap?.classList.add("disabled");
  } else {
    // Both enabled
    if (inTimeInput) inTimeInput.disabled = false;
    if (outTimeInput) outTimeInput.disabled = false;
    if (btnNowIn) btnNowIn.disabled = false;
    if (btnNowOut) btnNowOut.disabled = false;
    if (noteInput) noteInput.disabled = false;
    if (modeSelect) modeSelect.disabled = false;
    if (btnSubmit) btnSubmit.disabled = false;
    tagChips.forEach((chip) => { chip.disabled = false; });
    inTimeWrap?.classList.remove("disabled");
    outTimeWrap?.classList.remove("disabled");
  }
}

export function updatePlaceholder() {
  const modeSelect = document.getElementById("modeSelect");
  const noteInput = document.getElementById("noteInput");
  const timeGrid = document.getElementById("timeGrid");
  if (!modeSelect || !noteInput) return;

  const mode = modeSelect.value;
  if (mode === "Nghỉ") {
    noteInput.placeholder = t("placeholderReason");
    if (timeGrid) timeGrid.style.opacity = "0.45";
    applyTimeFieldLockState("off");
  } else {
    noteInput.placeholder = t("placeholderTask");
    if (timeGrid) timeGrid.style.opacity = "1";
    onEmployeeOrDateChange();
  }
}

export function resetFormState() {
  const entryIdInput = document.getElementById("entryIdInput");
  const inTime = document.getElementById("inTime");
  const outTime = document.getElementById("outTime");
  const noteInput = document.getElementById("noteInput");
  const modeSelect = document.getElementById("modeSelect");
  const btnSubmit = document.getElementById("btnSubmitEntry");
  const btnReset = document.getElementById("btnResetForm");

  if (entryIdInput) entryIdInput.value = "";
  if (inTime) inTime.value = "";
  if (outTime) outTime.value = "";
  if (noteInput) {
    noteInput.value = "";
    noteInput.disabled = false;
  }
  if (modeSelect) {
    modeSelect.value = "Onsite";
    modeSelect.disabled = false;
  }
  if (btnSubmit) {
    btnSubmit.textContent = t("btnCheckin");
    btnSubmit.disabled = false;
  }
  if (btnReset) btnReset.style.display = "none";
  document.querySelectorAll(".tag-chip").forEach((c) => c.classList.remove("active"));
  applyTimeFieldLockState("no_checkin");
}

export function onEmployeeOrDateChange() {
  const empSelect = document.getElementById("empSelect");
  const dateInput = document.getElementById("dateInput");
  const entryIdInput = document.getElementById("entryIdInput");
  const inTimeInput = document.getElementById("inTime");
  const outTimeInput = document.getElementById("outTime");
  const modeSelect = document.getElementById("modeSelect");
  const noteInput = document.getElementById("noteInput");
  const btnSubmit = document.getElementById("btnSubmitEntry");
  const btnReset = document.getElementById("btnResetForm");

  const empId = !state.isAdmin && state.currentUser ? state.currentUser.id : empSelect?.value;
  const date = dateInput?.value;

  if (!empId || !date) {
    resetFormState();
    return;
  }

  const mk = monthKeyOf(date);
  const monthEntries = state.entriesCache[mk] || [];
  const existingEntry = monthEntries.find((e) => e.date === date && e.employeeId === empId);

  if (existingEntry) {
    if (entryIdInput) entryIdInput.value = existingEntry.id;
    if (modeSelect) modeSelect.value = existingEntry.mode || "Onsite";
    if (noteInput) noteInput.value = existingEntry.note || "";

    const noteVal = (existingEntry.note || "").trim();
    document.querySelectorAll(".tag-chip").forEach((chip) => {
      const tagKey = chip.dataset.tagKey;
      const tagText = tagKey ? t(tagKey) : chip.textContent;
      chip.classList.toggle("active", tagText === noteVal);
    });

    const isAlreadyCompleted = (existingEntry.in && existingEntry.out) || existingEntry.mode === "Nghỉ" || existingEntry.mode === "Off";

    if (isAlreadyCompleted) {
      // Đã hoàn thành chấm công trong ngày -> Khóa form để từ chối ghi nhận tiếp
      if (inTimeInput) inTimeInput.value = existingEntry.in || "";
      if (outTimeInput) outTimeInput.value = existingEntry.out || "";
      if (btnSubmit) {
        btnSubmit.textContent = t("btnCompleted");
        btnSubmit.disabled = true;
      }
      if (btnReset) btnReset.style.display = "none";
      applyTimeFieldLockState("completed_locked");
    } else if (existingEntry.in && !existingEntry.out) {
      // Đã check-in sáng, đang chờ check-out chiều
      if (inTimeInput) inTimeInput.value = existingEntry.in;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (outTimeInput) outTimeInput.value = `${hh}:${mm}`;
      if (btnSubmit) {
        btnSubmit.textContent = t("btnCheckout");
        btnSubmit.disabled = false;
      }
      if (btnReset) btnReset.style.display = "inline-flex";
      applyTimeFieldLockState("waiting_checkout");
    }
  } else {
    // Chưa có check-in trong ngày
    if (entryIdInput) entryIdInput.value = "";
    if (modeSelect?.value === "Nghỉ") {
      if (btnSubmit) {
        btnSubmit.textContent = t("btnRecord");
        btnSubmit.disabled = false;
      }
      applyTimeFieldLockState("off");
    } else {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (inTimeInput && !inTimeInput.value) {
        if (now.getHours() < 12) {
          inTimeInput.value = `${hh}:${mm}`;
        }
      }
      if (outTimeInput) outTimeInput.value = "";
      if (btnSubmit) {
        btnSubmit.textContent = t("btnCheckin");
        btnSubmit.disabled = false;
      }
      applyTimeFieldLockState("no_checkin");
    }
    if (btnReset) btnReset.style.display = "none";
  }
}

export async function renderDayEntries(onDataChanged) {
  const dateInput = document.getElementById("dateInput");
  const weekdayLabel = document.getElementById("weekdayLabel");
  const list = document.getElementById("entryList");
  const paginationContainer = document.getElementById("timesheetPagination");
  if (!dateInput || !list) return;

  const date = dateInput.value;
  if (!date) return;
  if (weekdayLabel) weekdayLabel.textContent = weekdayLabelFor(date);

  if (!state.currentUser && !state.token) {
    list.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  const mk = monthKeyOf(date);
  list.innerHTML = `<div class="empty-state"><span class="loading-pulse"><span class="loading-spinner"></span> ${t("loading")}</span></div>`;

  try {
    const monthEntries = await ensureMonthLoaded(mk);
    let dayEntries = monthEntries.filter((e) => e.date === date);
    if (!state.isAdmin && state.currentUser) {
      dayEntries = dayEntries.filter((e) => e.employeeId === state.currentUser.id);
    }
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
        ? `<button class="del-btn admin-only" data-id="${e.id}" aria-label="Xoá" title="Xoá"><img src="assets/svg/trash.svg" class="icon-svg icon-trash" alt="Xoá" /></button>`
        : "";

      row.innerHTML = `
        <div class="entry-main-line">
          <span class="name">${empName(e.employeeId)}</span>
          <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}</span>
          ${statusBadge}
          <span class="stamp ${e.mode}">${modeText}</span>
          ${delBtnHtml}
        </div>
        ${e.note ? `<div class="entry-note">${e.note}</div>` : ""}
      `;

      const btnQuick = row.querySelector(".btn-checkout-quick");
      if (btnQuick) {
        btnQuick.addEventListener("click", () => quickCheckout(e, onDataChanged));
      }

      const btnDel = row.querySelector(".del-btn");
      if (btnDel) {
        btnDel.addEventListener("click", () => deleteDayEntry(e.id, mk, onDataChanged));
      }

      list.appendChild(row);
    });

    renderPagination(
      paginationContainer,
      { currentPage: state.timesheetPage, totalItems, pageSize: state.pageSize },
      (newPage) => {
        state.timesheetPage = newPage;
        renderDayEntries(onDataChanged);
      }
    );
  } catch (err) {
    list.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
    showToast(err.message, "error");
  }
}

async function quickCheckout(entry, onDataChanged) {
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
    await renderDayEntries(onDataChanged);
    onEmployeeOrDateChange();
    if (typeof onDataChanged === "function") onDataChanged(mk);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteDayEntry(id, mk, onDataChanged) {
  const ok = await showConfirmDialog({
    title: t("confirmDeleteEntryTitle"),
    message: t("confirmDeleteEntry"),
    confirmText: t("btnConfirmDelete"),
    cancelText: t("btnCancel"),
    isDanger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/entries/${id}`, { method: "DELETE" });
    showToast(t("entryDeleted"), "success");
    if (mk && state.entriesCache[mk]) {
      state.entriesCache[mk] = state.entriesCache[mk].filter((e) => e.id !== id);
    }
    await renderDayEntries(onDataChanged);
    onEmployeeOrDateChange();
    if (typeof onDataChanged === "function") onDataChanged(mk, id);
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initChamCongTab(onDataChanged) {
  const dateInput = document.getElementById("dateInput");
  const entryForm = document.getElementById("entryForm");
  const empSelect = document.getElementById("empSelect");
  const modeSelect = document.getElementById("modeSelect");
  const btnResetForm = document.getElementById("btnResetForm");

  if (dateInput && !dateInput.value) {
    dateInput.value = todayStr();
  }

  // Khởi tạo trạng thái khóa mặc định
  applyTimeFieldLockState("no_checkin");

  modeSelect?.addEventListener("change", updatePlaceholder);

  // Nút fill giờ hiện tại
  document.querySelectorAll(".btn-now").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input && !input.disabled) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        input.value = `${hh}:${mm}`;
      }
    });
  });

  empSelect?.addEventListener("change", onEmployeeOrDateChange);
  dateInput?.addEventListener("change", () => {
    state.timesheetPage = 1;
    renderDayEntries(onDataChanged);
    onEmployeeOrDateChange();
  });

  // Quick Tags handling
  const tagChips = document.querySelectorAll(".tag-chip");
  const noteInput = document.getElementById("noteInput");

  tagChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (chip.disabled) return;
      const fillText = chip.dataset.fill || (chip.dataset.tagKey ? t(chip.dataset.tagKey) : chip.textContent);
      if (noteInput && !noteInput.disabled) {
        noteInput.value = fillText;
        tagChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        noteInput.focus();
        const len = noteInput.value.length;
        noteInput.setSelectionRange(len, len);
      }
    });
  });

  noteInput?.addEventListener("input", () => {
    const val = noteInput.value;
    tagChips.forEach((chip) => {
      const fillText = chip.dataset.fill || (chip.dataset.tagKey ? t(chip.dataset.tagKey) : chip.textContent);
      chip.classList.toggle("active", Boolean(fillText && val.startsWith(fillText)));
    });
  });

  // Shortcut: Ctrl+Enter or Cmd+Enter to submit quickly
  entryForm?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const btnSubmit = document.getElementById("btnSubmitEntry");
      if (btnSubmit && !btnSubmit.disabled) {
        entryForm.requestSubmit();
      }
    }
  });

  btnResetForm?.addEventListener("click", () => {
    resetFormState();
  });

  entryForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const employeeId = empSelect?.value;
    const note = (document.getElementById("noteInput")?.value || "").trim();
    const entryId = document.getElementById("entryIdInput")?.value;
    const btnSubmit = document.getElementById("btnSubmitEntry");
    const mode = document.getElementById("modeSelect")?.value || "Onsite";
    const inVal = (document.getElementById("inTime")?.value || "").trim();
    const outVal = (document.getElementById("outTime")?.value || "").trim();
    const date = dateInput.value;

    if (!employeeId) return showToast(t("errMissingFields"), "warning");
    if (!note) return showToast(t("errNoteEmpty"), "warning");

    // Kiểm tra nếu nhân viên đã hoàn tất chấm công trong ngày hôm nay -> Từ chối
    const mk = monthKeyOf(date);
    const monthEntries = state.entriesCache[mk] || [];
    const existing = monthEntries.find((e) => e.date === date && e.employeeId === employeeId);
    if (!entryId && existing) {
      const isAlreadyCompleted = (existing.in && existing.out) || existing.mode === "Nghỉ" || existing.mode === "Off";
      if (isAlreadyCompleted) {
        return showToast(t("errAlreadyCompleted"), "warning");
      }
    }

    const payload = {
      date,
      employeeId,
      in: mode === "Nghỉ" ? "" : inVal,
      out: mode === "Nghỉ" ? "" : outVal,
      mode,
      note,
    };

    setBtnLoading(btnSubmit, true);
    try {
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
      await renderDayEntries(onDataChanged);
      onEmployeeOrDateChange();
      if (typeof onDataChanged === "function") onDataChanged(mk);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
