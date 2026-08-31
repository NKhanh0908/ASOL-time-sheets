import { state } from "../state.js";
import { getAdminStatus, loginAdmin, changeAdminPassword } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";

export function updateAdminUI(onAdminStateChange) {
  document.body.classList.toggle("is-admin", state.isAdmin);

  const guestControls = document.getElementById("guestControls");
  const adminControls = document.getElementById("adminControls");

  if (state.isAdmin) {
    if (guestControls) guestControls.style.display = "none";
    if (adminControls) adminControls.style.display = "flex";
  } else {
    if (guestControls) guestControls.style.display = "flex";
    if (adminControls) adminControls.style.display = "none";

    // Nếu đang ở tab Nhân viên mà bị logout/chưa đăng nhập thì chuyển về tab Chấm công
    const tabNhanVienBtn = document.querySelector('.tab-btn[data-tab="nhan-vien"]');
    const tabNhanVienSec = document.getElementById("tab-nhan-vien");
    if (tabNhanVienBtn?.classList.contains("active") || tabNhanVienSec?.classList.contains("active")) {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      document.querySelector('.tab-btn[data-tab="cham-cong"]')?.classList.add("active");
      document.getElementById("tab-cham-cong")?.classList.add("active");
    }
  }

  if (typeof onAdminStateChange === "function") {
    onAdminStateChange(state.isAdmin);
  }
}

export async function checkAdminStatus(onAdminStateChange) {
  if (!state.adminToken) {
    state.isAdmin = false;
    updateAdminUI(onAdminStateChange);
    return;
  }
  try {
    const res = await getAdminStatus();
    state.isAdmin = Boolean(res.isAdmin);
    if (!state.isAdmin) {
      state.adminToken = null;
      localStorage.removeItem("timesheet_admin_token");
    }
  } catch {
    state.isAdmin = false;
    state.adminToken = null;
    localStorage.removeItem("timesheet_admin_token");
  }
  updateAdminUI(onAdminStateChange);
}

export function initAdminAuth(onAdminStateChange) {
  const modalAdminLogin = document.getElementById("modalAdminLogin");
  const modalAdminChangePass = document.getElementById("modalAdminChangePass");
  const formAdminLogin = document.getElementById("formAdminLogin");
  const formAdminChangePass = document.getElementById("formAdminChangePass");

  const btnOpenLoginModal = document.getElementById("btnOpenLoginModal");
  const btnCloseLoginModal = document.getElementById("btnCloseLoginModal");
  const btnCancelLoginModal = document.getElementById("btnCancelLoginModal");

  const btnOpenChangePassModal = document.getElementById("btnOpenChangePassModal");
  const btnCloseChangePassModal = document.getElementById("btnCloseChangePassModal");
  const btnCancelChangePassModal = document.getElementById("btnCancelChangePassModal");
  const btnLogoutAdmin = document.getElementById("btnLogoutAdmin");

  btnOpenLoginModal?.addEventListener("click", () => {
    const passInput = document.getElementById("adminLoginPassword");
    if (passInput) passInput.value = "";
    if (modalAdminLogin) modalAdminLogin.style.display = "flex";
  });

  const closeLogin = () => {
    if (modalAdminLogin) modalAdminLogin.style.display = "none";
  };
  btnCloseLoginModal?.addEventListener("click", closeLogin);
  btnCancelLoginModal?.addEventListener("click", closeLogin);

  btnOpenChangePassModal?.addEventListener("click", () => {
    const cur = document.getElementById("currentPassInput");
    const np = document.getElementById("newPassInput");
    const cp = document.getElementById("confirmPassInput");
    if (cur) cur.value = "";
    if (np) np.value = "";
    if (cp) cp.value = "";
    if (modalAdminChangePass) modalAdminChangePass.style.display = "flex";
  });

  const closeChangePass = () => {
    if (modalAdminChangePass) modalAdminChangePass.style.display = "none";
  };
  btnCloseChangePassModal?.addEventListener("click", closeChangePass);
  btnCancelChangePassModal?.addEventListener("click", closeChangePass);

  window.addEventListener("click", (e) => {
    if (e.target === modalAdminLogin) modalAdminLogin.style.display = "none";
    if (e.target === modalAdminChangePass) modalAdminChangePass.style.display = "none";
  });

  formAdminLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = (document.getElementById("adminLoginPassword")?.value || "").trim();
    const btnSubmit = document.getElementById("btnSubmitAdminLogin");
    setBtnLoading(btnSubmit, true);
    try {
      const res = await loginAdmin(password);
      state.adminToken = res.token;
      state.isAdmin = true;
      localStorage.setItem("timesheet_admin_token", res.token);
      showToast(t("loginSuccess"), "success");
      closeLogin();
      updateAdminUI(onAdminStateChange);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });

  btnLogoutAdmin?.addEventListener("click", () => {
    state.adminToken = null;
    state.isAdmin = false;
    localStorage.removeItem("timesheet_admin_token");
    showToast(t("logoutSuccess"), "info");
    updateAdminUI(onAdminStateChange);
  });

  formAdminChangePass?.addEventListener("submit", async (e) => {
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
      await changeAdminPassword(currentPassword, newPassword);
      showToast(t("passChangedSuccess"), "success");
      closeChangePass();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
