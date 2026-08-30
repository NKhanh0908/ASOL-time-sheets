# Supabase, Vercel & GitHub Actions Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp cơ sở dữ liệu Supabase (PostgreSQL Cloud) với cơ chế fallback local JSON tự động, cấu hình Vercel Serverless deployment, và thiết lập GitHub Actions Workflow tự động chạy CI/CD test khi push code.

**Architecture:** Tạo tầng Database Adapter trong `server.js` tự động phát hiện biến môi trường `SUPABASE_URL` & `SUPABASE_KEY` để đọc/ghi qua `@supabase/supabase-js` hoặc chuyển về `data/db.json` khi chạy local. Cấu hình `vercel.json` định tuyến serverless function và `.github/workflows/ci.yml` để kiểm thử tự động.

**Tech Stack:** Node.js, Express, `@supabase/supabase-js`, `dotenv`, Vercel Serverless, GitHub Actions.

**Spec:** Bounded Design: Tích Hợp Supabase, Vercel & GitHub Actions Workflow.

## Global Constraints

- Không làm vỡ khả năng chạy offline: Khi chưa cấu hình biến môi trường Supabase, app vẫn chạy bình thường với `data/db.json`.
- Cấu hình Vercel và GitHub Actions theo chuẩn mới nhất.
- Đảm bảo tương thích hoàn toàn giữa tên cột SQL (`employee_id`, `time_in`, `time_out`) và JSON API (`employeeId`, `in`, `out`).

---

### Task 1: Cài đặt Dependency, Tạo SQL Schema (`schema.sql`) & Mẫu Môi trường (`.env.example`)

**Files:**
- Modify: `package.json`
- Create: `schema.sql`
- Create: `.env.example`

**Interfaces:**
- Produces:
  - Database table `employees` và `entries` trên PostgreSQL
  - Environment variables `SUPABASE_URL`, `SUPABASE_KEY`

- [x] **Step 1: Cập nhật `package.json` với `@supabase/supabase-js` và `dotenv`**

Sửa `package.json`:
```json
{
  "name": "timesheet-app",
  "version": "1.0.0",
  "private": true,
  "description": "Bang cham cong noi bo - gon nhe, khong can database ngoai hoac dung Supabase",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node test/test_api.js && node test/test_e2e_calc.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  }
}
```

- [x] **Step 2: Chạy `npm install` để cài đặt dependencies**

Run: `npm install`
Expected: Cài đặt thành công không lỗi.

- [x] **Step 3: Tạo file `schema.sql` để chạy trên Supabase SQL Editor**

Tạo file `schema.sql`:
```sql
-- ============================================================
-- SQL Schema cho Bảng Chấm Công (Timesheet App) trên Supabase
-- Copy toàn bộ nội dung file này dán vào Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Bảng Nhân viên (employees)
create table if not exists public.employees (
  id text primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Bảng Chấm công (entries)
create table if not exists public.entries (
  id text primary key,
  date text not null,               -- Định dạng 'YYYY-MM-DD'
  employee_id text not null references public.employees(id) on delete cascade,
  time_in text default '',           -- Định dạng 'HH:mm'
  time_out text default '',          -- Định dạng 'HH:mm'
  mode text not null default 'Onsite', -- 'Onsite', 'Remote', 'Nghỉ'
  note text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tạo index để truy vấn theo tháng nhanh chóng
create index if not exists idx_entries_date on public.entries(date);
create index if not exists idx_entries_employee_id on public.entries(employee_id);

-- 4. Bật Row Level Security (RLS) và cho phép đọc/ghi công khai cho ứng dụng nội bộ
alter table public.employees enable row level security;
alter table public.entries enable row level security;

create policy "Allow all access to employees" on public.employees for all using (true) with check (true);
create policy "Allow all access to entries" on public.entries for all using (true) with check (true);
```

- [x] **Step 4: Tạo file `.env.example`**

Tạo file `.env.example`:
```env
# Cổng chạy local (mặc định 3000)
PORT=3000

# Cấu hình Supabase (Lấy từ Supabase Dashboard -> Project Settings -> API)
# Nếu để trống, app sẽ tự động lưu vào file data/db.json trên máy
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-key
```

- [x] **Step 5: Commit Task 1**

```bash
git add package.json package-lock.json schema.sql .env.example
git commit -m "feat: add supabase dependencies, schema.sql and .env.example"
```

---

### Task 2: Cập nhật Database Adapter Hỗ trợ Supabase & Local JSON trong `server.js`

**Files:**
- Modify: `server.js`
- Modify: `test/test_api.js`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_KEY` from `process.env` (qua `dotenv/config`)
- Produces: Unified async database operations for `getEmployees()`, `createEmployee(name)`, `deleteEmployee(id)`, `getEntries(month)`, `createEntry(entry)`, `updateEntry(id, patch)`, `deleteEntry(id)`.

- [x] **Step 1: Cập nhật `server.js` với Adapter hỗ trợ cả Supabase & Local JSON**

Sửa `server.js`:
```javascript
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "db.json");

// Khởi tạo Supabase client nếu có biến môi trường
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
const supabase = isSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (isSupabase) {
  console.log("⚡ Kết nối Database: Supabase Cloud (PostgreSQL)");
} else {
  console.log("📁 Kết nối Database: Local file (data/db.json)");
}

// ---------- Local JSON DB Helpers ----------
function loadLocalDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { employees: [], entries: [] };
  }
}

function saveLocalDB(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// ---------- Database Abstraction Layer ----------
const db = {
  async getEmployees() {
    if (isSupabase) {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data || [];
    }
    return loadLocalDB().employees;
  },

  async createEmployee(name) {
    const id = crypto.randomUUID();
    if (isSupabase) {
      const { data, error } = await supabase.from("employees").insert([{ id, name }]).select().single();
      if (error) throw error;
      return data;
    }
    const local = loadLocalDB();
    const emp = { id, name };
    local.employees.push(emp);
    saveLocalDB(local);
    return emp;
  },

  async deleteEmployee(id) {
    if (isSupabase) {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
      return { ok: true };
    }
    const local = loadLocalDB();
    local.employees = local.employees.filter((e) => e.id !== id);
    local.entries = local.entries.filter((e) => e.employeeId !== id);
    saveLocalDB(local);
    return { ok: true };
  },

  async getEntries(month) {
    if (isSupabase) {
      let query = supabase.from("entries").select("*").order("date", { ascending: false });
      if (month) {
        query = query.like("date", `${month}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      // Map cột snake_case về camelCase
      return (data || []).map((e) => ({
        id: e.id,
        date: e.date,
        employeeId: e.employee_id,
        in: e.time_in || "",
        out: e.time_out || "",
        mode: e.mode,
        note: e.note || "",
      }));
    }
    let entries = loadLocalDB().entries;
    if (month) entries = entries.filter((e) => e.date.startsWith(month));
    return entries;
  },

  async createEntry(entry) {
    if (isSupabase) {
      const { data, error } = await supabase
        .from("entries")
        .insert([
          {
            id: entry.id,
            date: entry.date,
            employee_id: entry.employeeId,
            time_in: entry.in || "",
            time_out: entry.out || "",
            mode: entry.mode,
            note: entry.note || "",
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return {
        id: data.id,
        date: data.date,
        employeeId: data.employee_id,
        in: data.time_in,
        out: data.time_out,
        mode: data.mode,
        note: data.note,
      };
    }
    const local = loadLocalDB();
    local.entries.push(entry);
    saveLocalDB(local);
    return entry;
  },

  async updateEntry(id, patch) {
    if (isSupabase) {
      const updateData = {};
      if (patch.in !== undefined) updateData.time_in = patch.in;
      if (patch.out !== undefined) updateData.time_out = patch.out;
      if (patch.mode !== undefined) updateData.mode = patch.mode;
      if (patch.note !== undefined) updateData.note = patch.note;

      const { data, error } = await supabase.from("entries").update(updateData).eq("id", id).select().single();
      if (error) throw error;
      return {
        id: data.id,
        date: data.date,
        employeeId: data.employee_id,
        in: data.time_in,
        out: data.time_out,
        mode: data.mode,
        note: data.note,
      };
    }
    const local = loadLocalDB();
    const idx = local.entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    if (patch.in !== undefined) local.entries[idx].in = patch.in;
    if (patch.out !== undefined) local.entries[idx].out = patch.out;
    if (patch.mode !== undefined) local.entries[idx].mode = patch.mode;
    if (patch.note !== undefined) local.entries[idx].note = patch.note;
    saveLocalDB(local);
    return local.entries[idx];
  },

  async deleteEntry(id) {
    if (isSupabase) {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
      return { ok: true };
    }
    const local = loadLocalDB();
    local.entries = local.entries.filter((e) => e.id !== id);
    saveLocalDB(local);
    return { ok: true };
  },
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Employees Endpoints ----------
app.get("/api/employees", async (req, res) => {
  try {
    const list = await db.getEmployees();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Tên không được để trống" });
  try {
    const emp = await db.createEmployee(name);
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  try {
    const result = await db.deleteEmployee(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Entries Endpoints ----------
app.get("/api/entries", async (req, res) => {
  try {
    const { month } = req.query; // "YYYY-MM"
    const entries = await db.getEntries(month);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/entries", async (req, res) => {
  const { date, employeeId, in: timeIn, out, mode, note } = req.body;
  const trimmedNote = (note || "").trim();
  if (!date || !employeeId || !mode || !trimmedNote) {
    return res.status(400).json({ error: "Thiếu ngày, nhân viên, hình thức hoặc ghi chú" });
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
  try {
    const saved = await db.createEntry(entry);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/entries/:id", async (req, res) => {
  const { in: timeIn, out, mode, note } = req.body;
  const patch = {};
  if (timeIn !== undefined) patch.in = timeIn;
  if (out !== undefined) patch.out = out;
  if (mode !== undefined) patch.mode = mode;
  if (note !== undefined) {
    const trimmed = (note || "").trim();
    if (trimmed) patch.note = trimmed;
  }
  try {
    const updated = await db.updateEntry(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: "Không tìm thấy bản ghi" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/entries/:id", async (req, res) => {
  try {
    const result = await db.deleteEntry(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xuất app cho Vercel Serverless Function và chạy local nếu trực tiếp
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Timesheet app đang chạy tại http://localhost:${PORT}`);
  });
}

module.exports = app;
```

- [x] **Step 2: Kiểm tra cú pháp và chạy test suite**

Run: `node -c server.js && node test/test_api.js && node test/test_e2e_calc.js`
Expected: Cú pháp hợp lệ, toàn bộ test passed.

- [x] **Step 3: Commit Task 2**

```bash
git add server.js
git commit -m "feat: implement dual-mode database adapter for supabase and local json"
```

---

### Task 3: Tạo Cấu hình Vercel Serverless (`vercel.json`)

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Produces: Vercel routes configuration to route `/api/*` to `server.js` and serve static files from `public/`.

- [x] **Step 1: Tạo file `vercel.json`**

Tạo file `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.js"
    },
    {
      "src": "/(.*)",
      "dest": "public/$1"
    }
  ]
}
```

- [x] **Step 2: Commit Task 3**

```bash
git add vercel.json
git commit -m "feat: add vercel.json for serverless deployment"
```

---

### Task 4: Tạo GitHub Actions Workflow (`.github/workflows/ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: Automated GitHub Actions CI workflow running unit tests on every push and pull request.

- [x] **Step 1: Tạo file `.github/workflows/ci.yml`**

Tạo file `.github/workflows/ci.yml`:
```yaml
name: Timesheet App CI

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm install

    - name: Check syntax
      run: node -c server.js public/app.js

    - name: Run unit & calculation tests
      run: npm test
```

- [ ] **Step 2: Commit Task 4**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add github actions workflow for automated testing"
```

---

### Task 5: Cập nhật Tài liệu `README.md` Hướng Dẫn Deploy Supabase & Vercel

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Cập nhật `README.md`**

Bổ sung phần hướng dẫn thiết lập Supabase & Vercel trong [README.md](file:///D:/Working/ASOL/tool/timesheet-app/README.md).

- [ ] **Step 2: Chạy kiểm thử toàn bộ dự án (`npm test`)**

Run: `npm test`
Expected: `All backend tests passed!` và `All calculation tests passed successfully!`

- [ ] **Step 3: Commit Task 5**

```bash
git add README.md
git commit -m "docs: add guide for supabase setup and vercel deployment"
```
