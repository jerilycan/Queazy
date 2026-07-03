-- ============================================================
-- QuEazy — Reconstruction du schéma Supabase
-- À coller dans Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ============================================================
-- 1. TABLE profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles: lecture de son propre profil" on public.profiles;
create policy "Profiles: lecture de son propre profil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles: creation de son propre profil" on public.profiles;
create policy "Profiles: creation de son propre profil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles: mise a jour de son propre profil" on public.profiles;
create policy "Profiles: mise a jour de son propre profil"
  on public.profiles for update
  using (auth.uid() = id);

-- Création automatique d'une ligne profiles à l'inscription
-- (évite les erreurs si le client lit le profil avant le premier
-- passage sur la page /profile.html)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. TABLE quizzes
-- ============================================================
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Sans titre',
  questions jsonb not null default '[]'::jsonb,
  single_attempt boolean not null default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;

drop policy if exists "Quizzes: lecture de ses propres quiz" on public.quizzes;
create policy "Quizzes: lecture de ses propres quiz"
  on public.quizzes for select
  using (auth.uid() = owner_id);

drop policy if exists "Quizzes: lecture des quiz publics" on public.quizzes;
create policy "Quizzes: lecture des quiz publics"
  on public.quizzes for select
  using (is_public = true);

drop policy if exists "Quizzes: creation de ses propres quiz" on public.quizzes;
create policy "Quizzes: creation de ses propres quiz"
  on public.quizzes for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Quizzes: mise a jour de ses propres quiz" on public.quizzes;
create policy "Quizzes: mise a jour de ses propres quiz"
  on public.quizzes for update
  using (auth.uid() = owner_id);

drop policy if exists "Quizzes: suppression de ses propres quiz" on public.quizzes;
create policy "Quizzes: suppression de ses propres quiz"
  on public.quizzes for delete
  using (auth.uid() = owner_id);

-- updated_at mis à jour automatiquement à chaque édition
-- (utilisé par select.js pour trier "Mes Quiz" par date de modification)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute procedure public.set_updated_at();

create index if not exists quizzes_owner_id_idx on public.quizzes (owner_id);
create index if not exists quizzes_is_public_idx on public.quizzes (is_public);
