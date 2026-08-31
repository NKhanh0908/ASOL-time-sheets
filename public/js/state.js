export const state = {
  employees: [],
  entriesCache: {}, // monthKey -> array
  currentUser: null, // { role: 'employee' | 'admin', id, code, name }
  token: localStorage.getItem("asol_auth_token") || localStorage.getItem("timesheet_admin_token") || null,
  isAdmin: false,
  timesheetPage: 1,
  pageSize: 10,
  filterData: {
    items: [],
    page: 1,
    isLoaded: false,
  },
};

export function setAuthState(token, user) {
  state.token = token;
  state.currentUser = user;
  state.isAdmin = Boolean(user && user.role === "admin");
  if (token) {
    localStorage.setItem("asol_auth_token", token);
    if (state.isAdmin) {
      localStorage.setItem("timesheet_admin_token", token);
    }
  } else {
    localStorage.removeItem("asol_auth_token");
    localStorage.removeItem("timesheet_admin_token");
  }
}

export function invalidateEntriesCache(monthKey) {
  if (monthKey) {
    delete state.entriesCache[monthKey];
  } else {
    state.entriesCache = {};
  }
}
