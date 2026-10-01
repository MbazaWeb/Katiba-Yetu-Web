alter table public.profiles add column if not exists birth_year smallint;
alter table public.profiles drop constraint if exists profiles_birth_year_check;
alter table public.profiles add constraint profiles_birth_year_check check (birth_year is null or birth_year between 1900 and extract(year from current_date)::int);
