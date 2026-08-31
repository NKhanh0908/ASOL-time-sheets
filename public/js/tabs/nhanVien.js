import { state } from "../state.js";
import { api, createEmployee, resetEmployeePassword } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";

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
  const newPass = prompt(t("promptNewPassOptional"), "");
  if (newPass === null) return; // User cancelled

  try {
    const res = await resetEmployeePassword(emp.id, newPass.trim());
    const pass = res.generatedPassword;
    alert(t("resetPasswordSuccess", { name: emp.name, pass }));
    showToast(t("passChangedSuccess"), "success");
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
  if (!confirm(t("confirmDeleteEmp"))) return;
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
  const btnRandomPass = document.getElementById("btnRandomEmpPass");
  const btnSubmit = document.getElementById("btnAddEmpSubmit");

  btnRandomPass?.addEventListener("click", () => {
    const code = (inputEmpCode?.value || "NV").trim().toUpperCase();
    const digits = Math.floor(100000 + Math.random() * 900000);
    if (inputEmpPass) {
      inputEmpPass.value = `${code}${digits}`;
    }
  });

  empForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = (newEmpName?.value || "").trim();
    const code = (inputEmpCode?.value || "").trim().toUpperCase();
    const password = (inputEmpPass?.value || "").trim();

    if (!name) return;

    setBtnLoading(btnSubmit, true);
    try {
      const res = await createEmployee({ code, name, password });
      if (res.generatedPassword) {
        alert(t("resetPasswordSuccess", { name: res.employee.name, pass: res.generatedPassword }));
      }
      showToast(t("empAdded"), "success");
      if (inputEmpCode) inputEmpCode.value = "";
      if (newEmpName) newEmpName.value = "";
      if (inputEmpPass) inputEmpPass.value = "";
      await loadEmployees(onEmployeeChanged);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
