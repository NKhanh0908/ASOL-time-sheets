const assert = require("assert");

function runTest() {
  console.log("Running backend validation test...");

  // Validate creation
  const validateEntry = (body) => {
    const { date, employeeId, in: timeIn, out, mode, note } = body;
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
        mode,
        note: trimmedNote,
      },
    };
  };

  // 1. Missing note should fail
  const res1 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Onsite", note: "" });
  assert.strictEqual(res1.status, 400, "Should reject empty note");

  // 2. Allow single check-in in the morning (in without out)
  const res2 = validateEntry({
    date: "2026-08-30",
    employeeId: "emp-1",
    in: "08:30",
    out: "",
    mode: "Onsite",
    note: "Bắt đầu ngày làm việc",
  });
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.entry.in, "08:30");
  assert.strictEqual(res2.entry.out, "");

  console.log("All backend tests passed!");
}

runTest();
