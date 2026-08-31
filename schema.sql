-- ============================================================
-- SQL Schema & Migration cho Bảng Chấm Công (Timesheet App) trên Supabase
-- Copy toàn bộ nội dung file này dán vào Supabase -> SQL Editor -> Run
-- An toàn 100% không làm mất dữ liệu cũ trên Production
-- ============================================================

-- 1. Bảng Thực tập sinh (employees)
create table if not exists public.employees (
  id text primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tự động bổ sung các cột mới phục vụ Đăng nhập & Mã định danh nếu database đã có từ trước
alter table public.employees add column if not exists code text;
alter table public.employees add column if not exists password_hash text;
alter table public.employees add column if not exists salt text;

-- Tự động đánh số mã TTS01, TTS02... cho các thực tập sinh cũ nếu đang để trống
with numbered as (
  select id, 'TTS' || lpad((row_number() over (order by created_at))::text, 2, '0') as gen_code
  from public.employees
  where code is null or code = ''
)
update public.employees e
set code = n.gen_code
from numbered n
where e.id = n.id;

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

-- 3. Bảng Cấu hình hệ thống (system_settings)
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tạo Index tối ưu truy vấn
create index if not exists idx_employees_code on public.employees(code);
create index if not exists idx_entries_date on public.entries(date);
create index if not exists idx_entries_employee_id on public.entries(employee_id);

-- 5. Bật Row Level Security (RLS) & Policies
alter table public.employees enable row level security;
alter table public.entries enable row level security;
alter table public.system_settings enable row level security;

create policy "Allow all access to employees" on public.employees for all using (true) with check (true);
create policy "Allow all access to entries" on public.entries for all using (true) with check (true);
create policy "Allow all access to system_settings" on public.system_settings for all using (true) with check (true);

-- 6. Dữ liệu mẫu khởi tạo (Seed Data nếu chưa có)
-- Cấu hình Admin ban đầu (mật khẩu: admin123)
insert into public.system_settings (key, value)
values (
  'admin_auth',
  '{"hash": "864db4faf0a99c2f2367099440cb8b2cb28c54b9a27cc2c2410017aa17466f87219e2a5873db9f51d58f7f0570c86c7cf2078508ae95909271a8f214fd6fc861", "salt": "11a59303be2fce802daca0fdbdb2e749", "updated_at": "2026-08-31T00:00:00.000Z"}'::jsonb
)
on conflict (key) do nothing;

-- 2 Thực tập sinh mẫu (TTS01: TTS01123456, TTS02: TTS02123456)
insert into public.employees (id, code, name, password_hash, salt)
values
  (
    '241651f2-cf32-4a34-9205-c1ca6ea346d8',
    'TTS01',
    'Nguyễn Văn A',
    '2f6a73c1d4ba219a16f2c2b3e8ecb9741e57c6b4e0586e92f2545bcad576d1ad6da5a64388b1f5d6f45a6c11d2e1c3a647d79fa52b047a505b22b1c20c02932c',
    '5130d599b38d5b699deb3ae6e350d9a2'
  ),
  (
    '89e7913b-0853-4b56-8179-22780cdaacd9',
    'TTS02',
    'Trần Thị B',
    '4a7db76191b2bfb26715fbc746c0be44357fe1a50ce022eb611bf7e828e82a0d9e8759d57a2f5f992d9d1469e5d4cbfe0816cfcb4e05aefb6a71ad5417855364',
    '0df8d352d2161c895a4421a80094c3f6'
  )
on conflict (id) do nothing;
