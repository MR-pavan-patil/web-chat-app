# Supabase setup for SchoolSphere

Run this SQL in the Supabase SQL editor:

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student','teacher','admin')),
  class_name text,
  created_at timestamptz default now()
);

create table if not exists announcements (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  posted_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists assignments (
  id bigint generated always as identity primary key,
  title text not null,
  class_name text not null,
  due_date date not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists attendance (
  id bigint generated always as identity primary key,
  student_id uuid not null references profiles(id),
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Late')),
  marked_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists grades (
  id bigint generated always as identity primary key,
  student_id uuid not null references profiles(id),
  subject text not null,
  score int not null check (score between 0 and 100),
  graded_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

Enable RLS and policies (basic starter rules):

```sql
alter table profiles enable row level security;
alter table announcements enable row level security;
alter table assignments enable row level security;
alter table attendance enable row level security;
alter table grades enable row level security;

create policy "profile read own" on profiles for select using (auth.uid() = id);
create policy "profile update own" on profiles for update using (auth.uid() = id);

create policy "announcements read all" on announcements for select using (auth.role() = 'authenticated');
create policy "announcements insert admin" on announcements for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "assignments read all" on assignments for select using (auth.role() = 'authenticated');
create policy "assignments insert teacher_admin" on assignments for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
);

create policy "attendance student read own" on attendance for select using (
  student_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('teacher','admin')
  )
);
create policy "attendance insert teacher_admin" on attendance for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
);

create policy "grades student read own" on grades for select using (
  student_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('teacher','admin')
  )
);
create policy "grades insert teacher_admin" on grades for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
);
```

After this, replace constants in `app.js`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
