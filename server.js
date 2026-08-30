require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "db.json");
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "asol-timesheet-admin-secret-2026";

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

// ---------- Password Hashing & Token Helpers ----------
function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  try {
    if (!password || !storedHash || !salt) return false;
    const calcHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(calcHash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

function generateAdminToken() {
  const payload = {
    role: "admin",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 ngày
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payloadB64, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    return payload.exp > Date.now() && payload.role === "admin";
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yêu cầu quyền quản trị viên (Admin)" });
  }
  const token = authHeader.split(" ")[1];
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: "Phiên làm việc của Admin đã hết hạn hoặc không hợp lệ" });
  }
  next();
}

// ---------- Local JSON DB Helpers ----------
function loadLocalDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      employees: data.employees || [],
      entries: data.entries || [],
      settings: data.settings || {},
    };
  } catch {
    return { employees: [], entries: [], settings: {} };
  }
}

function saveLocalDB(dbData) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
}

// ---------- Database Abstraction Layer ----------
const db = {
  async getSetting(key) {
    if (isSupabase) {
      const { data, error } = await supabase.from("system_settings").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    }
    const local = loadLocalDB();
    return local.settings && local.settings[key] ? local.settings[key] : null;
  },

  async setSetting(key, value) {
    if (isSupabase) {
      const { data, error } = await supabase
        .from("system_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data ? data.value : value;
    }
    const local = loadLocalDB();
    if (!local.settings) local.settings = {};
    local.settings[key] = value;
    saveLocalDB(local);
    return value;
  },

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

  async getEntries(filters = {}) {
    const { month, employeeId, startDate, endDate, mode } =
      typeof filters === "string" ? { month: filters } : filters;

    if (isSupabase) {
      let query = supabase.from("entries").select("*").order("date", { ascending: false });
      if (month) query = query.like("date", `${month}%`);
      if (employeeId) query = query.eq("employee_id", employeeId);
      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);
      if (mode) query = query.eq("mode", mode);

      const { data, error } = await query;
      if (error) throw error;
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
    if (employeeId) entries = entries.filter((e) => e.employeeId === employeeId);
    if (startDate) entries = entries.filter((e) => e.date >= startDate);
    if (endDate) entries = entries.filter((e) => e.date <= endDate);
    if (mode) entries = entries.filter((e) => e.mode === mode);
    return entries.sort((a, b) => b.date.localeCompare(a.date));
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

// ---------- Admin Authentication Endpoints ----------
app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Vui lòng nhập mật khẩu quản trị" });
    }
    let authSetting = await db.getSetting("admin_auth");
    if (!authSetting || !authSetting.hash) {
      const { hash, salt } = hashPassword("admin123");
      authSetting = { hash, salt, updated_at: new Date().toISOString() };
      await db.setSetting("admin_auth", authSetting);
    }
    const isValid = verifyPassword(password, authSetting.hash, authSetting.salt);
    if (!isValid) {
      return res.status(401).json({ error: "Mật khẩu quản trị không chính xác" });
    }
    const token = generateAdminToken();
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/status", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({ isAdmin: false });
  }
  const token = authHeader.split(" ")[1];
  res.json({ isAdmin: verifyAdminToken(token) });
});

app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }
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
    res.json({ ok: true, message: "Đổi mật khẩu Admin thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Employees Endpoints ----------
app.get("/api/employees", async (req, res) => {
  try {
    const list = await db.getEmployees();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees", requireAdmin, async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Tên không được để trống" });
  try {
    const emp = await db.createEmployee(name);
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/:id", requireAdmin, async (req, res) => {
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
    const { month, employeeId, startDate, endDate, mode } = req.query;
    const entries = await db.getEntries({ month, employeeId, startDate, endDate, mode });
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

app.delete("/api/entries/:id", requireAdmin, async (req, res) => {
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

module.exports = {
  app,
  db,
  hashPassword,
  verifyPassword,
  generateAdminToken,
  verifyAdminToken,
  requireAdmin,
};
