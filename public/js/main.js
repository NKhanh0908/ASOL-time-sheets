import { state } from "./state.js";
import { currentLang, setLanguage, t } from "./i18n.js";
import { initLoginGate } from "./modals/loginGate.js";
import { initAdminAuth, checkAuthStatus, updateTopbarUserUI } from "./modals/adminAuth.js";
import { initSettingsModal } from "./modals/settingsModal.js";
import { initChamCongTab, renderEmployeeSelect, renderDayEntries, updateEmpCount, onEmployeeOrDateChange, resetFormState } from "./tabs/chamCong.js";
import { initLocChamCongTab, renderFilterEmployeeSelect, renderFilterResults } from "./tabs/locChamCong.js";
import { initNhanVienTab, loadEmployees, renderEmployeeList } from "./tabs/nhanVien.js";
import { initTongHopTab, renderSummary } from "./tabs/tongHop.js";

// Re-render callback when entry/timesheet data changes
function onTimesheetDataChanged(changedMonthKey) {
  const monthInput = document.getElementById("monthInput");
  if (monthInput && changedMonthKey && monthInput.value === changedMonthKey) {
    renderSummary();
  }
  if (state.filterData.isLoaded) {
    renderFilterResults(onTimesheetDataChanged);
  }
}

// Re-render callback when employee list changes (add/delete employee)
function onEmployeeDataChanged() {
  renderEmployeeSelect();
  renderFilterEmployeeSelect();
  renderDayEntries(onTimesheetDataChanged);
  renderSummary();
  updateEmpCount();
  onEmployeeOrDateChange();
}

// Re-render callback when language switches
function onLanguageChanged() {
  renderEmployeeSelect();
  renderFilterEmployeeSelect();
  renderDayEntries(onTimesheetDataChanged);
  renderEmployeeList(onEmployeeDataChanged);
  renderSummary();
  if (state.filterData.isLoaded) {
    renderFilterResults(onTimesheetDataChanged);
  }
  updateEmpCount();
  onEmployeeOrDateChange();
}

// Re-render callback when user logs in or logs out
async function onAuthStateChanged(user) {
  state.entriesCache = {};
  state.filterData = {
    items: [],
    page: 1,
    isLoaded: false,
  };
  state.timesheetPage = 1;
  resetFormState();

  if (user) {
    await loadEmployees();
    renderEmployeeSelect();
    renderFilterEmployeeSelect();
    await renderDayEntries(onTimesheetDataChanged);
    await renderSummary();
    onEmployeeOrDateChange();
    if (state.filterData.isLoaded) {
      renderFilterResults(onTimesheetDataChanged);
    }
  } else {
    state.employees = [];
    renderEmployeeSelect();
    renderFilterEmployeeSelect();
    const entryList = document.getElementById("entryList");
    if (entryList) entryList.innerHTML = `<div class="empty-state">${t("emptyDay")}</div>`;
    const pag = document.getElementById("timesheetPagination");
    if (pag) pag.innerHTML = "";
    const filterList = document.getElementById("filterEntryList");
    if (filterList) filterList.innerHTML = "";
    const filterKpis = document.getElementById("filterKpis");
    if (filterKpis) filterKpis.style.display = "none";
    const summaryTable = document.getElementById("summaryTable");
    if (summaryTable) summaryTable.innerHTML = `<div class="empty-state">${t("emptySummary")}</div>`;
    const empList = document.getElementById("empList");
    if (empList) empList.innerHTML = `<div class="empty-state">${t("emptyEmp")}</div>`;
  }
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
      if (tabName === "cham-cong") renderDayEntries(onTimesheetDataChanged);
      if (tabName === "nhan-vien") renderEmployeeList(onEmployeeDataChanged);
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
    initLoginGate(async () => {
      updateTopbarUserUI(onAuthStateChanged);
    });
    initAdminAuth(onAuthStateChanged);
    initSettingsModal();
    initChamCongTab(onTimesheetDataChanged);
    initLocChamCongTab(onTimesheetDataChanged);
    initNhanVienTab(onEmployeeDataChanged);
    initTongHopTab();

    setLanguage(currentLang, { onLanguageChange: onLanguageChanged });
    await checkAuthStatus(onAuthStateChanged);
  } catch (err) {
    console.error("Initialization error:", err);
  }
})();
