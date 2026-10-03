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

-- Unicité du pseudo (insensible à la casse) : nécessaire pour permettre la
-- connexion par pseudo (voir resolve_login_email plus bas) sans ambiguïté.
-- Si cette ligne échoue avec une erreur de doublons, des pseudos en conflit
-- existent déjà en base — les repérer avec :
--   select lower(username), array_agg(id) from public.profiles group by lower(username) having count(*) > 1;
-- puis les renommer manuellement avant de relancer cette création d'index.
create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username))
  where username is not null and username <> '';

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

-- Lecture restreinte du pseudo (et non des autres colonnes, RLS ne filtre
-- pas par colonne mais select.js ne demande que "username" — voir loadPublic)
-- pour les auteurs de quiz PUBLICS uniquement : nécessaire pour afficher
-- "par <auteur>" sur l'onglet "Quiz publics" (select.js). Volontairement
-- scopée (pas un accès général à tous les profils) : la policy "lecture de
-- son propre profil" ci-dessus reste la seule voie pour tout le reste.
drop policy if exists "Profiles: lecture publique du pseudo pour les quiz publics" on public.profiles;
create policy "Profiles: lecture publique du pseudo pour les quiz publics"
  on public.profiles for select
  using (
    exists (
      select 1 from public.quizzes q
      where q.owner_id = profiles.id and q.is_public = true
    )
  );

-- Création automatique d'une ligne profiles à l'inscription
-- (évite les erreurs si le client lit le profil avant le premier
-- passage sur la page /profile.html)
-- Le pseudo doit être unique (voir l'index ci-dessus) : en cas de collision
-- (ex. deux personnes nommées "Jeremy", ou deux emails avec le même préfixe
-- sur des domaines différents), on ajoute un suffixe numérique croissant
-- plutôt que de laisser l'inscription échouer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
  candidate := base_username;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, candidate)
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      candidate := base_username || suffix::text;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Connexion par email OU pseudo
-- ============================================================
-- Supabase Auth n'authentifie que par email (ou téléphone), jamais par
-- pseudo. Cette fonction traduit un identifiant de connexion en email
-- utilisable par signInWithPassword côté client :
--   - si l'identifiant ressemble à un email, il est renvoyé tel quel ;
--   - sinon, il est traité comme un pseudo et résolu via profiles + auth.users.
-- security definer est nécessaire pour lire auth.users (normalement
-- inaccessible aux rôles anon/authenticated) et pour contourner la RLS de
-- profiles (qui ne permet de lire que son propre profil).
-- Compromis assumé : un pseudo existant révèle l'email associé à qui le
-- devine. Acceptable ici (quiz entre amis, pas de données sensibles) ; à
-- remplacer par une résolution côté serveur (sans jamais renvoyer l'email
-- au client) si le contexte devient plus sensible.
create or replace function public.resolve_login_email(identifier text)
returns text
language sql
stable
security definer set search_path = public
as $$
  select case
    when identifier ilike '%@%' then identifier
    else (
      select u.email
      from public.profiles p
      join auth.users u on u.id = p.id
      where lower(p.username) = lower(identifier)
      limit 1
    )
  end
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

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

-- ============================================================
-- 3. TABLE reports — signalements de quiz publics (contenu inapproprié)
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- N'importe qui (connecté ou invité) peut signaler un quiz public. Aucune
-- lecture n'est ouverte via l'API : les signalements se consultent depuis le
-- dashboard Supabase (rôle service, qui ignore la RLS) pour modérer à la main.
drop policy if exists "Reports: creation par tous" on public.reports;
create policy "Reports: creation par tous"
  on public.reports for insert
  with check (true);

create index if not exists reports_quiz_id_idx on public.reports (quiz_id);

-- ============================================================
-- 4. TABLE app_settings — réglages globaux du jeu, modifiables sans
--    redéploiement (lus par le serveur via la clé anon, voir
--    server/index.js: refreshMinPointsFloor). Table volontairement
--    en LECTURE SEULE depuis l'API : aucune policy insert/update/delete
--    n'est créée, donc anon/authenticated ne peuvent jamais l'écrire.
--    Pour changer une valeur : Supabase Dashboard > Table Editor >
--    app_settings > éditer la colonne "value" de la ligne voulue (le
--    dashboard passe par le rôle service, qui ignore la RLS).
-- ============================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "App settings: lecture publique" on public.app_settings;
create policy "App settings: lecture publique"
  on public.app_settings for select
  using (true);

create or replace function public.set_app_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute procedure public.set_app_settings_updated_at();

-- Plancher de points minimum garanti sur une bonne réponse (voir
-- MIN_POINTS_FLOOR_DEFAULT côté serveur, utilisé en repli si cette ligne
-- est absente). Pour changer la valeur : éditer "value" ci-dessous, ou
-- directement depuis le Table Editor Supabase (pas besoin de relancer ce
-- script).
insert into public.app_settings (key, value)
values ('min_points_floor', '300')
on conflict (key) do nothing;

-- Plafond de stockage (Mo) et seuil d'alerte (%), voir server/index.js
-- checkStorageUsage — modifiables ici sans redéploiement, comme
-- min_points_floor ci-dessus.
insert into public.app_settings (key, value)
values ('storage_cap_mb', '1024')
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('storage_alert_threshold_pct', '80')
on conflict (key) do nothing;

-- ============================================================
-- 5. STORAGE — bucket quiz-media (images/audio des quiz, voir editor.js
--    persistQuiz/uploadQuestionMedia) — remplace le stockage base64 dans la
--    colonne questions ci-dessus pour tout NOUVEL enregistrement (les quiz
--    déjà sauvegardés avant ce chantier restent en base64 tant qu'ils ne
--    sont pas resauvegardés, voir le commentaire dans editor.js).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('quiz-media', 'quiz-media', true)
on conflict (id) do nothing;

-- Upload : un utilisateur connecté ne peut écrire que dans SON propre
-- dossier — chemin toujours "<owner_id>/<fichier>" côté client (voir
-- uploadQuestionMedia). Même principe que les policies owner_id sur
-- quizzes/profiles ci-dessus, transposé aux noms de fichiers du bucket
-- (storage.foldername renvoie le chemin découpé en segments, [1] = le
-- premier dossier).
drop policy if exists "quiz-media: upload dans son propre dossier" on storage.objects;
create policy "quiz-media: upload dans son propre dossier"
  on storage.objects for insert
  with check (
    bucket_id = 'quiz-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : ouverte à tout le monde, y compris anon — nécessaire pour que
-- les joueurs (jamais connectés) chargent les images/audio en jeu, ET pour
-- que le serveur liste le bucket avec la clé anon (voir checkStorageUsage,
-- jamais de clé service_role dans ce projet). Un bucket "public" sert déjà
-- les fichiers en lecture directe sans RLS, mais l'API de LISTING (utilisée
-- par checkStorageUsage) reste soumise à cette policy.
drop policy if exists "quiz-media: lecture publique" on storage.objects;
create policy "quiz-media: lecture publique"
  on storage.objects for select
  using (bucket_id = 'quiz-media');

-- ============================================================
-- 6. STORAGE — bucket tuto-videos (vidéos explicatives par type de
--    question, affichées dans le lobby — voir index.js TUTO_VIDEO_BUCKET/
--    openTutoVideos, chantier v1.54). Contenu géré à la main par l'admin
--    de l'appli (Dashboard Supabase, qui bypass RLS en tant que
--    propriétaire du projet) : volontairement AUCUNE policy INSERT ici,
--    contrairement à quiz-media plus haut — personne dans l'appli
--    n'uploade de vidéo, uniquement la lecture publique est nécessaire
--    pour que les joueurs (jamais connectés) les regardent. Convention de
--    nommage stricte : un fichier par type, nommé exactement "<type>.mp4"
--    à la racine du bucket (mêmes slugs que QUESTION_TYPE_META côté
--    index.js — free, mcq, truefalse, graduation, order, image,
--    zoomguess, reveal, blindtest, association, timeline, intrus, pbac).
--    Un type sans fichier correspondant affiche juste "vidéo bientôt
--    disponible" côté client (voir onerror du <video>) plutôt que de
--    bloquer quoi que ce soit.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tuto-videos', 'tuto-videos', true)
on conflict (id) do nothing;

drop policy if exists "tuto-videos: lecture publique" on storage.objects;
create policy "tuto-videos: lecture publique"
  on storage.objects for select
  using (bucket_id = 'tuto-videos');

-- ============================================================
-- 7. TABLE bank_questions (tâche 021 — banque de questions curatée du
--    mode "Jouer", DÉDIÉE et distincte des quiz publics existants,
--    validée avec l'utilisateur : pas d'agrégation de quizzes.questions).
--    `question` jsonb reprend EXACTEMENT la forme d'une question dans
--    quizzes.questions[i] (même normalisation que loadQuizById côté
--    index.js), pour réutiliser tout le rendu/scoring existant sans
--    traitement spécial par type. Peuplée depuis l'éditeur (bouton
--    "Ajouter à la banque", voir editor.js) — vide au départ, voir Risques
--    restants dans docs/agent-tasks/021-mode-jouer-presenter-navbar.md.
-- ============================================================
create table if not exists public.bank_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  difficulty text not null check (difficulty in ('facile','moyen','difficile')),
  type text not null,
  question jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bank_questions enable row level security;
drop policy if exists "bank_questions: lecture publique" on public.bank_questions;
create policy "bank_questions: lecture publique" on public.bank_questions
  for select using (true);
drop policy if exists "bank_questions: ajout par un utilisateur connecte" on public.bank_questions;
create policy "bank_questions: ajout par un utilisateur connecte" on public.bank_questions
  for insert with check (auth.uid() = created_by);
create index if not exists bank_questions_category_idx on public.bank_questions (category);
create index if not exists bank_questions_difficulty_idx on public.bank_questions (difficulty);
create index if not exists bank_questions_type_idx on public.bank_questions (type);

-- ============================================================
-- quiz_results (tâche 048) : un résultat par joueur CONNECTÉ et par partie
-- terminée d'un quiz (mode "Présenter" uniquement — jamais les quiz "Jouer"
-- générés, sans id stable ni les invités, sans compte). Alimente le "score à
-- battre", le top 3 de fin de partie, l'avertissement "X a déjà participé" et
-- la liste des participants du propriétaire.
--
-- Écriture : le serveur n'a que la clé anon (pas de service_role). Il insère
-- donc chaque ligne AVEC LE JETON DE SESSION du joueur concerné (voir
-- server/index.js) : la policy ci-dessous n'autorise que player_id = auth.uid(),
-- le score reste calculé côté serveur, jamais fourni par le client.
-- Lecture : la table elle-même n'est lisible que par le PROPRIÉTAIRE du quiz ;
-- le top 3 et "a déjà participé" passent par des fonctions security definer
-- qui n'exposent que le strict minimum (pseudo, score, date / ids).
-- À exécuter une fois dans le SQL Editor de Supabase.
-- ============================================================
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  score integer not null,
  room_code text,
  played_at timestamptz not null default now()
);
create index if not exists quiz_results_quiz_score_idx on public.quiz_results (quiz_id, score desc);
create index if not exists quiz_results_quiz_player_idx on public.quiz_results (quiz_id, player_id);

alter table public.quiz_results enable row level security;

drop policy if exists "quiz_results: un joueur enregistre son propre resultat" on public.quiz_results;
create policy "quiz_results: un joueur enregistre son propre resultat" on public.quiz_results
  for insert to authenticated with check (player_id = auth.uid());

drop policy if exists "quiz_results: lecture par le proprietaire du quiz" on public.quiz_results;
create policy "quiz_results: lecture par le proprietaire du quiz" on public.quiz_results
  for select to authenticated using (
    exists (select 1 from public.quizzes q where q.id = quiz_results.quiz_id and q.owner_id = auth.uid())
  );

-- Top N d'un quiz : meilleur score de CHAQUE joueur (pas plusieurs lignes du
-- même joueur), pseudo + score + date seulement. Lisible par tout le monde.
create or replace function public.quiz_top_scores(p_quiz_id uuid, p_limit integer default 3)
returns table (player_name text, score integer, played_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.player_name, t.score, t.played_at
  from (
    select distinct on (r.player_id) r.player_name, r.score, r.played_at
    from public.quiz_results r
    where r.quiz_id = p_quiz_id
    order by r.player_id, r.score desc, r.played_at asc
  ) t
  order by t.score desc, t.played_at asc
  limit greatest(p_limit, 1);
$$;

-- Parmi ces joueurs, lesquels ont déjà terminé ce quiz (ids seulement).
create or replace function public.quiz_has_played(p_quiz_id uuid, p_player_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct r.player_id
  from public.quiz_results r
  where r.quiz_id = p_quiz_id and r.player_id = any(p_player_ids);
$$;

-- Liste des participants, RÉSERVÉE au propriétaire du quiz (vérifié dans la
-- fonction : tout autre appelant obtient une liste vide).
create or replace function public.quiz_participants(p_quiz_id uuid)
returns table (player_name text, plays bigint, best_score integer, last_played timestamptz)
language sql stable security definer set search_path = public as $$
  select (array_agg(r.player_name order by r.played_at desc))[1], count(*), max(r.score), max(r.played_at)
  from public.quiz_results r
  where r.quiz_id = p_quiz_id
    and exists (select 1 from public.quizzes q where q.id = p_quiz_id and q.owner_id = auth.uid())
  group by r.player_id
  order by max(r.score) desc;
$$;

grant execute on function public.quiz_top_scores(uuid, integer) to anon, authenticated;
grant execute on function public.quiz_has_played(uuid, uuid[]) to anon, authenticated;
grant execute on function public.quiz_participants(uuid) to authenticated;
