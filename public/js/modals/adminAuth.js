import { state, setAuthState } from "../state.js";
import { getMe, changePassword } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";
import { showLoginGate, hideLoginGate } from "./loginGate.js";

export function updateTopbarUserUI(onAuthStateChange) {
  document.body.classList.toggle("is-admin", state.isAdmin);

  const userControls = document.getElementById("userControls");
  const userBadge = document.getElementById("userBadge");
  const guestControls = document.getElementById("guestControls");
  const adminControls = document.getElementById("adminControls");

  // Tab switch button for Employee Management (admin only)
  const tabNhanVienBtn = document.querySelector('.tab-btn[data-tab="nhan-vien"]');
  const tabNhanVienSec = document.getElementById("tab-nhan-vien");

  if (state.currentUser) {
    hideLoginGate();
    if (userControls) userControls.style.display = "flex";
    if (userBadge) {
      if (state.isAdmin) {
        userBadge.textContent = "👑 Admin";
        userBadge.className = "badge-user badge-admin";
      } else {
        userBadge.textContent = `👤 [${state.currentUser.code}] ${state.currentUser.name}`;
        userBadge.className = "badge-user badge-employee";
      }
    }

    if (tabNhanVienBtn) {
      tabNhanVienBtn.style.display = state.isAdmin ? "" : "none";
    }

    // If employee is on Admin-only tab, switch to cham-cong
    if (!state.isAdmin) {
      if (tabNhanVienBtn?.classList.contains("active") || tabNhanVienSec?.classList.contains("active")) {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        document.querySelector('.tab-btn[data-tab="cham-cong"]')?.classList.add("active");
        document.getElementById("tab-cham-cong")?.classList.add("active");
      }
    }
  } else {
    if (userControls) userControls.style.display = "none";
    if (guestControls) guestControls.style.display = "none";
    if (adminControls) adminControls.style.display = "none";
    if (tabNhanVienBtn) tabNhanVienBtn.style.display = "none";
    showLoginGate();
  }

  if (typeof onAuthStateChange === "function") {
    onAuthStateChange(state.currentUser);
  }
}

export async function checkAuthStatus(onAuthStateChange) {
  if (!state.token) {
    setAuthState(null, null);
    updateTopbarUserUI(onAuthStateChange);
    return;
  }
  try {
    const res = await getMe();
    setAuthState(state.token, res.user);
  } catch {
    setAuthState(null, null);
  }
  updateTopbarUserUI(onAuthStateChange);
}

// Backward compatibility alias for checkAdminStatus
export const checkAdminStatus = checkAuthStatus;
export const updateAdminUI = updateTopbarUserUI;

export function initAdminAuth(onAuthStateChange) {
  const modalChangePass = document.getElementById("modalChangePass") || document.getElementById("modalAdminChangePass");
  const formChangePass = document.getElementById("formChangePass") || document.getElementById("formAdminChangePass");

  const btnOpenChangePassModal = document.getElementById("btnOpenChangePassModal");
  const btnCloseChangePassModal = document.getElementById("btnCloseChangePassModal");
  const btnCancelChangePassModal = document.getElementById("btnCancelChangePassModal");
  const btnLogoutUser = document.getElementById("btnLogoutUser") || document.getElementById("btnLogoutAdmin");

  btnOpenChangePassModal?.addEventListener("click", () => {
    const cur = document.getElementById("currentPassInput");
    const np = document.getElementById("newPassInput");
    const cp = document.getElementById("confirmPassInput");
    if (cur) cur.value = "";
    if (np) np.value = "";
    if (cp) cp.value = "";
    if (modalChangePass) modalChangePass.style.display = "flex";
  });

  const closeChangePass = () => {
    if (modalChangePass) modalChangePass.style.display = "none";
  };
  btnCloseChangePassModal?.addEventListener("click", closeChangePass);
  btnCancelChangePassModal?.addEventListener("click", closeChangePass);

  window.addEventListener("click", (e) => {
    if (e.target === modalChangePass) modalChangePass.style.display = "none";
  });

  btnLogoutUser?.addEventListener("click", () => {
    setAuthState(null, null);
    showToast(t("logoutSuccess"), "info");
    updateTopbarUserUI(onAuthStateChange);
  });

  formChangePass?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = (document.getElementById("currentPassInput")?.value || "").trim();
    const newPassword = (document.getElementById("newPassInput")?.value || "").trim();
    const confirmPassword = (document.getElementById("confirmPassInput")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitChangePass");

    if (newPassword !== confirmPassword) {
      return showToast(t("passMismatch"), "warning");
    }
    if (newPassword.length < 6) {
      return showToast(t("passTooShort"), "warning");
    }

    setBtnLoading(btnSubmit, true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast(t("passChangedSuccess"), "success");
      closeChangePass();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
