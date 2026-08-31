# Employee Authentication & Scoped Timesheet Access Design Specification

- **Date:** 2026-08-31
- **Status:** Approved / Spec
- **Target Repository:** `timesheet-app` (ASOL)

---

## 1. Overview & Business Goals

The **Employee Authentication & Scoped Timesheet Access** system establishes mandatory user login for all employees (interns) and administrators. Each employee is assigned a unique **Employee Code** (e.g., `NV01`, `ASOL01`) and a secure password created by an Admin.

### Key Objectives:
1. **Mandatory Login Gate:** All unauthenticated users are presented with a full-screen Login Gate before accessing any timesheet functions.
2. **Distinct Login Experiences:** Clear toggle between **👤 Nhân viên (Employee)** (Mã nhân viên + Mật khẩu) and **👑 Quản trị viên (Admin)** (Mật khẩu Admin).
3. **Data Privacy & Scoped Access:** Logged-in employees can strictly view, check in, filter, and summarize only their own attendance data. They cannot view or modify timesheets belonging to other employees.
4. **Self-Service Password Change:** Employees can change their personal password at any time via a "Đổi MK" (Change Password) action in the topbar.
5. **Forgot Password & Admin Password Reset:** A "Quên mật khẩu?" link on the login form prompts the employee to contact the Admin. Admins have dedicated UI controls in the Employee Management tab to reset or auto-generate a new password for any employee.
6. **Automatic Backward Compatibility & Migration:** Existing employee records without credentials automatically receive an auto-assigned Employee Code (`NV01`, `NV02`, etc.) and a default initial password (`<Code>123456`) during migration without breaking legacy data.

---

## 2. Architecture & Data Flow

```
                           ┌──────────────────────────────────────────────┐
                           │            MÀN HÌNH ĐĂNG NHẬP (GATE)          │
                           │   [👤 Nhân viên (Code + PW)] | [👑 Admin]   │
                           └──────────────────────┬───────────────────────┘
                                                  │
                       ┌──────────────────────────┴──────────────────────────┐
                       ▼                                                     ▼
           [ Nhân viên Đăng Nhập ]                                [ Admin Đăng Nhập ]
       HMAC Token: { role: 'employee',                       HMAC Token: { role: 'admin' }
                     id, code, name }                                        │
                       │                                                     │
        ┌──────────────┴──────────────┐                                      ▼
        ▼                             ▼                          [ Toàn Quyền Quản Trị ]
  [ Tab Chấm Công ]           [ Tab Lọc & Tổng Hợp ]             - Quản lý tất cả nhân viên
- Khóa cứng tên chính mình    - Chỉ xem/lọc dữ liệu của mình     - Tạo NV (Code + Password)
- Nút "Đổi MK" cá nhân        - Không truy cập được người khác   - Đặt lại MK nhân viên (Reset)
                              - Ẩn Tab Nhân viên & Cài đặt       - Xem toàn bộ bảng chấm công
                                                                 - Cấu hình Google Sheet Sync
```

---

## 3. Detailed Specifications

### 3.1. Data Model & Storage (`employees` & `entries`)

#### Extended Employee Schema
In both Supabase PostgreSQL (`public.employees`) and Local JSON (`data/db.json`):
- `id`: String (UUID, primary key).
- `code`: String (Unique employee identifier, e.g. `NV01`, `NV02`).
- `name`: String (Employee display name).
- `password_hash`: String (Hex string produced by `crypto.scryptSync(password, salt, 64)`).
- `salt`: String (Hex string of 16 random bytes).
- `created_at`: Timestamp string (ISO 8601).

#### Auto-Migration for Existing Records
On server initialization / database load:
- Any employee record missing `code` is assigned `NV01`, `NV02`, etc.
- Any employee record missing `password_hash` receives an auto-hashed default password equal to `${code}123456` (e.g. `NV01123456`).

---

### 3.2. Authentication & Token Model

HMAC-SHA256 session tokens are signed with `ADMIN_JWT_SECRET` containing payload:
- **Employee Session:**
  ```json
  {
    "role": "employee",
    "id": "uuid-emp-1",
    "code": "NV01",
    "name": "Nguyễn Văn A",
    "exp": 1756700000000
  }
  ```
- **Admin Session:**
  ```json
  {
    "role": "admin",
    "exp": 1756700000000
  }
  ```

#### Middleware
- `requireAuth`: Verifies token validity; attaches `req.user` (`{ role, id, code, name }`). Returns HTTP 401 if missing or expired.
- `requireAdmin`: Verifies token and ensures `req.user.role === 'admin'`. Returns HTTP 403 / 401 if not authorized.

---

### 3.3. Backend API Endpoints

#### 1. `POST /api/auth/login`
- **Body:** 
  - Employee: `{ role: "employee", code: "NV01", password: "..." }`
  - Admin: `{ role: "admin", password: "..." }`
- **Response (200):**
  ```json
  {
    "token": "payloadBase64.signatureHex",
    "user": {
      "role": "employee",
      "id": "uuid-emp-1",
      "code": "NV01",
      "name": "Nguyễn Văn A"
    }
  }
  ```
- **Error (400 / 401):** `{ error: "Mã nhân viên hoặc mật khẩu không chính xác" }`

#### 2. `GET /api/auth/me`
- **Auth:** `requireAuth`
- **Response (200):** `{ user: { role, id, code, name } }`

#### 3. `POST /api/auth/change-password`
- **Auth:** `requireAuth`
- **Body:** `{ currentPassword: "...", newPassword: "..." }`
- **Behavior:**
  - If `user.role === 'admin'`: validates current admin password and updates it.
  - If `user.role === 'employee'`: validates current employee password and updates employee's hash & salt.
- **Response (200):** `{ success: true, message: "Đổi mật khẩu thành công!" }`

#### 4. `POST /api/employees` (Admin Only)
- **Auth:** `requireAdmin`
- **Body:** `{ code: "NV03", name: "Trần Thị C", password?: "..." }`
- **Behavior:**
  - Checks if `code` is unique (case-insensitive).
  - If `password` is provided, hashes it; if empty, generates `<code + 6 random digits>` (e.g. `NV03849201`) and hashes it.
- **Response (200):** `{ employee: { id, code, name }, generatedPassword?: "NV03849201" }`

#### 5. `POST /api/employees/:id/reset-password` (Admin Only)
- **Auth:** `requireAdmin`
- **Body:** `{ newPassword?: "..." }`
- **Behavior:**
  - If `newPassword` is supplied, sets it.
  - If empty, auto-generates `<code + 6 random digits>`.
- **Response (200):** `{ success: true, employeeId, generatedPassword: "..." }`

#### 6. Scoped Data Access Enforcement
- `GET /api/entries`:
  - If `req.user.role === 'employee'`: Forces `employeeId = req.user.id`.
  - If `req.user.role === 'admin'`: Allows arbitrary filtering.
- `POST /api/entries`:
  - If `req.user.role === 'employee'`: Forces `employeeId = req.user.id`. Reject if client passes different `employeeId`.
- `PUT /api/entries/:id`:
  - If `req.user.role === 'employee'`: Rejects if entry does not belong to `req.user.id`.
- `DELETE /api/entries/:id`:
  - Restricted to Admin (`requireAdmin`).

---

### 3.4. Frontend User Interface Architecture

#### 1. Login Gate Overlay (`#loginGate`)
- Placed over the entire application before login.
- Sub-tabs: **👤 Nhân viên (Employee)** vs **👑 Quản trị viên (Admin)**.
- Fields for Employee: *Mã nhân viên (Code)* + *Mật khẩu*.
- "Quên mật khẩu?" link: Triggers alert modal: *"Vui lòng liên hệ Quản trị viên (Admin) của ASOL để được cấp lại mật khẩu."*

#### 2. Topbar Header & Role Banners
- When Employee is logged in:
  - Shows: `👤 [Mã NV] Tên nhân viên` + Button `🔑 Đổi MK` + Button `🚪 Đăng xuất`.
  - Hides: Settings gear ⚙️, Tab Nhân viên.
- When Admin is logged in:
  - Shows: `👑 Admin` + Button `⚙️ Cài đặt` + Button `🔑 Đổi MK` + Button `🚪 Đăng xuất`.
  - Displays: Tab Nhân viên, Full employee list, Admin sync actions.

#### 3. Tab Views Adaptation
- **Tab Chấm công:** Employee dropdown is auto-selected to the current employee and disabled/read-only for employees.
- **Tab Lọc chấm công:** Employee filter dropdown is locked to the logged-in employee for non-admins.
- **Tab Tổng hợp:** Shows KPI summary table for the logged-in employee only.
- **Tab Nhân viên (Admin Only):**
  - Table columns: `Mã NV` | `Họ và Tên` | `Thao tác (🔑 Đặt lại MK | 🗑️ Xóa)`.
  - Add Employee Form: Inputs for `Mã nhân viên`, `Họ và tên`, `Mật khẩu ban đầu` (with button `🎲 Sinh mật khẩu ngẫu nhiên`).

---

### 3.5. Internationalization (i18n)

Dictionary keys added to `vi` and `en` in `public/js/i18n.js`:
- `loginGateTitle`: "Đăng nhập Hệ thống Chấm công" / "Timesheet System Login"
- `tabLoginEmployee`: "Nhân viên" / "Employee"
- `tabLoginAdmin`: "Quản trị viên" / "Administrator"
- `labelEmployeeCode`: "Mã nhân viên:" / "Employee Code:"
- `phEmployeeCode`: "Ví dụ: NV01" / "e.g. NV01"
- `forgotPasswordLink`: "Quên mật khẩu?" / "Forgot password?"
- `forgotPasswordInfo`: "Vui lòng liên hệ Quản trị viên (Admin) của ASOL để được cấp lại mật khẩu." / "Please contact your ASOL Administrator to reset your password."
- `btnGeneratePassword`: "🎲 Tạo ngẫu nhiên" / "🎲 Generate Random"
- `btnResetPassword`: "Đặt lại MK" / "Reset PW"
- `resetPasswordSuccess`: "Mật khẩu mới của nhân viên là: {pass}" / "New employee password is: {pass}"
- `errInvalidCodeOrPass`: "Mã nhân viên hoặc mật khẩu không chính xác!" / "Invalid employee code or password!"
- `errDuplicateCode`: "Mã nhân viên này đã tồn tại!" / "This employee code already exists!"

---

## 4. Error Handling & Edge Cases

| Scenario | Handling Strategy |
|---|---|
| Employee enters incorrect code or password | Returns HTTP 401 with standard friendly toast "Mã nhân viên hoặc mật khẩu không chính xác". |
| Employee attempts to query/edit another employee's entry | Backend forces `employeeId = req.user.id` or returns 403 Forbidden. |
| Admin creates employee with existing code | Backend rejects with HTTP 400 "Mã nhân viên đã tồn tại". |
| Existing legacy database without codes/passwords | On boot, DB migration auto-assigns `NV01`, `NV02`... and hashes default passwords `${code}123456`. |
| Token expires while user is using app | API client intercepts HTTP 401, clears stored token, and displays the Login Gate. |

---

## 5. Verification & Testing Plan

1. **Automated Unit & API Testing (`test/test_auth.js`):**
   - Employee password hashing and Scrypt verification.
   - Employee login token creation, HMAC verification, and payload decode.
   - Admin employee creation with custom vs auto-generated password.
   - Admin reset password endpoint.
   - Scoped data access test: verify an employee token cannot read or mutate other employees' records.
   - Auto-migration test: verify legacy employee array gets codes and password hashes.
2. **E2E UI Verification:**
   - Open app $\rightarrow$ verify Login Gate blocks app.
   - Login as Employee $\rightarrow$ verify dropdowns and tables only show logged-in employee.
   - Perform check-in and verify entry is recorded and synced.
   - Change employee password $\rightarrow$ logout $\rightarrow$ login with new password.
   - Test "Quên mật khẩu?" popup.
   - Login as Admin $\rightarrow$ create new employee $\rightarrow$ reset password $\rightarrow$ verify Admin full view.
