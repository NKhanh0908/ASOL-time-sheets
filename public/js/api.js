import { state } from "./state.js";

function getAuthHeaders() {
  const token = state.adminToken || localStorage.getItem("timesheet_admin_token");
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
    throw new Error(body.error || `Lỗi máy chủ (${res.status})`);
  }
  return res.json();
}

// Employees API
export async function fetchEmployees() {
  return api("/api/employees");
}

export async function createEmployee(name) {
  return api("/api/employees", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteEmployee(id) {
  return api(`/api/employees/${id}`, { method: "DELETE" });
}

// Entries API
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

// Admin Auth API
export async function loginAdmin(password) {
  return api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function getAdminStatus() {
  return api("/api/admin/status");
}

export async function changeAdminPassword(currentPassword, newPassword) {
  return api("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
