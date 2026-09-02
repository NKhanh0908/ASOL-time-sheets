const assert = require("assert");

function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function hoursBetween(inStr, outStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  const rawMinutes = outMin - inMin;
  const rawHours = rawMinutes / 60;

  // Làm trên 5 tiếng: trừ 1h30 (90 phút) nghỉ trưa
  if (rawHours > 5) {
    const workedMin = rawMinutes - 90;
    return workedMin > 0 ? workedMin / 60 : 0;
  }

  // Làm nửa buổi (<= 5 tiếng): giữ nguyên
  return rawHours;
}

console.log("Running Twice-Daily Check-In & Lunch Calc Tests...");

// Case 1: Cả ngày 08:30 -> 18:00 (9.5h raw > 5h) => 9.5 - 1.5 = 8.00h
const c1 = hoursBetween("08:30", "18:00", "Onsite");
assert.strictEqual(c1, 8.0, `Expected 8.0h, got ${c1}`);

// Case 2: Nửa buổi sáng 08:30 -> 12:30 (4h raw <= 5h) => giữ nguyên 4.00h (không trừ trưa)
const c2 = hoursBetween("08:30", "12:30", "Onsite");
assert.strictEqual(c2, 4.0, `Expected 4.0h, got ${c2}`);

// Case 3: Nửa buổi 5 tiếng 08:00 -> 13:00 (5h raw <= 5h) => giữ nguyên 5.00h
const c3 = hoursBetween("08:00", "13:00", "Remote");
assert.strictEqual(c3, 5.0, `Expected 5.0h, got ${c3}`);

// Case 4: Thiếu giờ ra (chỉ có giờ vào 08:30) => không tính giờ (0h)
const c4 = hoursBetween("08:30", "", "Onsite");
assert.strictEqual(c4, 0, `Expected 0h when missing checkout, got ${c4}`);

// Case 5: Thiếu giờ vào (chỉ có giờ ra 18:00) => không tính giờ (0h)
const c5 = hoursBetween("", "18:00", "Onsite");
assert.strictEqual(c5, 0, `Expected 0h when missing checkin, got ${c5}`);

// Case 6: Nghỉ phép => 0h
const c6 = hoursBetween("08:30", "18:00", "Nghỉ");
assert.strictEqual(c6, 0, `Expected 0h for Off mode, got ${c6}`);

// Case 7: English Off mode => 0h
const c7 = hoursBetween("08:30", "18:00", "Off");
assert.strictEqual(c7, 0, `Expected 0h for Off mode, got ${c7}`);

// Case 8: Pagination calculations
console.log("Testing Pagination slice & KPI calculations...");
const sampleList = Array.from({ length: 25 }, (_, i) => ({ id: `${i + 1}`, val: i + 1 }));

const paginate = (items, page = 1, pageSize = 10) => {
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const curPage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (curPage - 1) * pageSize;
  const pageItems = items.slice(startIdx, startIdx + pageSize);
  return { curPage, totalPages, totalItems: items.length, pageItems };
};

const p1 = paginate(sampleList, 1, 10);
assert.strictEqual(p1.pageItems.length, 10);
assert.strictEqual(p1.totalPages, 3);
assert.strictEqual(p1.pageItems[0].id, "1");

const p3 = paginate(sampleList, 3, 10);
assert.strictEqual(p3.pageItems.length, 5);
assert.strictEqual(p3.pageItems[4].id, "25");

console.log("All calculation and pagination tests passed successfully!");
process.exit(0);
