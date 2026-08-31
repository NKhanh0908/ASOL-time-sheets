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

if (require.main === module) {
  testMigrationAndLookup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { testMigrationAndLookup };
