process.env.NODE_ENV = "test";
const assert = require("assert");
const app = require("../server");

async function runSyncTests() {
  console.log("Running Google Sheet Sync Backend Test Suite...");

  // 1. Test payload generator helper with employeeCode
  assert.ok(typeof app.buildSyncEntryPayload === "function", "buildSyncEntryPayload must be exported");
  const sampleEntry = {
    date: "2026-08-31",
    employeeId: "emp-1",
    in: "08:30",
    out: "17:30",
    mode: "Onsite",
    note: "Completed tasks",
    updated_at: "2026-08-31T10:30:00.000Z"
  };
  const payload = app.buildSyncEntryPayload(sampleEntry, "Nguyễn Văn A", "TTS01");
  assert.strictEqual(payload.action, "sync_entry");
  assert.strictEqual(payload.entry.employeeName, "Nguyễn Văn A");
  assert.strictEqual(payload.entry.employeeCode, "TTS01");
  assert.strictEqual(payload.entry.workHours, 7.5);
  assert.ok(payload.secret, "Payload must include secret token");

  // 2. Test month summary calculation helper
  assert.ok(typeof app.aggregateMonthSummary === "function", "aggregateMonthSummary must be exported");
  const employees = [{ id: "emp-1", code: "TTS01", name: "Nguyễn Văn A" }, { id: "emp-2", code: "TTS02", name: "Trần Thị B" }];
  const entries = [
    { date: "2026-08-01", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Onsite" },
    { date: "2026-08-02", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Remote" },
    { date: "2026-08-03", employeeId: "emp-1", in: "", out: "", mode: "Nghỉ" },
    { date: "2026-08-01", employeeId: "emp-2", in: "08:30", out: "12:30", mode: "Onsite" }
  ];
  const summary = app.aggregateMonthSummary(employees, entries);
  assert.strictEqual(summary.length, 2);
  assert.strictEqual(summary[0].employeeCode, "TTS01");
  assert.strictEqual(summary[0].totalHours, 15);
  assert.strictEqual(summary[0].onsiteDays, 1);
  assert.strictEqual(summary[0].remoteDays, 1);
  assert.strictEqual(summary[0].offDays, 1);
  assert.strictEqual(summary[1].employeeCode, "TTS02");
  assert.strictEqual(summary[1].totalHours, 4);

  // 3. Test non-blocking dispatch with invalid URL
  let threw = false;
  try {
    await app.sendGoogleSheetWebhook({ action: "test" }, "http://invalid-url-that-does-not-exist.local");
  } catch {
    threw = true;
  }
  assert.strictEqual(threw, false, "sendGoogleSheetWebhook must catch errors internally and never throw");

  // 4. Test syncMonthData validation & helper
  assert.ok(typeof app.syncMonthData === "function", "syncMonthData must be exported");
  const invalidMonthRes = await app.syncMonthData("invalid-month");
  assert.strictEqual(invalidMonthRes.success, false);
  assert.ok(invalidMonthRes.error.includes("không hợp lệ"));

  // 5. Test syncDeltaData helper & High-Watermark
  assert.ok(typeof app.syncDeltaData === "function", "syncDeltaData must be exported");
  const invalidDeltaMonthRes = await app.syncDeltaData("invalid-month");
  assert.strictEqual(invalidDeltaMonthRes.success, false);

  // 6. Test Cron Schedule expression
  assert.strictEqual(app.CRON_SCHEDULE, "0 10,20 * * *", "CRON_SCHEDULE must be 0 10,20 * * * for 10h and 20h");

  // 7. Test getEffectiveWebhookConfig secret
  assert.ok(typeof app.getEffectiveWebhookConfig === "function", "getEffectiveWebhookConfig must be exported");
  const config = await app.getEffectiveWebhookConfig();
  assert.ok(config.syncSecret !== undefined, "config must contain syncSecret");

  console.log("✅ Sync backend test suite passed successfully!");
}

runSyncTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Sync backend test failed:", err);
    process.exit(1);
  });
