-- Unofficial public constitution drafts: separate from official Constitution source files.
create table if not exists public.unofficial_constitution_drafts (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default '',
  creator_name text not null default '',
  creator_type text not null default 'citizen',
  constitution_type text not null default 'full',
  summary text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','published')),
  chapters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.unofficial_constitution_drafts enable row level security;
drop policy if exists "Public can read published unofficial drafts" on public.unofficial_constitution_drafts;
create policy "Public can read published unofficial drafts" on public.unofficial_constitution_drafts for select using (status='published' or auth.uid()=user_id);
drop policy if exists "Users create own unofficial drafts" on public.unofficial_constitution_drafts;
create policy "Users create own unofficial drafts" on public.unofficial_constitution_drafts for insert with check (auth.uid()=user_id);
drop policy if exists "Users update own unofficial drafts" on public.unofficial_constitution_drafts;
create policy "Users update own unofficial drafts" on public.unofficial_constitution_drafts for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "Users delete own unofficial drafts" on public.unofficial_constitution_drafts;
create policy "Users delete own unofficial drafts" on public.unofficial_constitution_drafts for delete using (auth.uid()=user_id);
create index if not exists unofficial_constitution_drafts_status_updated_idx on public.unofficial_constitution_drafts(status,updated_at desc);
