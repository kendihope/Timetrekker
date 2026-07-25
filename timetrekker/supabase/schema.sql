-- Timetrekker database schema
-- Run this once in your Supabase project's SQL editor (Supabase Dashboard -> SQL Editor -> New query)

-- Every table below has a user_id column tied to Supabase's built-in auth.users table.
-- Row Level Security (RLS) policies ensure each user can only ever see/edit their own rows.
-- New signups automatically start with zero rows in every table = a blank app.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_name text not null default '',
  user_email text not null default '',
  profile_photo text,
  theme_color text not null default 'red',
  use_system_settings boolean not null default false,
  push_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  class_date text,
  class_time text not null,
  room text,
  lecturer text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('School','Work','Social')),
  title text not null,
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  task_time text,
  due_date text,
  recurring text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  title text not null,
  description text,
  due_date text,
  progress int not null default 0 check (progress between 0 and 100),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists budget_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_budget numeric not null default 0,
  income numeric not null default 0,
  savings numeric not null default 0
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  category text not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric not null,
  saved numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('Courses','Work documents','Assignments')),
  name text not null,
  file_type text,
  file_size int,
  storage_path text,
  uploaded_date date not null default current_date
);

-- Enable RLS on every table
alter table profiles enable row level security;
alter table classes enable row level security;
alter table tasks enable row level security;
alter table assignments enable row level security;
alter table budget_profile enable row level security;
alter table expenses enable row level security;
alter table goals enable row level security;
alter table resources enable row level security;

-- Policies: users can only read/write their own rows
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own classes" on classes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own assignments" on assignments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budget_profile" on budget_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own expenses" on expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own resources" on resources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Automatically create a blank profile + budget row the moment someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, user_name, user_email)
  values (new.id, coalesce(new.raw_user_meta_data->>'user_name', ''), new.email);
  insert into public.budget_profile (user_id, total_budget, income, savings)
  values (new.id, 0, 0, 0);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage bucket for uploaded documents (run once; safe to ignore error if it already exists)
insert into storage.buckets (id, name, public) values ('resources', 'resources', false)
on conflict (id) do nothing;

create policy "own resource files read" on storage.objects for select
  using (bucket_id = 'resources' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own resource files insert" on storage.objects for insert
  with check (bucket_id = 'resources' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own resource files delete" on storage.objects for delete
  using (bucket_id = 'resources' and auth.uid()::text = (storage.foldername(name))[1]);
