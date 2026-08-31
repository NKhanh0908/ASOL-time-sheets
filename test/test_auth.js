process.env.NODE_ENV = "test";
const assert = require("assert");
const http = require("http");
const app = require("../server.js");

function makeRequest(server, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (bodyData) req.write(JSON.stringify(bodyData));
    req.end();
  });
}

async function testMigrationAndLookup() {
  console.log("▶ Testing Employee Migration and DB Helpers...");

  const legacyEmployees = [
    { id: "legacy-1", name: "Nguyễn Văn A" },
    { id: "legacy-2", name: "Trần Thị B" },
  ];

  const migrated = app.migrateEmployeeList(legacyEmployees);
  assert.strictEqual(migrated.length, 2);
  assert.strictEqual(migrated[0].code, "TTS01");
  assert.ok(migrated[0].password_hash, "password_hash should be populated");
  assert.ok(migrated[0].salt, "salt should be populated");
  assert.strictEqual(app.verifyPassword("TTS01123456", migrated[0].password_hash, migrated[0].salt), true);

  assert.strictEqual(migrated[1].code, "TTS02");
  assert.strictEqual(app.verifyPassword("TTS02123456", migrated[1].password_hash, migrated[1].salt), true);

  console.log("✔ Employee Migration passed!");
}

async function testTokenAndMiddleware() {
  console.log("▶ Testing Auth Tokens & Middleware...");

  const empPayload = {
    role: "employee",
    id: "emp-uuid-1",
    code: "TTS01",
    name: "Nguyễn Văn A",
  };
  const empToken = app.generateAuthToken(empPayload);
  assert.ok(empToken.includes("."), "Token should contain dot separator");

  const verifiedEmp = app.verifyAuthToken(empToken);
  assert.ok(verifiedEmp, "Token should verify successfully");
  assert.strictEqual(verifiedEmp.role, "employee");
  assert.strictEqual(verifiedEmp.id, "emp-uuid-1");
  assert.strictEqual(verifiedEmp.code, "TTS01");
  assert.strictEqual(verifiedEmp.name, "Nguyễn Văn A");

  const adminPayload = { role: "admin" };
  const adminToken = app.generateAuthToken(adminPayload);
  const verifiedAdmin = app.verifyAuthToken(adminToken);
  assert.strictEqual(verifiedAdmin.role, "admin");

  // Test invalid token
  assert.strictEqual(app.verifyAuthToken("invalid.token"), false);
  assert.strictEqual(app.verifyAuthToken(null), false);

  console.log("✔ Tokens & Middleware passed!");
}

async function testAuthEndpoints() {
  console.log("▶ Testing Auth Endpoints (login, me, change-password)...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const initHashed = app.hashPassword("TTSTEST123456");
    const emp = await app.db.createEmployee({
      code: "TTSTEST",
      name: "Test Auth User",
      password_hash: initHashed.hash,
      salt: initHashed.salt,
    });

    // 1. Employee Login with credentials
    const empLoginRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { role: "employee", code: "TTSTEST", password: "TTSTEST123456" });

    assert.strictEqual(empLoginRes.status, 200);
    assert.ok(empLoginRes.body.token, "Should return session token");
    assert.strictEqual(empLoginRes.body.user.role, "employee");
    assert.strictEqual(empLoginRes.body.user.code, "TTSTEST");
    const empToken = empLoginRes.body.token;

    // 2. GET /api/auth/me with employee token
    const meRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.code, "TTSTEST");

    // 3. Employee Change Password
    const changePassRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/change-password",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${empToken}`,
      },
    }, { currentPassword: "TTSTEST123456", newPassword: "newpassword123" });
    assert.strictEqual(changePassRes.status, 200);
    assert.strictEqual(changePassRes.body.success, true);

    // 4. Employee Login with New Password
    const newLoginRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { role: "employee", code: "TTSTEST", password: "newpassword123" });
    assert.strictEqual(newLoginRes.status, 200);

    // 5. Admin Login
    const adminLoginRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { role: "admin", password: "admin123" });
    assert.strictEqual(adminLoginRes.status, 200);
    assert.strictEqual(adminLoginRes.body.user.role, "admin");

    // Clean up test employee
    await app.db.deleteEmployee(emp.id);

    console.log("✔ Auth Endpoints passed!");
  } finally {
    server.close();
  }
}

async function testEmployeeManagement() {
  console.log("▶ Testing Employee Management & Admin Reset Password...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const adminToken = app.generateAuthToken({ role: "admin" });

    // 1. Create employee with code and custom password
    const createRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/employees",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    }, { code: "TTS99", name: "Thực tập sinh Test 99", password: "custompassword" });

    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.employee.code, "TTS99");
    const newEmpId = createRes.body.employee.id;

    // 2. Verify duplicate code is rejected
    const dupRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/employees",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    }, { code: "TTS99", name: "Trùng mã" });
    assert.strictEqual(dupRes.status, 400);

    // 3. Admin Reset Password for Employee
    const resetRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/employees/${newEmpId}/reset-password`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    }, {});
    assert.strictEqual(resetRes.status, 200);
    assert.ok(resetRes.body.generatedPassword, "Should return auto-generated password");

    // 4. Verify employee can login with reset password
    const loginResetRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { role: "employee", code: "TTS99", password: resetRes.body.generatedPassword });
    assert.strictEqual(loginResetRes.status, 200);

    // Clean up
    await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/employees/${newEmpId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    console.log("✔ Employee Management & Reset Password passed!");
  } finally {
    server.close();
  }
}

async function testScopedAccess() {
  console.log("▶ Testing Scoped Timesheet Access Enforcement...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const adminToken = app.generateAuthToken({ role: "admin" });
    const emp1Token = app.generateAuthToken({ role: "employee", id: "emp-1", code: "TTS01", name: "User 1" });
    const emp2Token = app.generateAuthToken({ role: "employee", id: "emp-2", code: "TTS02", name: "User 2" });

    // 1. Employee 1 creates an entry
    const createRes1 = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/entries",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emp1Token}`,
      },
    }, { date: "2026-08-31", employeeId: "emp-1", in: "08:30", mode: "Onsite", note: "Làm việc task auth" });
    assert.strictEqual(createRes1.status, 200);
    const entry1Id = createRes1.body.id;

    // 2. Employee 1 tries to create an entry claiming to be Employee 2 (MUST BE REJECTED WITH 403)
    const spoofRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/entries",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emp1Token}`,
      },
    }, { date: "2026-08-31", employeeId: "emp-2", in: "08:30", mode: "Onsite", note: "Spoofing" });
    assert.strictEqual(spoofRes.status, 403);

    // 3. Employee 2 queries entries -> Should NOT see Employee 1's entry
    const emp2EntriesRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/entries?month=2026-08",
      method: "GET",
      headers: { Authorization: `Bearer ${emp2Token}` },
    });
    assert.strictEqual(emp2EntriesRes.status, 200);
    assert.strictEqual(emp2EntriesRes.body.some((e) => e.id === entry1Id), false);

    // 4. Employee 2 tries to update Employee 1's entry -> Must return 403
    const emp2UpdateRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/entries/${entry1Id}`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emp2Token}`,
      },
    }, { out: "17:30" });
    assert.strictEqual(emp2UpdateRes.status, 403);

    // 5. Employee 1 tries to delete own entry -> Must be forbidden (Admin only)
    const emp1DeleteRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/entries/${entry1Id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${emp1Token}` },
    });
    assert.strictEqual(emp1DeleteRes.status, 403);

    // 6. Admin deletes entry -> Succeeded
    const adminDeleteRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/entries/${entry1Id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminDeleteRes.status, 200);

    console.log("✔ Scoped Timesheet Access passed!");
  } finally {
    server.close();
  }
}

if (require.main === module) {
  (async () => {
    await testMigrationAndLookup();
    await testTokenAndMiddleware();
    await testAuthEndpoints();
    await testEmployeeManagement();
    await testScopedAccess();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  testMigrationAndLookup,
  testTokenAndMiddleware,
  testAuthEndpoints,
  testEmployeeManagement,
  testScopedAccess,
};
