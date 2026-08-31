import { state } from "../state.js";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { timeToMinutes, hoursBetween, fmtHours, monthKeyOf } from "../utils/time.js";
import { showToast, setBtnLoading, renderPagination, showConfirmDialog } from "../utils/ui.js";
import { empName } from "./chamCong.js";

export function renderFilterEmployeeSelect() {
  const filterEmpSelect = document.getElementById("filterEmpSelect");
  if (!filterEmpSelect) return;

  if (!state.isAdmin && state.currentUser) {
    filterEmpSelect.innerHTML = `<option value="${state.currentUser.id}">[${state.currentUser.code}] ${state.currentUser.name}</option>`;
    filterEmpSelect.value = state.currentUser.id;
    filterEmpSelect.disabled = true;
    return;
  }

  filterEmpSelect.disabled = false;
  const keep = filterEmpSelect.value;
  filterEmpSelect.innerHTML = `<option value="">${t("filterAllEmployees")}</option>`;
  state.employees.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.code ? `[${e.code}] ${e.name}` : e.name;
    filterEmpSelect.appendChild(opt);
  });
  filterEmpSelect.value = keep;
}

export function renderFilterResults(onDataChanged) {
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

  const kpiTotalDaysVal = document.getElementById("kpiTotalDaysVal");
  const kpiTotalHoursVal = document.getElementById("kpiTotalHoursVal");
  const kpiBreakdownVal = document.getElementById("kpiBreakdownVal");

  if (kpiTotalDaysVal) kpiTotalDaysVal.textContent = items.length;
  if (kpiTotalHoursVal) kpiTotalHoursVal.textContent = fmtHours(totalHours);
  if (kpiBreakdownVal) {
    kpiBreakdownVal.textContent = `${onsiteCount} Onsite / ${remoteCount} Remote / ${offCount} ${t("modeOff")}`;
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
      ? `<button class="del-btn admin-only" data-id="${e.id}" aria-label="Xoá" title="Xoá"><img src="assets/svg/trash.svg" class="icon-svg icon-trash" alt="Xoá" /></button>`
      : "";

    row.innerHTML = `
      <div class="entry-main-line">
        <span class="date-tag">${e.date}</span>
        <span class="name">${empName(e.employeeId)}</span>
        <span class="times">${e.in || "--:--"} → ${e.out || "--:--"}</span>
        ${statusBadge}
        <span class="stamp ${e.mode}">${modeText}</span>
        ${delBtnHtml}
      </div>
      ${e.note ? `<div class="entry-note">${e.note}</div>` : ""}
    `;

    const btnDel = row.querySelector(".del-btn");
    if (btnDel) {
      btnDel.addEventListener("click", () => deleteFilterEntry(e.id, e.date, onDataChanged));
    }

    list.appendChild(row);
  });

  renderPagination(
    paginationContainer,
    { currentPage: state.filterData.page, totalItems, pageSize: state.pageSize },
    (newPage) => {
      state.filterData.page = newPage;
      renderFilterResults(onDataChanged);
    }
  );
}

async function deleteFilterEntry(id, date, onDataChanged) {
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
    const mk = monthKeyOf(date);
    if (mk && state.entriesCache[mk]) {
      state.entriesCache[mk] = state.entriesCache[mk].filter((e) => e.id !== id);
    }
    state.filterData.items = state.filterData.items.filter((i) => i.id !== id);
    renderFilterResults(onDataChanged);
    if (typeof onDataChanged === "function") onDataChanged(mk, id);
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initLocChamCongTab(onDataChanged) {
  const filterForm = document.getElementById("filterForm");
  const filterEmpSelect = document.getElementById("filterEmpSelect");
  const filterStartDate = document.getElementById("filterStartDate");
  const filterEndDate = document.getElementById("filterEndDate");
  const filterModeSelect = document.getElementById("filterModeSelect");
  const btnResetFilter = document.getElementById("btnResetFilter");

  filterForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btnApply = document.getElementById("btnApplyFilter");
    setBtnLoading(btnApply, true);

    const params = new URLSearchParams();
    if (filterEmpSelect?.value) params.append("employeeId", filterEmpSelect.value);
    if (filterStartDate?.value) params.append("startDate", filterStartDate.value);
    if (filterEndDate?.value) params.append("endDate", filterEndDate.value);
    if (filterModeSelect?.value) params.append("mode", filterModeSelect.value);

    try {
      const entries = await api(`/api/entries?${params.toString()}`);
      state.filterData.items = entries;
      state.filterData.page = 1;
      state.filterData.isLoaded = true;
      renderFilterResults(onDataChanged);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnApply, false);
    }
  });

  btnResetFilter?.addEventListener("click", () => {
    if (filterEmpSelect) {
      filterEmpSelect.value = !state.isAdmin && state.currentUser ? state.currentUser.id : "";
    }
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
