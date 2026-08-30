const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "db.json");

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { employees: [], entries: [] };
  }
}

function saveDB(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Employees ----------
app.get("/api/employees", (req, res) => {
  res.json(loadDB().employees);
});

app.post("/api/employees", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Tên không được để trống" });
  const db = loadDB();
  const emp = { id: crypto.randomUUID(), name };
  db.employees.push(emp);
  saveDB(db);
  res.json(emp);
});

app.delete("/api/employees/:id", (req, res) => {
  const db = loadDB();
  db.employees = db.employees.filter((e) => e.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ---------- Entries ----------
app.get("/api/entries", (req, res) => {
  const { month } = req.query; // "YYYY-MM"
  const db = loadDB();
  let entries = db.entries;
  if (month) entries = entries.filter((e) => e.date.startsWith(month));
  res.json(entries);
});

app.post("/api/entries", (req, res) => {
  const { date, employeeId, in: timeIn, out, mode, note } = req.body;
  if (!date || !employeeId || !mode) {
    return res.status(400).json({ error: "Thiếu ngày, nhân viên hoặc hình thức" });
  }
  const db = loadDB();
  const entry = {
    id: crypto.randomUUID(),
    date,
    employeeId,
    in: timeIn || "",
    out: out || "",
    mode,
    note: note || "",
  };
  db.entries.push(entry);
  saveDB(db);
  res.json(entry);
});

app.delete("/api/entries/:id", (req, res) => {
  const db = loadDB();
  db.entries = db.entries.filter((e) => e.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Timesheet app đang chạy tại http://localhost:${PORT}`);
});
