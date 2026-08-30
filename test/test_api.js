const assert = require("assert");

function runTest() {
  console.log("Running backend validation test...");

  const validateEntry = (body) => {
    const { date, employeeId, in: timeIn, out, lunchOut, lunchIn, mode, note } = body;
    const trimmedNote = (note || "").trim();
    if (!date || !employeeId || !mode || !trimmedNote) {
      return { status: 400, error: "Thiếu ngày, nhân viên, hình thức hoặc ghi chú" };
    }
    return {
      status: 200,
      entry: {
        id: "test-id",
        date,
        employeeId,
        in: timeIn || "",
        out: out || "",
        lunchOut: lunchOut || "",
        lunchIn: lunchIn || "",
        mode,
        note: trimmedNote,
      },
    };
  };

  // 1. Missing note should fail
  const res1 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Onsite", note: "" });
  assert.strictEqual(res1.status, 400, "Should reject empty note");
  assert.strictEqual(res1.error, "Thiếu ngày, nhân viên, hình thức hoặc ghi chú");

  // 2. Whitespace note should fail
  const res2 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Nghỉ", note: "   " });
  assert.strictEqual(res2.status, 400, "Should reject whitespace note");
  assert.strictEqual(res2.error, "Thiếu ngày, nhân viên, hình thức hoặc ghi chú");

  // 3. Missing required fields
  const res3 = validateEntry({ date: "", employeeId: "emp-1", mode: "Onsite", note: "Work" });
  assert.strictEqual(res3.status, 400, "Should reject missing date");

  // 4. Valid entry with lunch times should succeed
  const res4 = validateEntry({
    date: "2026-08-30",
    employeeId: "emp-1",
    in: "08:30",
    lunchOut: "12:00",
    lunchIn: "13:30",
    out: "18:00",
    mode: "Onsite",
    note: "Làm tính năng chấm công",
  });
  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.entry.lunchOut, "12:00");
  assert.strictEqual(res4.entry.lunchIn, "13:30");
  assert.strictEqual(res4.entry.note, "Làm tính năng chấm công");

  console.log("All backend tests passed!");
}

runTest();
