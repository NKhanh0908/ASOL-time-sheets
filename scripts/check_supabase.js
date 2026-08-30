require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

async function checkSupabase() {
  console.log("==================================================");
  console.log("🔍 Đang kiểm tra kết nối Supabase & Database Schema...");
  console.log("==================================================");

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("⚠️  Chưa phát hiện biến môi trường SUPABASE_URL hoặc SUPABASE_KEY trong file .env!");
    console.log("👉 Hướng dẫn:");
    console.log("   1. Tạo file .env ở thư mục gốc.");
    console.log("   2. Điền:");
    console.log("      SUPABASE_URL=https://your-project.supabase.co");
    console.log("      SUPABASE_KEY=your-anon-or-service-key");
    console.log("   3. Chạy lại lệnh: node scripts/check_supabase.js");
    return;
  }

  console.log(`🔗 URL: ${url}`);
  console.log(`🔑 Key: ${key.slice(0, 8)}...${key.slice(-6)}`);

  try {
    const supabase = createClient(url, key);

    // 1. Kiểm tra bảng employees
    console.log("\n[1/2] Kiểm tra bảng 'employees'...");
    const { data: empData, error: empError } = await supabase.from("employees").select("*").limit(5);
    if (empError) {
      console.error("❌ Lỗi truy vấn bảng 'employees':", empError.message);
      if (empError.code === "42P01") {
        console.error("💡 Gợi ý: Bảng 'employees' chưa được tạo. Hãy chạy file schema.sql trong Supabase SQL Editor!");
      }
    } else {
      console.log(`✅ Bảng 'employees' hoạt động tốt! (Hiện có ${empData.length} bản ghi)`);
    }

    // 2. Kiểm tra bảng entries
    console.log("\n[2/2] Kiểm tra bảng 'entries'...");
    const { data: entData, error: entError } = await supabase.from("entries").select("*").limit(5);
    if (entError) {
      console.error("❌ Lỗi truy vấn bảng 'entries':", entError.message);
      if (entError.code === "42P01") {
        console.error("💡 Gợi ý: Bảng 'entries' chưa được tạo. Hãy chạy file schema.sql trong Supabase SQL Editor!");
      }
    } else {
      console.log(`✅ Bảng 'entries' hoạt động tốt! (Hiện có ${entData.length} bản ghi)`);
    }

    if (!empError && !entError) {
      console.log("\n🎉 HOÀN TẤT: Kết nối Supabase và Schema Database hoàn toàn chính xác & sẵn sàng deploy!");
    }
  } catch (err) {
    console.error("❌ Lỗi kết nối Supabase:", err.message);
  }
}

checkSupabase();
