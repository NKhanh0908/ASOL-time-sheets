const assert = require("assert");

function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function hoursBetween(inStr, outStr, lunchOutStr, lunchInStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  let totalWorkMinutes = outMin - inMin;

  const lOutMin = timeToMinutes(lunchOutStr);
  const lInMin = timeToMinutes(lunchInStr);

  if (lOutMin !== null && lInMin !== null && lInMin > lOutMin) {
    const actualLunchStart = Math.max(inMin, lOutMin);
    const actualLunchEnd = Math.min(outMin, lInMin);
    if (actualLunchEnd > actualLunchStart) {
      totalWorkMinutes -= (actualLunchEnd - actualLunchStart);
    }
  }

  return totalWorkMinutes > 0 ? totalWorkMinutes / 60 : 0;
}

console.log("Running End-to-End calculation test suite...");

// Case 1: 08:30 -> 18:00, lunch 12:00 -> 13:30 (1.5h break) => total: 9.5h - 1.5h = 8.00h
const c1 = hoursBetween("08:30", "18:00", "12:00", "13:30", "Onsite");
assert.strictEqual(c1, 8.0, `Expected 8.0h, got ${c1}`);

// Case 2: 08:30 -> 12:00 (half day, no lunch) => 3.5h
const c2 = hoursBetween("08:30", "12:00", "", "", "Remote");
assert.strictEqual(c2, 3.5, `Expected 3.5h, got ${c2}`);

// Case 3: Mode Off => 0h
const c3 = hoursBetween("08:30", "18:00", "12:00", "13:30", "Nghỉ");
assert.strictEqual(c3, 0, `Expected 0h for Off mode, got ${c3}`);

// Case 4: English Mode "Off" => 0h
const c4 = hoursBetween("08:30", "18:00", "12:00", "13:30", "Off");
assert.strictEqual(c4, 0, `Expected 0h for Off mode, got ${c4}`);

// Case 5: 09:00 -> 17:30 with lunch 12:00 -> 13:00 (1h) => total: 8.5h - 1h = 7.50h
const c5 = hoursBetween("09:00", "17:30", "12:00", "13:00", "Onsite");
assert.strictEqual(c5, 7.5, `Expected 7.5h, got ${c5}`);

// Case 6: Backward compatibility - empty lunchOut / lunchIn => pure diff
const c6 = hoursBetween("08:00", "17:00", undefined, undefined, "Onsite");
assert.strictEqual(c6, 9.0, `Expected 9.0h, got ${c6}`);

console.log("All calculation verification tests passed!");
