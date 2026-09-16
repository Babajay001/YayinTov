create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  service text,
  message text,
  source text default 'website',
  status text not null default 'new',
  consent boolean not null default false
);

alter table public.leads add column if not exists wedding_date date;
alter table public.leads add column if not exists wedding_location text;
alter table public.leads add column if not exists referral_source text;
alter table public.leads add column if not exists wedding_description text;
alter table public.leads add column if not exists most_excited_about text;
alter table public.leads add column if not exists biggest_concern text;
alter table public.leads add column if not exists desired_relief text;
alter table public.leads add column if not exists support_needed text;

alter table public.leads enable row level security;

-- Do not create a public read policy. The Vercel function writes with the
-- server-only Supabase secret key, while visitors cannot access lead records.
