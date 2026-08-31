import { setAuthState } from "../state.js";
import { loginUser } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";

export function showLoginGate() {
  const gate = document.getElementById("loginGate");
  if (gate) {
    gate.style.display = "flex";
  }
}

export function hideLoginGate() {
  const gate = document.getElementById("loginGate");
  if (gate) {
    gate.style.display = "none";
  }
}

export function initLoginGate(onLoginSuccess) {
  const gate = document.getElementById("loginGate");
  const btnTabEmployee = document.getElementById("btnGateTabEmployee");
  const btnTabAdmin = document.getElementById("btnGateTabAdmin");
  const formEmp = document.getElementById("formEmployeeLogin");
  const formAdmin = document.getElementById("formAdminLoginGate");
  const linkForgot = document.getElementById("linkForgotPassword");

  // Tab Switching inside Login Gate
  btnTabEmployee?.addEventListener("click", () => {
    btnTabEmployee.classList.add("active");
    btnTabAdmin?.classList.remove("active");
    formEmp?.classList.add("active");
    formAdmin?.classList.remove("active");
    document.getElementById("empLoginCode")?.focus();
  });

  btnTabAdmin?.addEventListener("click", () => {
    btnTabAdmin.classList.add("active");
    btnTabEmployee?.classList.remove("active");
    formAdmin?.classList.add("active");
    formEmp?.classList.remove("active");
    document.getElementById("adminGatePassword")?.focus();
  });

  // Forgot Password popup
  linkForgot?.addEventListener("click", (e) => {
    e.preventDefault();
    alert(t("forgotPasswordInfo"));
  });

  // Employee Login Form Submission
  formEmp?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (document.getElementById("empLoginCode")?.value || "").trim();
    const password = (document.getElementById("empLoginPassword")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitEmpLogin");

    if (!code || !password) {
      return showToast(t("errMissingFields"), "warning");
    }

    setBtnLoading(btnSubmit, true);
    try {
      const res = await loginUser({ role: "employee", code, password });
      setAuthState(res.token, res.user);
      showToast(t("loginSuccess"), "success");
      hideLoginGate();
      if (typeof onLoginSuccess === "function") {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      showToast(err.message || t("errInvalidCodeOrPass"), "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });

  // Admin Login Form Submission (inside Login Gate)
  formAdmin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = (document.getElementById("adminGatePassword")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitAdminGateLogin");

    if (!password) {
      return showToast(t("errMissingFields"), "warning");
    }

    setBtnLoading(btnSubmit, true);
    try {
      const res = await loginUser({ role: "admin", password });
      setAuthState(res.token, res.user);
      showToast(t("loginSuccess"), "success");
      hideLoginGate();
      if (typeof onLoginSuccess === "function") {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
