process.env.NODE_ENV = "test";
const assert = require("assert");
const app = require("../server");

async function runSyncTests() {
  console.log("Running Google Sheet Sync Backend Test Suite...");

  // 1. Test payload generator helper
  assert.ok(typeof app.buildSyncEntryPayload === "function", "buildSyncEntryPayload must be exported");
  const sampleEntry = {
    date: "2026-08-31",
    employeeId: "emp-1",
    in: "08:30",
    out: "17:30",
    mode: "Onsite",
    note: "Completed tasks"
  };
  const payload = app.buildSyncEntryPayload(sampleEntry, "Nguyễn Văn A");
  assert.strictEqual(payload.action, "sync_entry");
  assert.strictEqual(payload.entry.employeeName, "Nguyễn Văn A");
  assert.strictEqual(payload.entry.workHours, 7.5);

  // 2. Test month summary calculation helper
  assert.ok(typeof app.aggregateMonthSummary === "function", "aggregateMonthSummary must be exported");
  const employees = [{ id: "emp-1", name: "Nguyễn Văn A" }, { id: "emp-2", name: "Trần Thị B" }];
  const entries = [
    { date: "2026-08-01", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Onsite" },
    { date: "2026-08-02", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Remote" },
    { date: "2026-08-03", employeeId: "emp-1", in: "", out: "", mode: "Nghỉ" },
    { date: "2026-08-01", employeeId: "emp-2", in: "08:30", out: "12:30", mode: "Onsite" }
  ];
  const summary = app.aggregateMonthSummary(employees, entries);
  assert.strictEqual(summary.length, 2);
  assert.strictEqual(summary[0].totalHours, 15);
  assert.strictEqual(summary[0].onsiteDays, 1);
  assert.strictEqual(summary[0].remoteDays, 1);
  assert.strictEqual(summary[0].offDays, 1);
  assert.strictEqual(summary[1].totalHours, 4);

  // 3. Test non-blocking dispatch with invalid URL
  let threw = false;
  try {
    await app.sendGoogleSheetWebhook({ action: "test" }, "http://invalid-url-that-does-not-exist.local");
  } catch {
    threw = true;
  }
  assert.strictEqual(threw, false, "sendGoogleSheetWebhook must catch errors internally and never throw");

  console.log("✅ Sync backend test suite passed successfully!");
}

runSyncTests().catch((err) => {
  console.error("❌ Sync backend test failed:", err);
  process.exit(1);
});
