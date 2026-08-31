# Employee Authentication & Scoped Timesheet Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement mandatory employee authentication with unique employee codes (`NV01`, `NV02`, etc.), scoped data access (employees can only view/record their own timesheets), self-service & admin password management, and backward-compatible data migration.

**Architecture:** Extend backend database layer (Supabase + Local JSON) with employee credentials (`code`, `password_hash`, `salt`) and auto-migration for legacy records. Update HMAC-SHA256 session token generation and middleware (`requireAuth`, `requireAdmin`). Enforce scoped access in REST endpoints (`/api/entries`, `/api/employees`). Introduce a full-screen Login Gate modal on the frontend and tailor tab views based on active role (`employee` vs `admin`).

**Tech Stack:** Node.js, Express 4.19, crypto (`scryptSync`, HMAC-SHA256), Vanilla ES6 Modules, Supabase (PostgreSQL) / Local JSON DB, Node.js built-in `assert` test runner.

**Spec:** [`docs/superpowers/specs/2026-08-31-employee-auth-timesheet-design.md`](file:///D:/Working/ASOL/tool/timesheet-app/docs/superpowers/specs/2026-08-31-employee-auth-timesheet-design.md)

## Global Constraints

- Backend must support dual-database mode: Supabase PostgreSQL when credentials exist, local `data/db.json` when offline/local.
- Existing employee records without `code` or `password_hash` must be auto-migrated on startup without data loss.
- Passwords must be hashed using Node's `crypto.scryptSync(password, salt, 64)`.
- Tokens must be signed with HMAC-SHA256 using `ADMIN_JWT_SECRET` (fallback: `"asol-timesheet-admin-secret-2026"`).
- Employees must never be able to access, create, update, or delete other employees' timesheets.
- Frontend must remain 100% Native ES6 modules (no bundler/build step).
- All new UI strings must be localized in both Vietnamese (`vi`) and English (`en`) in `public/js/i18n.js`.

---

## File Structure

```
├── schema.sql                               # Extended Supabase SQL schema (code, password_hash, salt)
├── server.js                                # Express backend: auth helpers, migration, middleware, scoped endpoints
├── data/db.json                             # Local JSON store (auto-migrated)
├── public/
│   ├── index.html                           # Login Gate DOM, topbar user controls, Employee tab markup
│   ├── styles.css                           # Login Gate styling, password badges, scoped UI states
│   └── js/
│       ├── state.js                         # State for currentUser, token, role, scoped flags
│       ├── api.js                           # Auth client methods (login, getMe, changePass, resetPass)
│       ├── i18n.js                          # Vietnamese and English translation dictionary keys
│       ├── main.js                          # App boot logic: check token, mount gate or tabs
│       ├── modals/
│       │   ├── loginGate.js                 # Login Gate controller (Employee tab vs Admin tab)
│       │   ├── adminAuth.js                 # Topbar user controls, change password modal
│       │   └── settingsModal.js             # Existing admin settings modal
│       ├── tabs/
│       │   ├── chamCong.js                  # Scoped check-in (locked to logged-in employee)
│       │   ├── locChamCong.js               # Scoped filter (locked to logged-in employee)
│       │   ├── tongHop.js                   # Scoped monthly summary
│       │   └── nhanVien.js                  # Admin employee management (code, name, random pass, reset pass)
│       └── utils/
│           ├── time.js                      # Time calculation helpers
│           └── ui.js                        # Toast, button spinners, pagination
└── test/
    ├── test_auth.js                         # Unit & API test suite for auth & scoped access
    ├── test_api.js                          # Existing API tests updated with auth headers
    ├── test_e2e_calc.js                     # Existing E2E calculations
    └── test_sync.js                         # Existing Google Sheet sync tests
```

---

## Tasks

### Task 1: Extended Schema & Database Migration Helpers

**Files:**
- Modify: `schema.sql:6-12`
- Modify: `server.js:78-160`
- Test: `test/test_auth.js`

**Interfaces:**
- Consumes: `loadLocalDB()`, `saveLocalDB()`, `supabase` client, `hashPassword(password, salt)`
- Produces: `db.migrateEmployees()`, updated `db.createEmployee(employeeData)`, `db.getEmployeeByCode(code)`, `db.getEmployeeById(id)`, `db.updateEmployee(id, patch)`

- [ ] **Step 1: Write the failing test for employee migration and lookup helpers**

Create `test/test_auth.js`:
```javascript
const assert = require("assert");
const app = require("../server.js");

async function testMigrationAndLookup() {
  console.log("▶ Testing Employee Migration and DB Helpers...");
  
  // Test migrateEmployees helper with legacy records
  const legacyEmployees = [
    { id: "legacy-1", name: "Nguyễn Văn A" },
    { id: "legacy-2", name: "Trần Thị B" }
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test_auth.js`
Expected: FAIL with `app.migrateEmployeeList is not a function`

- [ ] **Step 3: Implement database migration and schema updates**

1. Update `schema.sql`:
```sql
-- 1. Bảng Nhân viên (employees)
create table if not exists public.employees (
  id text primary key,
  code text unique not null,
  name text not null,
  password_hash text not null,
  salt text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index if not exists idx_employees_code on public.employees(code);
```

2. In `server.js`, implement `migrateEmployeeList(employees)` and update DB methods:
```javascript
function migrateEmployeeList(employees = []) {
  let counter = 1;
  const usedCodes = new Set(employees.map(e => (e.code || "").toUpperCase()).filter(Boolean));
  
  return employees.map((emp) => {
    let code = emp.code;
    if (!code) {
      while (usedCodes.has(`NV${String(counter).padStart(2, "0")}`)) {
        counter++;
      }
      code = `NV${String(counter).padStart(2, "0")}`;
      usedCodes.add(code);
      counter++;
    }
    
    let { password_hash, salt } = emp;
    if (!password_hash || !salt) {
      const defaultPass = `${code}123456`;
      const hashed = hashPassword(defaultPass);
      password_hash = hashed.hash;
      salt = hashed.salt;
    }
    
    return {
      ...emp,
      code,
      password_hash,
      salt,
      created_at: emp.created_at || new Date().toISOString()
    };
  });
}
```

Update `db` methods in `server.js`:
- In `loadLocalDB()`: run `migrateEmployeeList()` on `data.employees` and if any records were migrated, save back to `data/db.json`.
- Add `db.getEmployeeByCode(code)`: finds employee by uppercase code.
- Add `db.getEmployeeById(id)`: finds employee by id.
- Add `db.updateEmployee(id, patch)`: updates fields (`name`, `password_hash`, `salt`, etc.).
- Update `db.createEmployee({ code, name, password })`: creates employee with provided or auto-generated code and password hash.
- Export `app.migrateEmployeeList = migrateEmployeeList;` at bottom of `server.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_auth.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add schema.sql server.js test/test_auth.js
git commit -m "feat(auth): add employee schema extension, lookup methods, and auto-migration"
```

---

### Task 2: Generalized HMAC-SHA256 Token Helpers & Role Middleware

**Files:**
- Modify: `server.js:43-76`
- Test: `test/test_auth.js`

**Interfaces:**
- Consumes: `crypto.createHmac`, `ADMIN_JWT_SECRET`
- Produces: `generateAuthToken(payload)`, `verifyAuthToken(token)`, `requireAuth(req, res, next)`, `requireAdmin(req, res, next)`

- [ ] **Step 1: Write failing tests for token generation, payload decoding, and middleware**

Append to `test/test_auth.js`:
```javascript
async function testTokenAndMiddleware() {
  console.log("▶ Testing Auth Tokens & Middleware...");
  
  const empPayload = {
    role: "employee",
    id: "emp-uuid-1",
    code: "NV01",
    name: "Nguyễn Văn A"
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test_auth.js`
Expected: FAIL with `app.generateAuthToken is not a function`

- [ ] **Step 3: Implement token helpers & middleware in `server.js`**

In `server.js`:
```javascript
function generateAuthToken(payload) {
  const tokenPayload = {
    ...payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
  };
  const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payloadB64, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    if (payload.exp && payload.exp <= Date.now()) return false;
    return payload;
  } catch {
    return false;
  }
}

// Backward compatibility wrappers for existing code
function generateAdminToken() {
  return generateAuthToken({ role: "admin" });
}

function verifyAdminToken(token) {
  const payload = verifyAuthToken(token);
  return Boolean(payload && payload.role === "admin");
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yêu cầu đăng nhập để tiếp tục" });
  }
  const token = authHeader.split(" ")[1];
  const user = verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ" });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Yêu cầu quyền quản trị viên (Admin)" });
    }
    next();
  });
}
```

Export `app.generateAuthToken = generateAuthToken;` and `app.verifyAuthToken = verifyAuthToken;` and `app.requireAuth = requireAuth;`.

- [ ] **Step 4: Run test to verify it passes**

Update `test/test_auth.js` main block to call `testTokenAndMiddleware()`.
Run: `node test/test_auth.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js test/test_auth.js
git commit -m "feat(auth): implement generalized HMAC token helpers and requireAuth middleware"
```

---

### Task 3: Auth Endpoints (`login`, `me`, `change-password`)

**Files:**
- Modify: `server.js:280-337`
- Test: `test/test_auth.js`

**Interfaces:**
- Consumes: `db.getEmployeeByCode()`, `db.updateEmployee()`, `db.getSetting("admin_auth")`, `verifyPassword()`, `hashPassword()`
- Produces: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password`

- [ ] **Step 1: Write failing test for auth endpoints**

Append to `test/test_auth.js`:
```javascript
const http = require("http");

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

async function testAuthEndpoints() {
  console.log("▶ Testing Auth Endpoints (login, me, change-password)...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Employee Login with Default credentials (NV01 / NV01123456)
    const empLoginRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { role: "employee", code: "NV01", password: "NV01123456" });

    assert.strictEqual(empLoginRes.status, 200);
    assert.ok(empLoginRes.body.token, "Should return session token");
    assert.strictEqual(empLoginRes.body.user.role, "employee");
    assert.strictEqual(empLoginRes.body.user.code, "NV01");
    const empToken = empLoginRes.body.token;

    // 2. GET /api/auth/me with employee token
    const meRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: `Bearer ${empToken}` }
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.code, "NV01");

    // 3. Employee Change Password
    const changePassRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/change-password",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${empToken}`
      }
    }, { currentPassword: "NV01123456", newPassword: "newpassword123" });
    assert.strictEqual(changePassRes.status, 200);
    assert.strictEqual(changePassRes.body.success, true);

    // 4. Employee Login with New Password
    const newLoginRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { role: "employee", code: "NV01", password: "newpassword123" });
    assert.strictEqual(newLoginRes.status, 200);

    // 5. Admin Login
    const adminLoginRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { role: "admin", password: "admin123" });
    assert.strictEqual(adminLoginRes.status, 200);
    assert.strictEqual(adminLoginRes.body.user.role, "admin");

    console.log("✔ Auth Endpoints passed!");
  } finally {
    server.close();
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Update `test/test_auth.js` main block to call `testAuthEndpoints()`.
Run: `node test/test_auth.js`
Expected: FAIL with 404 or connection error for `/api/auth/login`

- [ ] **Step 3: Implement endpoints in `server.js`**

In `server.js`:
```javascript
// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { role = "employee", code, password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Vui lòng nhập mật khẩu" });
    }

    if (role === "admin") {
      let authSetting = await db.getSetting("admin_auth");
      if (!authSetting || !authSetting.hash) {
        const { hash, salt } = hashPassword("admin123");
        authSetting = { hash, salt, updated_at: new Date().toISOString() };
        await db.setSetting("admin_auth", authSetting);
      }
      if (!verifyPassword(password, authSetting.hash, authSetting.salt)) {
        return res.status(401).json({ error: "Mật khẩu quản trị không chính xác" });
      }
      const user = { role: "admin" };
      const token = generateAuthToken(user);
      return res.json({ token, user });
    }

    // Employee Login
    if (!code) {
      return res.status(400).json({ error: "Vui lòng nhập mã nhân viên" });
    }
    const cleanCode = String(code).trim().toUpperCase();
    const employee = await db.getEmployeeByCode(cleanCode);
    if (!employee) {
      return res.status(401).json({ error: "Mã nhân viên hoặc mật khẩu không chính xác" });
    }

    const isValid = verifyPassword(password, employee.password_hash, employee.salt);
    if (!isValid) {
      return res.status(401).json({ error: "Mã nhân viên hoặc mật khẩu không chính xác" });
    }

    const user = {
      role: "employee",
      id: employee.id,
      code: employee.code,
      name: employee.name,
    };
    const token = generateAuthToken(user);
    return res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    if (req.user.role === "admin") {
      let authSetting = await db.getSetting("admin_auth");
      if (!authSetting || !authSetting.hash) {
        const init = hashPassword("admin123");
        authSetting = { hash: init.hash, salt: init.salt, updated_at: new Date().toISOString() };
        await db.setSetting("admin_auth", authSetting);
      }
      if (!verifyPassword(currentPassword, authSetting.hash, authSetting.salt)) {
        return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
      }
      const { hash, salt } = hashPassword(newPassword);
      await db.setSetting("admin_auth", { hash, salt, updated_at: new Date().toISOString() });
      return res.json({ success: true, message: "Đổi mật khẩu Admin thành công!" });
    }

    // Employee password change
    const employee = await db.getEmployeeById(req.user.id);
    if (!employee) {
      return res.status(404).json({ error: "Không tìm thấy thông tin nhân viên" });
    }
    if (!verifyPassword(currentPassword, employee.password_hash, employee.salt)) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
    }
    const { hash, salt } = hashPassword(newPassword);
    await db.updateEmployee(req.user.id, { password_hash: hash, salt });
    return res.json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_auth.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js test/test_auth.js
git commit -m "feat(auth): implement unified login, getMe, and change-password endpoints"
```

---

### Task 4: Employee Management & Password Reset Endpoints

**Files:**
- Modify: `server.js:338-367`
- Test: `test/test_auth.js`

**Interfaces:**
- Consumes: `requireAdmin`, `db.createEmployee`, `db.updateEmployee`, `db.getEmployees`
- Produces: `POST /api/employees` (with unique `code` check & auto/manual password), `POST /api/employees/:id/reset-password`, sanitized `GET /api/employees` (strip `password_hash` and `salt`)

- [ ] **Step 1: Write failing test for employee creation & password reset**

Append to `test/test_auth.js`:
```javascript
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
        Authorization: `Bearer ${adminToken}`
      }
    }, { code: "NV99", name: "Nhân viên Test 99", password: "custompassword" });

    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.employee.code, "NV99");
    const newEmpId = createRes.body.employee.id;

    // 2. Verify duplicate code is rejected
    const dupRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/employees",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      }
    }, { code: "NV99", name: "Trùng mã" });
    assert.strictEqual(dupRes.status, 400);

    // 3. Admin Reset Password for Employee
    const resetRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/employees/${newEmpId}/reset-password`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      }
    }, {});
    assert.strictEqual(resetRes.status, 200);
    assert.ok(resetRes.body.generatedPassword, "Should return auto-generated password");

    // 4. Verify employee can login with reset password
    const loginResetRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { role: "employee", code: "NV99", password: resetRes.body.generatedPassword });
    assert.strictEqual(loginResetRes.status, 200);

    // Clean up
    await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/employees/${newEmpId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log("✔ Employee Management & Reset Password passed!");
  } finally {
    server.close();
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Update `test/test_auth.js` main block to call `testEmployeeManagement()`.
Run: `node test/test_auth.js`
Expected: FAIL

- [ ] **Step 3: Implement employee management endpoints in `server.js`**

In `server.js`:
```javascript
function generateRandomPassword(prefix = "NV") {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${digits}`;
}

// GET /api/employees (sanitize password_hash and salt)
app.get("/api/employees", async (req, res) => {
  try {
    const list = await db.getEmployees();
    const sanitized = list.map(({ password_hash, salt, ...emp }) => emp);
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees (Admin only)
app.post("/api/employees", requireAdmin, async (req, res) => {
  const { name, code, password } = req.body || {};
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    return res.status(400).json({ error: "Tên không được để trống" });
  }

  try {
    const employees = await db.getEmployees();
    let finalCode = (code || "").trim().toUpperCase();

    if (finalCode) {
      const exists = employees.some((e) => (e.code || "").toUpperCase() === finalCode);
      if (exists) {
        return res.status(400).json({ error: "Mã nhân viên này đã tồn tại" });
      }
    } else {
      let counter = 1;
      const usedCodes = new Set(employees.map((e) => (e.code || "").toUpperCase()).filter(Boolean));
      while (usedCodes.has(`NV${String(counter).padStart(2, "0")}`)) {
        counter++;
      }
      finalCode = `NV${String(counter).padStart(2, "0")}`;
    }

    const rawPassword = (password || "").trim() || generateRandomPassword(finalCode);
    const { hash, salt } = hashPassword(rawPassword);

    const emp = await db.createEmployee({
      code: finalCode,
      name: trimmedName,
      password_hash: hash,
      salt,
    });

    const { password_hash, salt: _s, ...sanitizedEmp } = emp;
    res.json({
      employee: sanitizedEmp,
      generatedPassword: rawPassword,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees/:id/reset-password (Admin only)
app.post("/api/employees/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const employee = await db.getEmployeeById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    const newRawPassword = (req.body.newPassword || "").trim() || generateRandomPassword(employee.code || "NV");
    const { hash, salt } = hashPassword(newRawPassword);

    await db.updateEmployee(req.params.id, { password_hash: hash, salt });

    res.json({
      success: true,
      employeeId: req.params.id,
      generatedPassword: newRawPassword,
      message: `Đã đặt lại mật khẩu cho ${employee.name} (${employee.code})`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_auth.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js test/test_auth.js
git commit -m "feat(api): implement employee creation with code and admin reset password"
```

---

### Task 5: Scoped Timesheet Access Control in API Endpoints

**Files:**
- Modify: `server.js:622-742`
- Test: `test/test_auth.js`

**Interfaces:**
- Consumes: `requireAuth`, `req.user`
- Produces: Scoped `GET /api/entries`, scoped `POST /api/entries`, scoped `PUT /api/entries/:id`, `DELETE /api/entries/:id` (requireAdmin)

- [ ] **Step 1: Write failing test for scoped data access**

Append to `test/test_auth.js`:
```javascript
async function testScopedAccess() {
  console.log("▶ Testing Scoped Timesheet Access Enforcement...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const adminToken = app.generateAuthToken({ role: "admin" });
    const emp1Token = app.generateAuthToken({ role: "employee", id: "emp-1", code: "NV01", name: "User 1" });
    const emp2Token = app.generateAuthToken({ role: "employee", id: "emp-2", code: "NV02", name: "User 2" });

    // 1. Employee 1 creates an entry
    const createRes1 = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/entries",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emp1Token}`
      }
    }, { date: "2026-08-31", employeeId: "emp-1", in: "08:30", mode: "Onsite", note: "Làm việc task auth" });
    assert.strictEqual(createRes1.status, 200);
    const entry1Id = createRes1.body.id;

    // 2. Employee 1 tries to create an entry claiming to be Employee 2 (MUST BE REJECTED OR FORCED TO EMP-1)
    const spoofRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/entries",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emp1Token}`
      }
    }, { date: "2026-08-31", employeeId: "emp-2", in: "08:30", mode: "Onsite", note: "Spoofing" });
    assert.strictEqual(spoofRes.status, 403);

    // 3. Employee 2 queries entries -> Should NOT see Employee 1's entry
    const emp2EntriesRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: "/api/entries?month=2026-08",
      method: "GET",
      headers: { Authorization: `Bearer ${emp2Token}` }
    });
    assert.strictEqual(emp2EntriesRes.status, 200);
    assert.strictEqual(emp2EntriesRes.body.some(e => e.id === entry1Id), false);

    // 4. Employee 2 tries to update Employee 1's entry -> Must return 403 / 404
    const emp2UpdateRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/entries/${entry1Id}`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emp2Token}`
      }
    }, { out: "17:30" });
    assert.strictEqual(emp2UpdateRes.status, 403);

    // 5. Employee 1 tries to delete own entry -> Must be forbidden (Admin only)
    const emp1DeleteRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/entries/${entry1Id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${emp1Token}` }
    });
    assert.strictEqual(emp1DeleteRes.status, 403);

    // 6. Admin deletes entry -> Succeeded
    const adminDeleteRes = await makeRequest(server, {
      hostname: "127.0.0.1",
      port,
      path: `/api/entries/${entry1Id}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminDeleteRes.status, 200);

    console.log("✔ Scoped Timesheet Access passed!");
  } finally {
    server.close();
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Update `test/test_auth.js` main block to call `testScopedAccess()`.
Run: `node test/test_auth.js`
Expected: FAIL

- [ ] **Step 3: Implement scoped access control on `/api/entries` endpoints in `server.js`**

In `server.js`:
```javascript
// GET /api/entries
app.get("/api/entries", requireAuth, async (req, res) => {
  try {
    let { month, employeeId, startDate, endDate, mode } = req.query;
    // Enforce scoped employee filter if caller is an employee
    if (req.user.role === "employee") {
      employeeId = req.user.id;
    }
    const entries = await db.getEntries({ month, employeeId, startDate, endDate, mode });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entries
app.post("/api/entries", requireAuth, async (req, res) => {
  let { date, employeeId, in: timeIn, out, mode, note } = req.body;
  
  if (req.user.role === "employee") {
    if (employeeId && employeeId !== req.user.id) {
      return res.status(403).json({ error: "Bạn chỉ có thể chấm công cho chính mình!" });
    }
    employeeId = req.user.id;
  }

  const trimmedNote = (note || "").trim();
  if (!date || !employeeId || !mode || !trimmedNote) {
    return res.status(400).json({ error: "Thiếu ngày, nhân viên, hình thức hoặc ghi chú" });
  }

  try {
    const existingList = await db.getEntries({ date, employeeId });
    const existing = existingList.find((e) => e.date === date && e.employeeId === employeeId);
    if (existing) {
      const isCompleted = (existing.in && existing.out) || existing.mode === "Nghỉ" || existing.mode === "Off";
      if (isCompleted) {
        return res.status(400).json({ error: "Nhân viên này đã hoàn thành chấm công trong ngày hôm nay!" });
      }
      if (existing.in && !existing.out && (out || timeIn)) {
        const patch = {
          out: out || timeIn,
          mode: mode || existing.mode,
          note: trimmedNote || existing.note,
        };
        const updated = await db.updateEntry(existing.id, patch);

        (async () => {
          try {
            const employees = await db.getEmployees();
            const emp = employees.find((e) => e.id === updated.employeeId);
            const payload = buildSyncEntryPayload(updated, emp ? emp.name : "");
            sendGoogleSheetWebhook(payload);
          } catch (err) {
            console.error("Async real-time sync failed:", err.message);
          }
        })();

        return res.json(updated);
      }
      return res.status(400).json({ error: "Nhân viên này đã điểm danh vào rồi!" });
    }

    const entry = {
      id: crypto.randomUUID(),
      date,
      employeeId,
      in: timeIn || "",
      out: out || "",
      mode,
      note: trimmedNote,
    };
    const saved = await db.createEntry(entry);

    (async () => {
      try {
        const employees = await db.getEmployees();
        const emp = employees.find((e) => e.id === saved.employeeId);
        const payload = buildSyncEntryPayload(saved, emp ? emp.name : "");
        sendGoogleSheetWebhook(payload);
      } catch (err) {
        console.error("Async real-time sync failed:", err.message);
      }
    })();

    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/entries/:id
app.put("/api/entries/:id", requireAuth, async (req, res) => {
  const { in: timeIn, out, mode, note } = req.body;
  try {
    const existingList = await db.getEntries();
    const entryToUpdate = existingList.find((e) => e.id === req.params.id);
    if (!entryToUpdate) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi" });
    }

    if (req.user.role === "employee" && entryToUpdate.employeeId !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền sửa bản ghi của người khác" });
    }

    const patch = {};
    if (timeIn !== undefined) patch.in = timeIn;
    if (out !== undefined) patch.out = out;
    if (mode !== undefined) patch.mode = mode;
    if (note !== undefined) {
      const trimmed = (note || "").trim();
      if (trimmed) patch.note = trimmed;
    }

    const updated = await db.updateEntry(req.params.id, patch);

    (async () => {
      try {
        const employees = await db.getEmployees();
        const emp = employees.find((e) => e.id === updated.employeeId);
        const payload = buildSyncEntryPayload(updated, emp ? emp.name : "");
        sendGoogleSheetWebhook(payload);
      } catch (err) {
        console.error("Async real-time sync failed:", err.message);
      }
    })();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/entries/:id (requireAdmin)
app.delete("/api/entries/:id", requireAdmin, async (req, res) => {
  try {
    const result = await db.deleteEntry(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_auth.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js test/test_auth.js
git commit -m "feat(api): enforce scoped access control on timesheet entry endpoints"
```

---

### Task 6: Frontend State, API Client, and Localization Dictionaries

**Files:**
- Modify: `public/js/state.js`
- Modify: `public/js/api.js`
- Modify: `public/js/i18n.js`

**Interfaces:**
- Consumes: `localStorage.getItem("asol_auth_token")`, `t(key)`
- Produces: `state.currentUser`, `state.token`, `state.isAdmin`, `loginUser()`, `getMe()`, `changePassword()`, `resetEmployeePassword()`, `createEmployee(data)`

- [ ] **Step 1: Update `public/js/state.js`**

Update `public/js/state.js`:
```javascript
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
```

- [ ] **Step 2: Update `public/js/api.js`**

Update `public/js/api.js`:
- In `getAuthHeaders()`: use `state.token || localStorage.getItem("asol_auth_token") || localStorage.getItem("timesheet_admin_token")`.
- In `api()` fetch error handler: if `res.status === 401`, emit event or dispatch auth reset.
- Add/update API functions:
  ```javascript
  export async function loginUser(credentials) {
    return api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  export async function getMe() {
    return api("/api/auth/me");
  }

  export async function changePassword(currentPassword, newPassword) {
    return api("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  export async function createEmployee({ code, name, password }) {
    return api("/api/employees", {
      method: "POST",
      body: JSON.stringify({ code, name, password }),
    });
  }

  export async function resetEmployeePassword(id, newPassword = "") {
    return api(`/api/employees/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
  }
  ```

- [ ] **Step 3: Update `public/js/i18n.js` with new translations**

Add keys to `dictionaries.vi` and `dictionaries.en`:
- `loginGateTitle`: "Đăng nhập Hệ thống Chấm công" / "Timesheet System Login"
- `tabLoginEmployee`: "👤 Nhân viên" / "👤 Employee"
- `tabLoginAdmin`: "👑 Quản trị viên" / "👑 Administrator"
- `labelEmployeeCode`: "Mã nhân viên:" / "Employee Code:"
- `phEmployeeCode`: "Ví dụ: NV01" / "e.g. NV01"
- `labelEmployeePassword`: "Mật khẩu:" / "Password:"
- `phEmployeePassword`: "Nhập mật khẩu..." / "Enter password..."
- `btnLoginSubmit`: "Đăng nhập" / "Log In"
- `forgotPasswordLink`: "Quên mật khẩu?" / "Forgot password?"
- `forgotPasswordInfo`: "Vui lòng liên hệ Quản trị viên (Admin) của ASOL để được cấp lại mật khẩu." / "Please contact your ASOL Administrator to reset your password."
- `btnGeneratePassword`: "🎲 Tạo ngẫu nhiên" / "🎲 Generate Random"
- `btnResetPassword`: "Đặt lại MK" / "Reset PW"
- `colEmployeeCode`: "Mã NV" / "Code"
- `resetPasswordSuccess`: "Mật khẩu mới của {name} là: {pass}" / "New password for {name} is: {pass}"
- `errInvalidCodeOrPass`: "Mã nhân viên hoặc mật khẩu không chính xác!" / "Invalid employee code or password!"
- `errDuplicateCode`: "Mã nhân viên này đã tồn tại!" / "This employee code already exists!"

- [ ] **Step 4: Commit**

```bash
git add public/js/state.js public/js/api.js public/js/i18n.js
git commit -m "feat(client): update state, API client methods, and i18n dictionaries for auth"
```

---

### Task 7: Login Gate Modal & User Header Controls

**Files:**
- Create: `public/js/modals/loginGate.js`
- Modify: `public/js/modals/adminAuth.js`
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: `loginUser()`, `getMe()`, `setAuthState()`, `showToast()`, `t()`
- Produces: `initLoginGate(onLoginSuccess)`, `showLoginGate()`, `hideLoginGate()`, `updateTopbarUserUI()`

- [ ] **Step 1: Create `public/js/modals/loginGate.js`**

Implement `loginGate.js`:
- Manages `#loginGate` overlay visibility.
- Tab toggling between Employee login form (`#formEmployeeLogin`) and Admin login form (`#formAdminLoginGate`).
- "Quên mật khẩu?" click listener that opens alert dialog / toast with `t("forgotPasswordInfo")`.
- On Employee form submit: calls `loginUser({ role: 'employee', code, password })`, updates `setAuthState(res.token, res.user)`, calls `onLoginSuccess()`.
- On Admin form submit: calls `loginUser({ role: 'admin', password })`, updates `setAuthState(res.token, res.user)`, calls `onLoginSuccess()`.

- [ ] **Step 2: Update `public/js/modals/adminAuth.js` for Topbar & Change Password**

Update `adminAuth.js`:
- Export `updateTopbarUserUI()`:
  - If `state.currentUser`:
    - Display user banner: `state.isAdmin ? "👑 Admin" : `👤 [${state.currentUser.code}] ${state.currentUser.name}``.
    - Show `🔑 Đổi MK` button and `🚪 Đăng xuất` button.
    - If Admin: show `⚙️ Cài đặt` button and display Tab Nhân viên.
    - If Employee: hide `⚙️ Cài đặt` button and hide Tab Nhân viên.
  - If no user logged in: trigger `showLoginGate()`.
- Unify Change Password Form (`#formChangePassword`):
  - Calls `changePassword(currentPass, newPass)`.
  - Shows success toast and closes modal.
- On Logout button click: calls `setAuthState(null, null)`, shows toast, and opens `showLoginGate()`.

- [ ] **Step 3: Commit**

```bash
git add public/js/modals/loginGate.js public/js/modals/adminAuth.js
git commit -m "feat(ui): implement login gate controller and unified topbar user controls"
```

---

### Task 8: Scoped UI Logic in Main App & Feature Tabs

**Files:**
- Modify: `public/js/tabs/chamCong.js`
- Modify: `public/js/tabs/locChamCong.js`
- Modify: `public/js/tabs/tongHop.js`
- Modify: `public/js/tabs/nhanVien.js`
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: `state.currentUser`, `state.isAdmin`, `fetchEmployees()`, `fetchEntries()`
- Produces: Scoped dropdown selections, locked employee inputs, Admin Employee list with Code & Reset PW controls.

- [ ] **Step 1: Update `public/js/tabs/chamCong.js`**

- In `renderEmployeeSelect()`:
  - If `!state.isAdmin && state.currentUser`:
    - Filter dropdown options to only include `state.currentUser`.
    - Set dropdown value to `state.currentUser.id` and set `selectEmployee.disabled = true`.
  - If `state.isAdmin`: keep full list of employees selectable.
- In `renderDayEntries()`:
  - For non-admin, ensure each row displays status for current employee only.

- [ ] **Step 2: Update `public/js/tabs/locChamCong.js`**

- In `renderFilterEmployeeSelect()`:
  - If `!state.isAdmin && state.currentUser`:
    - Auto-select `state.currentUser.id` and disable the dropdown filter.
  - If `state.isAdmin`: allow selecting "Tất cả" or any individual employee.

- [ ] **Step 3: Update `public/js/tabs/tongHop.js`**

- In `renderSummary()`:
  - If `!state.isAdmin && state.currentUser`:
    - Render KPI cards and table only for `state.currentUser.id`.
    - Hide batch sync Google Sheets button (`#btnSyncGoogleSheet`).
  - If `state.isAdmin`:
    - Render full matrix table for all employees.
    - Show batch sync Google Sheets button.

- [ ] **Step 4: Update `public/js/tabs/nhanVien.js`**

- In `renderEmployeeList()`:
  - Columns: `Mã NV` | `Họ và Tên` | `Thao tác`.
  - Actions per employee:
    - Button `🔑 Đặt lại MK`: calls `resetEmployeePassword(emp.id)`, displays modal or toast with the newly generated password (`t("resetPasswordSuccess", { name, pass })`).
    - Button `🗑️ Xóa`: existing delete action with confirm dialog.
- In Employee Add Form:
  - Inputs: `Mã nhân viên` (`#inputEmpCode`), `Họ và tên` (`#inputEmpName`), `Mật khẩu ban đầu` (`#inputEmpPass`).
  - Button `🎲 Tạo ngẫu nhiên`: fills `#inputEmpPass` with a random 8-character string (e.g. `NV` + 6 digits).
  - On form submit: calls `createEmployee({ code, name, password })`.

- [ ] **Step 5: Update `public/js/main.js` boot flow**

- On app initialization:
  - Check `state.token`: call `getMe()`.
  - If valid user: set `state.currentUser = res.user`, load employees & entries, render UI tabs.
  - If invalid or no token: call `showLoginGate()`.

- [ ] **Step 6: Commit**

```bash
git add public/js/tabs/chamCong.js public/js/tabs/locChamCong.js public/js/tabs/tongHop.js public/js/tabs/nhanVien.js public/js/main.js
git commit -m "feat(ui): implement scoped views in tabs and admin employee code/reset management"
```

---

### Task 9: HTML Structure & CSS Styling for Login Gate & Scoped Elements

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`

**Interfaces:**
- Consumes: Existing Vintage Ledger CSS design tokens
- Produces: `#loginGate` markup, `#userControls` header, updated `#tab-nhan-vien` markup, styles for login gate, code badges, and locked selects.

- [ ] **Step 1: Update `public/index.html`**

1. Add `#loginGate` overlay container before `</body>`:
```html
<div id="loginGate" class="login-gate-overlay" style="display:none;">
  <div class="login-gate-card">
    <div class="login-gate-header">
      <img src="assets/Logo_Full.png" alt="Logo" class="login-logo" />
      <h2 data-i18n="loginGateTitle">Đăng nhập Hệ thống Chấm công</h2>
      <p class="login-subtitle">ALPACA SOLUTIONS (ASOL)</p>
    </div>
    
    <div class="login-gate-tabs">
      <button type="button" class="gate-tab-btn active" id="btnGateTabEmployee" data-i18n="tabLoginEmployee">👤 Nhân viên</button>
      <button type="button" class="gate-tab-btn" id="btnGateTabAdmin" data-i18n="tabLoginAdmin">👑 Quản trị viên</button>
    </div>

    <!-- Employee Login Form -->
    <form id="formEmployeeLogin" class="gate-form active">
      <div class="form-group">
        <label for="empLoginCode" data-i18n="labelEmployeeCode">Mã nhân viên:</label>
        <input type="text" id="empLoginCode" placeholder="Ví dụ: NV01" data-i18n-ph="phEmployeeCode" required autocomplete="username" />
      </div>
      <div class="form-group">
        <label for="empLoginPassword" data-i18n="labelEmployeePassword">Mật khẩu:</label>
        <input type="password" id="empLoginPassword" placeholder="Nhập mật khẩu..." data-i18n-ph="phEmployeePassword" required autocomplete="current-password" />
      </div>
      <div class="gate-form-footer">
        <a href="#" id="linkForgotPassword" class="forgot-pass-link" data-i18n="forgotPasswordLink">Quên mật khẩu?</a>
      </div>
      <button type="submit" id="btnSubmitEmpLogin" class="btn-primary btn-block" data-i18n="btnLoginSubmit">Đăng nhập</button>
    </form>

    <!-- Admin Login Form -->
    <form id="formAdminLoginGate" class="gate-form">
      <div class="form-group">
        <label for="adminGatePassword" data-i18n="adminLoginPasswordLabel">Mật khẩu quản trị:</label>
        <input type="password" id="adminGatePassword" placeholder="Nhập mật khẩu Admin..." data-i18n-ph="adminLoginPasswordPh" required autocomplete="current-password" />
      </div>
      <button type="submit" id="btnSubmitAdminGateLogin" class="btn-primary btn-block" data-i18n="btnLoginSubmit">Đăng nhập</button>
    </form>
  </div>
</div>
```

2. Update topbar header in `public/index.html`:
```html
<div id="userControls" class="user-controls">
  <span id="userBadge" class="badge-user"></span>
  <button type="button" id="btnOpenSettingsModal" class="btn-sub btn-sm admin-only" data-i18n="settingsModalTitle" title="Cài đặt">⚙️ Cài đặt</button>
  <button type="button" id="btnOpenChangePassModal" class="btn-sub btn-sm" data-i18n="btnChangePass">🔑 Đổi MK</button>
  <button type="button" id="btnLogoutUser" class="btn-sub btn-sm" data-i18n="btnLogout">🚪 Đăng xuất</button>
</div>
```

3. Update Employee Management Tab `#tab-nhan-vien` in `public/index.html`:
Add `#inputEmpCode`, `#inputEmpPass`, and `#btnRandomEmpPass` to the Add Employee form.

- [ ] **Step 2: Update `public/styles.css`**

Add CSS rules:
- `.login-gate-overlay`: Fullscreen fixed flex center backdrop with blur.
- `.login-gate-card`: Vintage ledger paper card with border and shadow.
- `.gate-tab-btn`: Tab switchers for Employee vs Admin login.
- `.badge-user`: Space Grotesk badge for displaying employee code & name.
- `.badge-code`: Mono badge for employee code in tables.
- `.admin-only`: Hidden by default when `body:not(.is-admin) .admin-only { display: none !important; }`.

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/styles.css
git commit -m "feat(ui): add markup and vintage ledger styles for login gate and user controls"
```

---

### Task 10: Comprehensive Test Suite & Final Verification

**Files:**
- Modify: `test/test_api.js`
- Modify: `package.json`
- Test: `test/test_auth.js`
- Test: `test/test_api.js`
- Test: `test/test_e2e_calc.js`
- Test: `test/test_sync.js`

**Interfaces:**
- Consumes: All tests across auth, entries, calculations, and sync
- Produces: Complete passing test run on `npm test`

- [ ] **Step 1: Update existing `test/test_api.js` with admin/employee auth headers**

Ensure `test/test_api.js` injects valid bearer tokens for endpoints now requiring auth.

- [ ] **Step 2: Update `package.json` test script**

In `package.json`:
```json
"scripts": {
  "start": "node server.js",
  "test": "node test/test_auth.js && node test/test_api.js && node test/test_e2e_calc.js && node test/test_sync.js"
}
```

- [ ] **Step 3: Run full test suite to verify all tests pass**

Run: `npm test`
Expected: ALL test suites pass with 0 exit code.

- [ ] **Step 4: Commit**

```bash
git add test/test_api.js package.json
git commit -m "test: update test suite for employee authentication and scoped access"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-employee-auth-timesheet.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like to proceed with?
