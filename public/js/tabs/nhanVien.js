import { state } from "../state.js";
import { api } from "../api.js";
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
    row.innerHTML = `<span class="name">${e.name}</span><button class="del-btn" aria-label="Xoá" title="Xoá"><img src="assets/svg/trash.svg" class="icon-svg icon-trash" alt="Xoá" /></button>`;
    row.querySelector(".del-btn").addEventListener("click", () => removeEmployee(e.id, onEmployeeChanged));
    list.appendChild(row);
  });
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
  const newEmpName = document.getElementById("newEmpName");
  const btnSubmit = document.getElementById("btnAddEmpSubmit");

  empForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = (newEmpName?.value || "").trim();
    if (!name) return;

    setBtnLoading(btnSubmit, true);
    try {
      await api("/api/employees", { method: "POST", body: JSON.stringify({ name }) });
      showToast(t("empAdded"), "success");
      if (newEmpName) newEmpName.value = "";
      await loadEmployees(onEmployeeChanged);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
