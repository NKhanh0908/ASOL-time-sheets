/**
 * Google Apps Script Web App for ASOL Timesheet Sync
 * Deploy as Web App: Execute as "Me", Who has access: "Anyone"
 */
function doPost(e) {
  try {
    const contents = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = contents.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets(ss);

    if (action === "test_connection") {
      return jsonResponse({ status: "success", message: "Kết nối Google Sheet thành công!", timestamp: contents.timestamp });
    }

    if (action === "sync_entry") {
      const result = handleSyncEntry(ss, contents.entry);
      return jsonResponse({ status: "success", action: "sync_entry", result });
    }

    if (action === "sync_month") {
      const result = handleSyncMonth(ss, contents.month, contents.entries || [], contents.summary || []);
      return jsonResponse({ status: "success", action: "sync_month", result });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function setupSheets(ss) {
  let entrySheet = ss.getSheetByName("NhatKy_ChamCong");
  if (!entrySheet) {
    entrySheet = ss.insertSheet("NhatKy_ChamCong");
    entrySheet.appendRow(["Ngày", "Mã NV", "Tên NV", "Giờ Vào", "Giờ Ra", "Tổng Giờ", "Hình Thức", "Ghi Chú", "Cập Nhật Lúc"]);
    entrySheet.getRange("A1:I1").setFontWeight("bold").setBackground("#e9ecef");
  }

  let summarySheet = ss.getSheetByName("TongHop_Thang");
  if (!summarySheet) {
    summarySheet = ss.insertSheet("TongHop_Thang");
    summarySheet.appendRow(["Tháng", "Mã NV", "Tên NV", "Tổng Giờ Làm", "Số Ngày Onsite", "Số Ngày Remote", "Số Ngày Nghỉ"]);
    summarySheet.getRange("A1:G1").setFontWeight("bold").setBackground("#e9ecef");
  }
}

function handleSyncEntry(ss, entry) {
  if (!entry || !entry.date || !entry.employeeId) return { updated: false, error: "Missing entry info" };
  const sheet = ss.getSheetByName("NhatKy_ChamCong");
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    const rowDate = String(data[i][0]).substring(0, 10);
    const rowEmpId = String(data[i][1]);
    if (rowDate === String(entry.date) && rowEmpId === String(entry.employeeId)) {
      foundRow = i + 1;
      break;
    }
  }

  const rowValues = [
    entry.date,
    entry.employeeId,
    entry.employeeName || "",
    entry.in || "",
    entry.out || "",
    entry.workHours !== undefined ? entry.workHours : "",
    entry.mode || "Onsite",
    entry.note || "",
    entry.updatedAt || new Date().toISOString()
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    return { row: foundRow, type: "updated" };
  } else {
    sheet.appendRow(rowValues);
    return { row: sheet.getLastRow(), type: "inserted" };
  }
}

function handleSyncMonth(ss, month, entries, summary) {
  entries.forEach(entry => handleSyncEntry(ss, entry));

  const sumSheet = ss.getSheetByName("TongHop_Thang");
  const sumData = sumSheet.getDataRange().getValues();
  
  // Remove existing rows for the same month
  for (let i = sumData.length - 1; i >= 1; i--) {
    if (String(sumData[i][0]) === String(month)) {
      sumSheet.deleteRow(i + 1);
    }
  }

  // Append new summary rows
  summary.forEach(s => {
    sumSheet.appendRow([
      month,
      s.employeeId,
      s.employeeName,
      s.totalHours || 0,
      s.onsiteDays || 0,
      s.remoteDays || 0,
      s.offDays || 0
    ]);
  });

  return { month, entryCount: entries.length, summaryCount: summary.length };
}
