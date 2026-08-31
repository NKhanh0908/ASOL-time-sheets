import { t } from "../i18n.js";

/**
 * Hiển thị thông báo nổi ở đỉnh giữa màn hình (Top-Center) với thanh tiến trình & nút đóng
 * @param {string} message - Nội dung thông báo
 * @param {'success'|'error'|'warning'|'info'} type - Phân loại thông báo
 * @param {number} duration - Thời gian hiển thị (ms), mặc định 3000ms
 */
export function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  // Giới hạn tối đa 3 toast cùng lúc, nếu nhiều hơn thì xóa bớt cái cũ nhất
  if (container.children.length >= 3) {
    const oldest = container.firstElementChild;
    if (oldest) dismissToast(oldest);
  }

  const config = {
    success: { icon: "✓", titleKey: "toastSuccess" },
    error: { icon: "✕", titleKey: "toastError" },
    warning: { icon: "⚠", titleKey: "toastWarning" },
    info: { icon: "ℹ", titleKey: "toastInfo" },
  };

  const currentConfig = config[type] || config.info;
  const title = t(currentConfig.titleKey);

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-badge">${currentConfig.icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Close">✕</button>
    <div class="toast-progress">
      <div class="toast-progress-bar"></div>
    </div>
  `;

  container.appendChild(toast);

  // Trigger animation xuất hiện và chạy thanh tiến trình
  requestAnimationFrame(() => {
    toast.classList.add("show");
    const progressBar = toast.querySelector(".toast-progress-bar");
    if (progressBar && duration > 0) {
      progressBar.style.transition = `transform ${duration}ms linear`;
      requestAnimationFrame(() => {
        progressBar.style.transform = "scaleX(0)";
      });
    }
  });

  let dismissTimer = null;
  if (duration > 0) {
    dismissTimer = setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }

  const closeBtn = toast.querySelector(".toast-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissToast(toast);
    });
  }
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains("hiding")) return;
  toast.classList.add("hiding");
  toast.classList.remove("show");
  setTimeout(() => {
    toast.remove();
  }, 250);
}

export function setBtnLoading(btn, isLoading, customText = "") {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-small"></span> ${customText || t("loading")}`;
  } else if (btn.dataset.origHtml) {
    btn.innerHTML = btn.dataset.origHtml;
  }
}

export function renderPagination(container, { currentPage, totalItems, pageSize }, onPageChange) {
  if (!container) return;
  if (!totalItems || totalItems <= pageSize) {
    container.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(totalItems / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  container.innerHTML = `
    <button type="button" class="page-btn page-prev" ${currentPage <= 1 ? "disabled" : ""}>&laquo; Prev</button>
    <span class="page-info mono">${currentPage} / ${totalPages} (${totalItems})</span>
    <button type="button" class="page-btn page-next" ${currentPage >= totalPages ? "disabled" : ""}>Next &raquo;</button>
  `;

  const btnPrev = container.querySelector(".page-prev");
  const btnNext = container.querySelector(".page-next");

  btnPrev?.addEventListener("click", () => {
    if (currentPage > 1 && typeof onPageChange === "function") {
      onPageChange(currentPage - 1);
    }
  });

  btnNext?.addEventListener("click", () => {
    if (currentPage < totalPages && typeof onPageChange === "function") {
      onPageChange(currentPage + 1);
    }
  });
}

/**
 * Custom Modal Dialog: Xác nhận (thay thế window.confirm)
 */
export function showConfirmDialog({ title = "Xác nhận", message = "", confirmText = "Xác nhận", cancelText = "Huỷ", isDanger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop dialog-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box dialog-box">
        <div class="modal-header">
          <h3>${title}</h3>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="dialog-msg">${message}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-sub btn-dialog-cancel">${cancelText}</button>
          <button type="button" class="btn-primary ${isDanger ? "btn-danger" : ""} btn-dialog-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.style.display = "flex";

    const close = (val) => {
      backdrop.classList.add("hiding");
      setTimeout(() => backdrop.remove(), 200);
      resolve(val);
    };

    backdrop.querySelector(".modal-close").addEventListener("click", () => close(false));
    backdrop.querySelector(".btn-dialog-cancel").addEventListener("click", () => close(false));
    backdrop.querySelector(".btn-dialog-confirm").addEventListener("click", () => close(true));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(false);
    });
  });
}

/**
 * Custom Modal Dialog: Nhập dữ liệu (thay thế window.prompt)
 */
export function showPromptDialog({ title = "Nhập thông tin", label = "", placeholder = "", defaultValue = "", confirmText = "Lưu", cancelText = "Huỷ" }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop dialog-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box dialog-box">
        <form class="dialog-form">
          <div class="modal-header">
            <h3>${title}</h3>
            <button type="button" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="modal-field">
              ${label ? `<label>${label}</label>` : ""}
              <input type="text" class="dialog-input" placeholder="${placeholder}" value="${defaultValue}" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-sub btn-dialog-cancel">${cancelText}</button>
            <button type="submit" class="btn-primary btn-dialog-confirm">${confirmText}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.style.display = "flex";

    const input = backdrop.querySelector(".dialog-input");
    setTimeout(() => input?.focus(), 50);

    const close = (val) => {
      backdrop.classList.add("hiding");
      setTimeout(() => backdrop.remove(), 200);
      resolve(val);
    };

    backdrop.querySelector(".modal-close").addEventListener("click", () => close(null));
    backdrop.querySelector(".btn-dialog-cancel").addEventListener("click", () => close(null));
    backdrop.querySelector(".dialog-form").addEventListener("submit", (e) => {
      e.preventDefault();
      close(input.value);
    });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });
  });
}

/**
 * Custom Modal Dialog: Thông báo thông tin / Cấp mật khẩu (thay thế window.alert)
 */
export function showInfoDialog({ title = "Thông báo", message = "", copyValue = null, closeText = "Đóng" }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop dialog-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box dialog-box">
        <div class="modal-header">
          <h3>${title}</h3>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="dialog-msg">${message}</p>
          ${
            copyValue
              ? `
            <div class="dialog-copy-box">
              <input type="text" readonly value="${copyValue}" class="dialog-copy-input mono" />
              <button type="button" class="btn-sub btn-sm btn-copy-val">📋 Sao chép</button>
            </div>
          `
              : ""
          }
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-primary btn-dialog-close">${closeText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.style.display = "flex";

    const close = () => {
      backdrop.classList.add("hiding");
      setTimeout(() => backdrop.remove(), 200);
      resolve(true);
    };

    const copyBtn = backdrop.querySelector(".btn-copy-val");
    if (copyBtn && copyValue) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(copyValue);
          copyBtn.textContent = "✓ Đã sao chép";
          setTimeout(() => (copyBtn.textContent = "📋 Sao chép"), 2000);
        } catch {
          const copyInput = backdrop.querySelector(".dialog-copy-input");
          copyInput?.select();
          document.execCommand("copy");
          copyBtn.textContent = "✓ Đã sao chép";
          setTimeout(() => (copyBtn.textContent = "📋 Sao chép"), 2000);
        }
      });
    }

    backdrop.querySelector(".modal-close").addEventListener("click", close);
    backdrop.querySelector(".btn-dialog-close").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
  });
}
