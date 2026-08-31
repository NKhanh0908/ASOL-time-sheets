import { fetchSettings, updateSettings, testSyncConnection } from "../api.js";
import { t } from "../i18n.js";
import { showToast, setBtnLoading } from "../utils/ui.js";

export function initSettingsModal() {
  const modal = document.getElementById("modalSettings");
  const btnOpen = document.getElementById("btnOpenSettingsModal");
  const btnClose = document.getElementById("btnCloseSettingsModal");
  const btnCancel = document.getElementById("btnCancelSettingsModal");
  const form = document.getElementById("formSettings");
  const inputUrl = document.getElementById("inputWebhookUrl");
  const toggleSync = document.getElementById("toggleEnableSync");
  const envNote = document.getElementById("envFallbackNote");
  const btnTest = document.getElementById("btnTestWebhookConnection");
  const testStatus = document.getElementById("testConnectionStatus");
  const btnSubmit = document.getElementById("btnSubmitSettings");

  if (!modal || !btnOpen) return;

  async function openModal() {
    if (testStatus) testStatus.textContent = "";
    modal.style.display = "flex";
    try {
      const settings = await fetchSettings();
      if (inputUrl) inputUrl.value = settings.googleSheetWebhookUrl || "";
      if (toggleSync) toggleSync.checked = settings.googleSheetSyncEnabled !== false;
      if (envNote) {
        envNote.style.display = (!settings.googleSheetWebhookUrl && settings.hasEnvFallback) ? "block" : "none";
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function closeModal() {
    modal.style.display = "none";
    if (testStatus) testStatus.textContent = "";
  }

  btnOpen.addEventListener("click", openModal);
  btnClose?.addEventListener("click", closeModal);
  btnCancel?.addEventListener("click", closeModal);

  // Test connection button
  btnTest?.addEventListener("click", async () => {
    const url = inputUrl?.value.trim();
    if (testStatus) {
      testStatus.textContent = t("testingConnection");
      testStatus.style.color = "#666";
    }
    setBtnLoading(btnTest, true, t("testingConnection"));
    try {
      const res = await testSyncConnection(url);
      if (testStatus) {
        testStatus.textContent = "✓ " + (res.message || t("syncMonthSuccess"));
        testStatus.style.color = "#2b8a3e";
      }
      showToast(res.message || t("syncMonthSuccess"), "success");
    } catch (err) {
      if (testStatus) {
        testStatus.textContent = "✕ " + err.message;
        testStatus.style.color = "#c92a2a";
      }
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnTest, false);
    }
  });

  // Save settings form
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const googleSheetWebhookUrl = inputUrl?.value.trim() || "";
    const googleSheetSyncEnabled = toggleSync?.checked ?? true;

    setBtnLoading(btnSubmit, true, t("savingSettings"));
    try {
      await updateSettings({ googleSheetWebhookUrl, googleSheetSyncEnabled });
      showToast(t("settingsSaved"), "success");
      closeModal();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });
}
