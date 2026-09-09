-- reiim — devoirs + contenu des espaces de travail, remontés du localStorage vers Postgres.
-- Étape 2-3/5 du partage de devoirs. RLS = propriétaire uniquement pour l'instant
-- (l'étape 4 ajoutera les membres invités).

-- ---------------------------------------------------------------------------
-- devoirs : un par (utilisateur, jour)
-- ---------------------------------------------------------------------------
create table if not exists public.devoirs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  d          date not null,
  subject    text not null,
  methods    text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, d)
);
alter table public.devoirs enable row level security;

drop policy if exists "devoirs_owner_all" on public.devoirs;
create policy "devoirs_owner_all" on public.devoirs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists devoirs_owner_d on public.devoirs (owner_id, d);

-- ---------------------------------------------------------------------------
-- devoir_work : contenu d'un espace de travail (une ligne par méthode/slot)
--   data jsonb  = ce que le hook useWork stockait dans reiim-devoir-work
-- ---------------------------------------------------------------------------
create table if not exists public.devoir_work (
  devoir_id  uuid not null references public.devoirs (id) on delete cascade,
  slot       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (devoir_id, slot)
);
alter table public.devoir_work enable row level security;

drop policy if exists "devoir_work_via_owned_devoir" on public.devoir_work;
create policy "devoir_work_via_owned_devoir" on public.devoir_work for all
  using (exists (
    select 1 from public.devoirs dv
    where dv.id = devoir_work.devoir_id and dv.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.devoirs dv
    where dv.id = devoir_work.devoir_id and dv.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- updated_at auto
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists devoirs_touch on public.devoirs;
create trigger devoirs_touch before update on public.devoirs
  for each row execute function public.touch_updated_at();

drop trigger if exists devoir_work_touch on public.devoir_work;
create trigger devoir_work_touch before update on public.devoir_work
  for each row execute function public.touch_updated_at();
