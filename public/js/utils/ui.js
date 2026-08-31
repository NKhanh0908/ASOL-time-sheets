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

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const curPage = Math.max(1, Math.min(currentPage, totalPages));
  const from = (curPage - 1) * pageSize + 1;
  const to = Math.min(curPage * pageSize, totalItems);

  let html = `<div class="pagination-bar">`;
  html += `<div class="pagination-info">Hiển thị ${from}-${to} / ${totalItems}</div>`;
  html += `<div class="pagination-controls">`;
  html += `<button type="button" class="page-btn page-prev" ${curPage <= 1 ? "disabled" : ""}>◀</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= curPage - 1 && i <= curPage + 1)) {
      html += `<button type="button" class="page-btn page-num ${i === curPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    } else if (i === curPage - 2 || i === curPage + 2) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  html += `<button type="button" class="page-btn page-next" ${curPage >= totalPages ? "disabled" : ""}>▶</button>`;
  html += `</div></div>`;

  container.innerHTML = html;
  container.querySelector(".page-prev")?.addEventListener("click", () => onPageChange(curPage - 1));
  container.querySelector(".page-next")?.addEventListener("click", () => onPageChange(curPage + 1));
  container.querySelectorAll(".page-num").forEach((btn) => {
    btn.addEventListener("click", (e) => onPageChange(Number(e.target.dataset.page)));
  });
}
