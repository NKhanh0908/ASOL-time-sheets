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

function saveLocalDB(dbData) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
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
