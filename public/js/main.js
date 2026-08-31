import { state } from "./state.js";
import { currentLang, setLanguage } from "./i18n.js";
import { initLoginGate } from "./modals/loginGate.js";
import { initAdminAuth, checkAuthStatus, updateTopbarUserUI } from "./modals/adminAuth.js";
import { initSettingsModal } from "./modals/settingsModal.js";
import { initChamCongTab, renderEmployeeSelect, renderDayEntries, updateEmpCount, onEmployeeOrDateChange } from "./tabs/chamCong.js";
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
  if (user) {
    await loadEmployees(onEmployeeDataChanged);
    renderEmployeeSelect();
    renderFilterEmployeeSelect();
    await renderDayEntries(onTimesheetDataChanged);
    await renderSummary();
    if (state.filterData.isLoaded) {
      renderFilterResults(onTimesheetDataChanged);
    }
  } else {
    state.employees = [];
    renderEmployeeSelect();
    renderFilterEmployeeSelect();
    renderDayEntries(onTimesheetDataChanged);
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
    initLoginGate(async (user) => {
      updateTopbarUserUI(onAuthStateChanged);
      await onAuthStateChanged(user);
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
