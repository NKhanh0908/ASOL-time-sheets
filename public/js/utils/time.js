import { dict, currentLang } from "../i18n.js";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKeyOf(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}

export function timeToMinutes(tStr) {
  if (!tStr) return null;
  const [h, m] = tStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function hoursBetween(inStr, outStr, mode) {
  if (mode === "Nghỉ" || mode === "Off") return 0;
  const inMin = timeToMinutes(inStr);
  const outMin = timeToMinutes(outStr);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;

  const rawMinutes = outMin - inMin;
  const rawHours = rawMinutes / 60;

  // Nếu làm trên 5 tiếng: Tự động trừ 1h30 (90 phút) nghỉ trưa
  if (rawHours > 5) {
    const workedMin = rawMinutes - 90;
    return workedMin > 0 ? workedMin / 60 : 0;
  }

  // Làm nửa buổi (<= 5 tiếng): Không trừ
  return rawHours;
}

export function fmtHours(h) {
  return h.toFixed(2).replace(".", ",") + "h";
}

export function weekdayLabelFor(dateStr) {
  const dayIdx = new Date(dateStr + "T00:00:00").getDay();
  return dict[currentLang].daysOfWeek[dayIdx];
}

export function monthLabel(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-");
  return `${dict[currentLang].monthPrefix} ${parseInt(m, 10)}/${y}`;
}
