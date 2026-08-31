import { state } from "./state.js";

function getAuthHeaders() {
  const token = state.token || localStorage.getItem("asol_auth_token") || localStorage.getItem("timesheet_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(opts.headers || {}),
  };

  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `Lỗi máy chủ (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// ---------- Authentication API ----------
export async function loginUser(credentials) {
  return api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function getMe() {
  return api("/api/auth/me");
}

export async function changePassword(currentPassword, newPassword) {
  return api("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// Backward compatible Admin Auth methods
export async function loginAdmin(password) {
  return loginUser({ role: "admin", password });
}

export async function getAdminStatus() {
  return api("/api/admin/status");
}

export async function changeAdminPassword(currentPassword, newPassword) {
  return changePassword(currentPassword, newPassword);
}

// ---------- Employees API ----------
export async function fetchEmployees() {
  return api("/api/employees");
}

export async function createEmployee(data) {
  const body = typeof data === "string" ? { name: data } : data;
  return api("/api/employees", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resetEmployeePassword(id, newPassword = "") {
  return api(`/api/employees/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export async function deleteEmployee(id) {
  return api(`/api/employees/${id}`, { method: "DELETE" });
}

// ---------- Entries API ----------
export async function fetchEntries(filters = {}) {
  const params = new URLSearchParams();
  if (typeof filters === "string") {
    params.set("month", filters);
  } else {
    if (filters.month) params.set("month", filters.month);
    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.mode) params.set("mode", filters.mode);
    if (filters.date) params.set("date", filters.date);
  }
  const qs = params.toString();
  return api(`/api/entries${qs ? `?${qs}` : ""}`);
}

export async function createEntry(entry) {
  return api("/api/entries", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function updateEntry(id, patch) {
  return api(`/api/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteEntry(id) {
  return api(`/api/entries/${id}`, { method: "DELETE" });
}

// ---------- Settings & Sync API ----------
export async function fetchSettings() {
  return api("/api/settings");
}

export async function updateSettings(settings) {
  return api("/api/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export async function testSyncConnection(url) {
  return api("/api/sync/test", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function syncMonthToGoogleSheets(month) {
  return api("/api/sync/month", {
    method: "POST",
    body: JSON.stringify({ month }),
  });
}
