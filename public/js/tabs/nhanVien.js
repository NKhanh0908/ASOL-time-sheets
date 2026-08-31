import { state } from "../state.js";
import { api, createEmployee, resetEmployeePassword } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading, showConfirmDialog, showPromptDialog, showInfoDialog } from "../utils/ui.js";

export function renderEmployeeList(onEmployeeChanged) {
  const list = document.getElementById("empList");
  if (!list) return;
  if (state.employees.length === 0) {
    list.innerHTML = `<div class="empty-state">${t("emptyEmp")}</div>`;
    return;
  }
  list.innerHTML = "";
  state.employees.forEach((e) => {
    const row = document.createElement("div");
    row.className = "emp-row";
    row.innerHTML = `
      <div class="emp-row-info">
        <span class="badge-code mono">${e.code || "--"}</span>
        <span class="name">${e.name}</span>
      </div>
      <div class="emp-row-actions">
        <button class="btn-sub btn-sm btn-reset-pass" data-id="${e.id}" title="${t("btnResetPassword")}">
          <span class="hide-mobile">${t("btnResetPassword")}</span>
        </button>
        <button class="del-btn" data-id="${e.id}" aria-label="Xoá" title="Xoá">
          <img src="assets/svg/trash.svg" class="icon-svg icon-trash" alt="Xoá" />
        </button>
      </div>
    `;

    row.querySelector(".btn-reset-pass")?.addEventListener("click", () => handleResetPassword(e));
    row.querySelector(".del-btn")?.addEventListener("click", () => removeEmployee(e.id, onEmployeeChanged));
    list.appendChild(row);
  });
}

async function handleResetPassword(emp) {
  const newPass = await showPromptDialog({
    title: t("modalResetPassTitle"),
    label: `${emp.name} (${emp.code || ""})`,
    placeholder: t("promptNewPassOptional"),
    defaultValue: "",
    confirmText: t("btnConfirmReset"),
    cancelText: t("btnCancel"),
  });

  if (newPass === null) return; // User cancelled

  try {
    const res = await resetEmployeePassword(emp.id, newPass.trim());
    const pass = res.generatedPassword;
    showToast(t("passChangedSuccess"), "success");
    await showInfoDialog({
      title: t("modalResetPassTitle"),
      message: `${t("infoNewPassGenerated")} <strong>${emp.name}</strong>`,
      copyValue: pass,
      closeText: t("btnClose"),
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function loadEmployees(onEmployeeChanged) {
  try {
    state.employees = await api("/api/employees");
    renderEmployeeList(onEmployeeChanged);
    if (typeof onEmployeeChanged === "function") {
      onEmployeeChanged();
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function removeEmployee(id, onEmployeeChanged) {
  const ok = await showConfirmDialog({
    title: t("confirmDeleteEmpTitle"),
    message: t("confirmDeleteEmp"),
    confirmText: t("btnConfirmDelete"),
    cancelText: t("btnCancel"),
    isDanger: true,
  });

  if (!ok) return;

  try {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    showToast(t("empDeleted"), "success");
    await loadEmployees(onEmployeeChanged);
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function initNhanVienTab(onEmployeeChanged) {
  const empForm = document.getElementById("empForm");
  const inputEmpCode = document.getElementById("inputEmpCode");
  const newEmpName = document.getElementById("newEmpName");
  const inputEmpPass = document.getElementById("inputEmpPass");
  const btnSubmit = document.getElementById("btnAddEmpSubmit");

  empForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = (newEmpName?.value || "").trim();
    const code = (inputEmpCode?.value || "").trim().toUpperCase();
    const password = (inputEmpPass?.value || "").trim();

    if (!name) return;

    setBtnLoading(btnSubmit, true);
    try {
      const res = await createEmployee({ code, name, password });
      showToast(t("empAdded"), "success");

      if (inputEmpCode) inputEmpCode.value = "";
      if (newEmpName) newEmpName.value = "";
      if (inputEmpPass) inputEmpPass.value = "";
      await loadEmployees(onEmployeeChanged);

      if (res.generatedPassword) {
        await showInfoDialog({
          title: t("empAdded"),
          message: `${t("infoNewPassGenerated")} <strong>${res.employee.name}</strong> (${res.employee.code})`,
          copyValue: res.generatedPassword,
          closeText: t("btnClose"),
        });
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
