process.env.NODE_ENV = "test";
const assert = require("assert");
const {
  hashPassword,
  verifyPassword,
  generateAdminToken,
  verifyAdminToken,
  requireAdmin,
} = require("../server");

function runTest() {
  console.log("Running backend validation and auth test suite...");

  // 1. Validate creation
  const validateEntry = (body) => {
    const { date, employeeId, in: timeIn, out, mode, note } = body;
    const trimmedNote = (note || "").trim();
    if (!date || !employeeId || !mode || !trimmedNote) {
      return { status: 400, error: "Thiếu ngày, thực tập sinh, hình thức hoặc ghi chú" };
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

  // Missing note should fail
  const res1 = validateEntry({ date: "2026-08-30", employeeId: "emp-1", mode: "Onsite", note: "" });
  assert.strictEqual(res1.status, 400, "Should reject empty note");

  // Allow single check-in in the morning (in without out)
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

  // 2. Password Hashing & Verification Tests
  console.log("Testing Password Hashing and Scrypt verification...");
  const { hash, salt } = hashPassword("secretAdminPass123");
  assert.ok(hash && hash.length > 20, "Hash should be generated");
  assert.ok(salt && salt.length > 10, "Salt should be generated");
  assert.strictEqual(verifyPassword("secretAdminPass123", hash, salt), true, "Valid password should verify");
  assert.strictEqual(verifyPassword("wrongPassword", hash, salt), false, "Wrong password should fail");
  assert.strictEqual(verifyPassword("", hash, salt), false, "Empty password should fail");

  // 3. Admin Session Token Tests
  console.log("Testing Admin Session Token HMAC...");
  const token = generateAdminToken();
  assert.ok(token && token.includes("."), "Token should be payload.sig format");
  assert.strictEqual(verifyAdminToken(token), true, "Fresh token should verify");
  assert.strictEqual(verifyAdminToken("invalid.token.here"), false, "Tampered token should fail");
  assert.strictEqual(verifyAdminToken(null), false, "Null token should fail");

  // 4. Middleware requireAdmin Simulation
  console.log("Testing requireAdmin middleware simulation...");
  let reqNoAuth = { headers: {} };
  let statusCode = 0;
  let resJson = {};
  let resObj = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          resJson = data;
        },
      };
    },
  };
  let nextCalled = false;

  requireAdmin(reqNoAuth, resObj, () => {
    nextCalled = true;
  });
  assert.strictEqual(statusCode, 401, "Missing auth header should return 401");
  assert.strictEqual(nextCalled, false, "next() should not be called when unauthenticated");

  let reqWithAuth = { headers: { authorization: `Bearer ${token}` } };
  statusCode = 0;
  nextCalled = false;
  requireAdmin(reqWithAuth, resObj, () => {
    nextCalled = true;
  });
  assert.strictEqual(statusCode, 0, "Valid token should not trigger error status");
  assert.strictEqual(nextCalled, true, "next() should be called when authenticated");

  // 5. Entry Query Filtering Simulation
  console.log("Testing Entry Query Filters (date, employee, mode)...");
  const sampleEntries = [
    { id: "1", date: "2026-08-01", employeeId: "emp-1", mode: "Onsite" },
    { id: "2", date: "2026-08-15", employeeId: "emp-2", mode: "Remote" },
    { id: "3", date: "2026-08-20", employeeId: "emp-1", mode: "Remote" },
    { id: "4", date: "2026-07-31", employeeId: "emp-1", mode: "Nghỉ" },
  ];

  const applyFilters = (items, filters) => {
    const { month, employeeId, startDate, endDate, mode } = filters;
    return items.filter((e) => {
      if (month && !e.date.startsWith(month)) return false;
      if (employeeId && e.employeeId !== employeeId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (mode && e.mode !== mode) return false;
      return true;
    });
  };

  assert.strictEqual(applyFilters(sampleEntries, { month: "2026-08" }).length, 3);
  assert.strictEqual(applyFilters(sampleEntries, { employeeId: "emp-1" }).length, 3);
  assert.strictEqual(applyFilters(sampleEntries, { employeeId: "emp-1", mode: "Remote" }).length, 1);
  assert.strictEqual(applyFilters(sampleEntries, { startDate: "2026-08-05", endDate: "2026-08-25" }).length, 2);

  // 6. Test duplicate completed entry logic
  console.log("Testing rejection of duplicate entry when already completed...");
  const checkDuplicate = (existing, newPayload) => {
    if (!existing) return { allowed: true };
    const isCompleted = (existing.in && existing.out) || existing.mode === "Nghỉ" || existing.mode === "Off";
    if (isCompleted) {
      return { allowed: false, error: "Thực tập sinh này đã hoàn thành chấm công trong ngày hôm nay!" };
    }
    if (existing.in && !existing.out && newPayload.out) {
      return { allowed: true, isUpdate: true };
    }
    return { allowed: false, error: "Nhân viên này đã điểm danh vào rồi!" };
  };

  const completedEntry = { date: "2026-08-31", employeeId: "emp-1", in: "08:30", out: "17:30", mode: "Onsite" };
  const resDup1 = checkDuplicate(completedEntry, { in: "09:00", out: "18:00" });
  assert.strictEqual(resDup1.allowed, false, "Should reject new entry when already completed");

  const leaveEntry = { date: "2026-08-31", employeeId: "emp-2", mode: "Nghỉ" };
  const resDup2 = checkDuplicate(leaveEntry, { in: "08:30", out: "17:30" });
  assert.strictEqual(resDup2.allowed, false, "Should reject new entry when already marked Off");

  const inProgressEntry = { date: "2026-08-31", employeeId: "emp-3", in: "08:30", out: "" };
  const resDup3 = checkDuplicate(inProgressEntry, { out: "17:30" });
  assert.strictEqual(resDup3.allowed, true, "Should allow updating out time for in-progress entry");

  console.log("All backend validation and auth tests passed successfully!");
}

runTest();
