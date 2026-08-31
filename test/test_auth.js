process.env.NODE_ENV = "test";
const assert = require("assert");
const app = require("../server.js");

async function testMigrationAndLookup() {
  console.log("▶ Testing Employee Migration and DB Helpers...");

  // Test migrateEmployeeList helper with legacy records
  const legacyEmployees = [
    { id: "legacy-1", name: "Nguyễn Văn A" },
    { id: "legacy-2", name: "Trần Thị B" },
  ];

  const migrated = app.migrateEmployeeList(legacyEmployees);
  assert.strictEqual(migrated.length, 2);
  assert.strictEqual(migrated[0].code, "NV01");
  assert.ok(migrated[0].password_hash, "password_hash should be populated");
  assert.ok(migrated[0].salt, "salt should be populated");
  assert.strictEqual(app.verifyPassword("NV01123456", migrated[0].password_hash, migrated[0].salt), true);

  assert.strictEqual(migrated[1].code, "NV02");
  assert.strictEqual(app.verifyPassword("NV02123456", migrated[1].password_hash, migrated[1].salt), true);

  console.log("✔ Employee Migration passed!");
}

async function testTokenAndMiddleware() {
  console.log("▶ Testing Auth Tokens & Middleware...");

  const empPayload = {
    role: "employee",
    id: "emp-uuid-1",
    code: "NV01",
    name: "Nguyễn Văn A",
  };
  const empToken = app.generateAuthToken(empPayload);
  assert.ok(empToken.includes("."), "Token should contain dot separator");

  const verifiedEmp = app.verifyAuthToken(empToken);
  assert.ok(verifiedEmp, "Token should verify successfully");
  assert.strictEqual(verifiedEmp.role, "employee");
  assert.strictEqual(verifiedEmp.id, "emp-uuid-1");
  assert.strictEqual(verifiedEmp.code, "NV01");
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

if (require.main === module) {
  (async () => {
    await testMigrationAndLookup();
    await testTokenAndMiddleware();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { testMigrationAndLookup, testTokenAndMiddleware };
