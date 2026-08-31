export const state = {
  employees: [],
  entriesCache: {}, // monthKey -> array
  isAdmin: false,
  adminToken: localStorage.getItem("timesheet_admin_token") || null,
  timesheetPage: 1,
  pageSize: 10,
  filterData: {
    items: [],
    page: 1,
    isLoaded: false,
  },
};

export function invalidateEntriesCache(monthKey) {
  if (monthKey) {
    delete state.entriesCache[monthKey];
  } else {
    state.entriesCache = {};
  }
}
