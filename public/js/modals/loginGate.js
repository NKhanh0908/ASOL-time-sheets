import { setAuthState } from "../state.js";
import { loginUser } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading, showInfoDialog } from "../utils/ui.js";

function setGateError(msg) {
  const errBox = document.getElementById("loginGateError");
  if (!errBox) return;
  if (msg) {
    errBox.textContent = msg;
    errBox.style.display = "flex";
  } else {
    errBox.textContent = "";
    errBox.style.display = "none";
  }
}

export function showLoginGate() {
  const gate = document.getElementById("loginGate");
  if (gate) {
    setGateError(null);
    gate.style.display = "flex";
  }
}

export function hideLoginGate() {
  const gate = document.getElementById("loginGate");
  if (gate) {
    setGateError(null);
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
    setGateError(null);
    btnTabEmployee.classList.add("active");
    btnTabAdmin?.classList.remove("active");
    formEmp?.classList.add("active");
    formAdmin?.classList.remove("active");
    document.getElementById("empLoginCode")?.focus();
  });

  btnTabAdmin?.addEventListener("click", () => {
    setGateError(null);
    btnTabAdmin.classList.add("active");
    btnTabEmployee?.classList.remove("active");
    formAdmin?.classList.add("active");
    formEmp?.classList.remove("active");
    document.getElementById("adminGatePassword")?.focus();
  });

  // Clear error when user inputs
  gate?.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", () => setGateError(null));
  });

  // Forgot Password popup
  linkForgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    await showInfoDialog({
      title: t("forgotPasswordModalTitle"),
      message: t("forgotPasswordInfo"),
      closeText: t("btnClose"),
    });
  });

  // Employee Login Form Submission
  formEmp?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setGateError(null);
    const code = (document.getElementById("empLoginCode")?.value || "").trim();
    const password = (document.getElementById("empLoginPassword")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitEmpLogin");

    if (!code || !password) {
      setGateError(t("errMissingFields"));
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
      const msg = err.message || t("errInvalidCodeOrPass");
      setGateError(msg);
      showToast(msg, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });

  // Admin Login Form Submission (inside Login Gate)
  formAdmin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setGateError(null);
    const password = (document.getElementById("adminGatePassword")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitAdminGateLogin");

    if (!password) {
      setGateError(t("errMissingFields"));
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
      const msg = err.message || "Mật khẩu không chính xác";
      setGateError(msg);
      showToast(msg, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
