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

// ---------- Employee Migration Helper ----------
function migrateEmployeeList(employees = []) {
  let counter = 1;
  const usedCodes = new Set(employees.map((e) => (e.code || "").toUpperCase()).filter(Boolean));

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
      created_at: emp.created_at || new Date().toISOString(),
    };
  });
}

// ---------- Local JSON DB Helpers ----------
function loadLocalDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const rawEmployees = data.employees || [];
    const migratedEmployees = migrateEmployeeList(rawEmployees);

    // If any employee was migrated, save back to file
    const needsMigration = rawEmployees.some(
      (e, idx) => !e.code || !e.password_hash || !e.salt || e.code !== migratedEmployees[idx]?.code
    );
    if (needsMigration) {
      data.employees = migratedEmployees;
      saveLocalDB(data);
    }

    return {
      employees: migratedEmployees,
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

  async getEmployeeById(id) {
    if (isSupabase) {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data || null;
    }
    const local = loadLocalDB();
    return local.employees.find((e) => e.id === id) || null;
  },

  async getEmployeeByCode(code) {
    const cleanCode = String(code || "").trim().toUpperCase();
    if (isSupabase) {
      const { data, error } = await supabase.from("employees").select("*").ilike("code", cleanCode).maybeSingle();
      if (error) throw error;
      return data || null;
    }
    const local = loadLocalDB();
    return local.employees.find((e) => (e.code || "").toUpperCase() === cleanCode) || null;
  },

  async createEmployee(employeeInput) {
    const id = crypto.randomUUID();
    let empData;
    if (typeof employeeInput === "string") {
      const name = employeeInput.trim();
      const defaultPass = "NV01123456";
      const { hash, salt } = hashPassword(defaultPass);
      empData = { id, code: "NV01", name, password_hash: hash, salt, created_at: new Date().toISOString() };
    } else {
      empData = {
        id,
        code: employeeInput.code,
        name: employeeInput.name,
        password_hash: employeeInput.password_hash,
        salt: employeeInput.salt,
        created_at: new Date().toISOString(),
      };
    }

    if (isSupabase) {
      const { data, error } = await supabase.from("employees").insert([empData]).select().single();
      if (error) throw error;
      return data;
    }
    const local = loadLocalDB();
    local.employees.push(empData);
    saveLocalDB(local);
    return empData;
  },

  async updateEmployee(id, patch) {
    if (isSupabase) {
      const { data, error } = await supabase.from("employees").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    }
    const local = loadLocalDB();
    const index = local.employees.findIndex((e) => e.id === id);
    if (index === -1) return null;
    local.employees[index] = { ...local.employees[index], ...patch };
    saveLocalDB(local);
    return local.employees[index];
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
    const { month, employeeId, startDate, endDate, mode, date } =
      typeof filters === "string" ? { month: filters } : filters;

    if (isSupabase) {
      let query = supabase.from("entries").select("*").order("date", { ascending: false });
      if (date) query = query.eq("date", date);
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
    if (date) entries = entries.filter((e) => e.date === date);
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

// ---------- Google Sheet Sync & Calculation Helpers ----------
function calculateWorkHours(inStr, outStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  if (!inStr || !outStr) return 0;
  const [ih, im] = inStr.split(":").map(Number);
  const [oh, om] = outStr.split(":").map(Number);
  if (isNaN(ih) || isNaN(im) || isNaN(oh) || isNaN(om)) return 0;
  const inMin = ih * 60 + im;
  const outMin = oh * 60 + om;
  if (outMin <= inMin) return 0;
  const rawMinutes = outMin - inMin;
  const rawHours = rawMinutes / 60;
  if (rawHours > 5) {
    const workedMin = rawMinutes - 90;
    return workedMin > 0 ? workedMin / 60 : 0;
  }
  return rawHours;
}

function buildSyncEntryPayload(entry, employeeName = "") {
  return {
    action: "sync_entry",
    entry: {
      date: entry.date,
      employeeId: entry.employeeId,
      employeeName: employeeName,
      in: entry.in || "",
      out: entry.out || "",
      workHours: calculateWorkHours(entry.in, entry.out, entry.mode),
      mode: entry.mode || "Onsite",
      note: entry.note || "",
      updatedAt: entry.updatedAt || new Date().toISOString(),
    },
  };
}

function aggregateMonthSummary(employees, entries) {
  return employees.map((emp) => {
    const empEntries = entries.filter((e) => e.employeeId === emp.id);
    const totalHours = empEntries.reduce((acc, e) => acc + calculateWorkHours(e.in, e.out, e.mode), 0);
    const onsiteDays = empEntries.filter((e) => e.mode === "Onsite").length;
    const remoteDays = empEntries.filter((e) => e.mode === "Remote").length;
    const offDays = empEntries.filter((e) => e.mode === "Nghỉ" || e.mode === "Off").length;
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      totalHours: Math.round(totalHours * 100) / 100,
      onsiteDays,
      remoteDays,
      offDays,
    };
  });
}

async function getEffectiveWebhookConfig() {
  const dbUrl = await db.getSetting("google_sheet_webhook_url");
  const dbEnabled = await db.getSetting("google_sheet_sync_enabled");
  const envUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || "";

  const webhookUrl = dbUrl !== null && dbUrl !== undefined && dbUrl !== "" ? dbUrl : envUrl;
  const syncEnabled = dbEnabled === null || dbEnabled === undefined ? true : Boolean(dbEnabled);

  return {
    webhookUrl: webhookUrl || "",
    syncEnabled,
    hasEnvFallback: Boolean(envUrl),
  };
}

async function sendGoogleSheetWebhook(payload, customUrl = null) {
  try {
    let targetUrl = customUrl;
    if (!targetUrl) {
      const config = await getEffectiveWebhookConfig();
      if (!config.syncEnabled || !config.webhookUrl) return { skipped: true };
      targetUrl = config.webhookUrl;
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return { success: false, error: "URL không hợp lệ. Vui lòng nhập URL bắt đầu bằng https://" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawText = await res.text().catch(() => "");
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Not JSON response
    }

    if (!res.ok) {
      if (rawText.includes("<title>Không tìm thấy trang</title>") || rawText.includes("404")) {
        return {
          success: false,
          status: res.status,
          error: "URL không tìm thấy (404). Vui lòng kiểm tra lại URL Triển khai Web App (phải kết thúc bằng /exec).",
        };
      }
      if (rawText.includes("accounts.google.com") || rawText.includes("Sign in")) {
        return {
          success: false,
          status: res.status,
          error: "Quyền truy cập bị từ chối. Hãy chắc chắn khi Deploy Web App, mục 'Ai có quyền truy cập' đã chọn 'Bất kỳ ai' (Anyone).",
        };
      }
      const cleanError = rawText.length > 150 ? `Lỗi máy chủ Google (${res.status})` : rawText;
      return { success: false, status: res.status, error: cleanError || `HTTP ${res.status}` };
    }

    if (data && data.status === "error") {
      return { success: false, error: data.message || "Lỗi xử lý từ Google Apps Script" };
    }

    return { success: true, data: data || { status: "success" } };
  } catch (err) {
    if (err.name === "AbortError") {
      return { success: false, error: "Hết thời gian chờ kết nối đến Google Sheet (Timeout 10s)" };
    }
    return { success: false, error: err.message };
  }
}

// ---------- Settings Endpoints ----------
app.get("/api/settings", requireAdmin, async (req, res) => {
  try {
    const config = await getEffectiveWebhookConfig();
    const dbUrl = await db.getSetting("google_sheet_webhook_url");
    res.json({
      googleSheetWebhookUrl: dbUrl || "",
      effectiveWebhookUrl: config.webhookUrl,
      googleSheetSyncEnabled: config.syncEnabled,
      hasEnvFallback: config.hasEnvFallback,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings", requireAdmin, async (req, res) => {
  const { googleSheetWebhookUrl, googleSheetSyncEnabled } = req.body;
  try {
    if (googleSheetWebhookUrl !== undefined) {
      await db.setSetting("google_sheet_webhook_url", String(googleSheetWebhookUrl).trim());
    }
    if (googleSheetSyncEnabled !== undefined) {
      await db.setSetting("google_sheet_sync_enabled", Boolean(googleSheetSyncEnabled));
    }
    const config = await getEffectiveWebhookConfig();
    const dbUrl = await db.getSetting("google_sheet_webhook_url");
    res.json({
      googleSheetWebhookUrl: dbUrl || "",
      googleSheetSyncEnabled: config.syncEnabled,
      hasEnvFallback: config.hasEnvFallback,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Sync Endpoints ----------
app.post("/api/sync/test", requireAdmin, async (req, res) => {
  const { url } = req.body;
  try {
    const config = await getEffectiveWebhookConfig();
    const targetUrl = url ? String(url).trim() : config.webhookUrl;
    if (!targetUrl) {
      return res.status(400).json({ error: "Chưa cấu hình Google Sheet Webhook URL" });
    }

    const payload = {
      action: "test_connection",
      source: "timesheet-app",
      timestamp: new Date().toISOString(),
    };

    const result = await sendGoogleSheetWebhook(payload, targetUrl);
    if (!result.success) {
      return res.status(502).json({ error: result.error || "Không thể kết nối đến Google Sheet" });
    }
    res.json({ success: true, message: "Kết nối Google Sheet thành công!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sync/month", requireAdmin, async (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Tháng không hợp lệ (định dạng YYYY-MM)" });
  }

  try {
    const config = await getEffectiveWebhookConfig();
    if (!config.webhookUrl) {
      return res.status(400).json({ error: "Chưa cấu hình Google Sheet Webhook URL" });
    }

    const [employees, entries] = await Promise.all([
      db.getEmployees(),
      db.getEntries({ month }),
    ]);

    const empMap = new Map(employees.map((e) => [e.id, e.name]));
    const formattedEntries = entries.map((e) => ({
      date: e.date,
      employeeId: e.employeeId,
      employeeName: empMap.get(e.employeeId) || "",
      in: e.in || "",
      out: e.out || "",
      workHours: calculateWorkHours(e.in, e.out, e.mode),
      mode: e.mode || "Onsite",
      note: e.note || "",
      updatedAt: e.created_at || new Date().toISOString(),
    }));

    const summary = aggregateMonthSummary(employees, entries);

    const payload = {
      action: "sync_month",
      month,
      entries: formattedEntries,
      summary,
    };

    const result = await sendGoogleSheetWebhook(payload, config.webhookUrl);
    if (!result.success) {
      return res.status(502).json({ error: result.error || "Lỗi khi gửi dữ liệu sang Google Sheet" });
    }

    res.json({
      success: true,
      month,
      entryCount: formattedEntries.length,
      summaryCount: summary.length,
      message: `Đồng bộ thành công ${formattedEntries.length} bản ghi tháng ${month}!`,
    });
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

  try {
    const existingList = await db.getEntries({ date, employeeId });
    const existing = existingList.find((e) => e.date === date && e.employeeId === employeeId);
    if (existing) {
      const isCompleted = (existing.in && existing.out) || existing.mode === "Nghỉ" || existing.mode === "Off";
      if (isCompleted) {
        return res.status(400).json({ error: "Nhân viên này đã hoàn thành chấm công trong ngày hôm nay!" });
      }
      // Nếu đã có in mà chưa có out, và gửi lên có out -> tự động cập nhật bản ghi
      if (existing.in && !existing.out && (out || timeIn)) {
        const patch = {
          out: out || timeIn,
          mode: mode || existing.mode,
          note: trimmedNote || existing.note,
        };
        const updated = await db.updateEntry(existing.id, patch);
        
        // Asynchronous non-blocking sync
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

    // Asynchronous non-blocking sync
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

    // Asynchronous non-blocking sync
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

// Gắn các helper functions vào app để vừa là Express handler cho Vercel Serverless, vừa export được cho tests
app.db = db;
app.hashPassword = hashPassword;
app.verifyPassword = verifyPassword;
app.generateAdminToken = generateAdminToken;
app.verifyAdminToken = verifyAdminToken;
app.requireAdmin = requireAdmin;
app.calculateWorkHours = calculateWorkHours;
app.buildSyncEntryPayload = buildSyncEntryPayload;
app.aggregateMonthSummary = aggregateMonthSummary;
app.getEffectiveWebhookConfig = getEffectiveWebhookConfig;
app.sendGoogleSheetWebhook = sendGoogleSheetWebhook;
app.migrateEmployeeList = migrateEmployeeList;

module.exports = app;
