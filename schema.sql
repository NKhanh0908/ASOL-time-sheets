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
