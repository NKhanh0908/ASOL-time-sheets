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

  const mk = monthInput.value || monthKeyOf(todayStr());
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
