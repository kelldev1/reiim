-- reiim — système d'amis (identité "Pseudo#TAG", à la Valorant).
-- À appliquer via "supabase db push" ou en collant dans le SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. tag sur profiles  →  identité = name || '#' || tag
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists tag text;

-- tag aléatoire, 4 caractères, alphabet sans ambiguïté (pas de O/0/I/1).
create or replace function public.gen_tag()
returns text language sql volatile as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           (floor(random() * 31)::int) + 1, 1), '')
  from generate_series(1, 4);
$$;

-- backfill des comptes existants avec un tag unique
do $$
declare r record; t text;
begin
  for r in select id from public.profiles where tag is null loop
    loop
      t := public.gen_tag();
      exit when not exists (select 1 from public.profiles where tag = t);
    end loop;
    update public.profiles set tag = t where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column tag set not null;
create unique index if not exists profiles_tag_key on public.profiles (tag);

-- attribuer un tag à l'inscription (on remplace handle_new_user)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare t text;
begin
  loop
    t := public.gen_tag();
    exit when not exists (select 1 from public.profiles where tag = t);
  end loop;

  insert into public.profiles (id, email, name, tag)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    t
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. tables : demandes d'amis + amis confirmés
--    (écriture uniquement via les fonctions ci-dessous — RLS = lecture seule)
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending',   -- pending | accepted
  created_at timestamptz not null default now(),
  unique (from_user, to_user)
);
alter table public.friend_requests enable row level security;
create policy "friend_requests: read mine"
  on public.friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);

create table if not exists public.friends (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
alter table public.friends enable row level security;
create policy "friends: read mine"
  on public.friends for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. fonctions (security definer — n'exposent que des champs "publics")
-- ---------------------------------------------------------------------------

-- Chercher un utilisateur par son tag (+ pseudo optionnel pour lever une ambiguïté).
create or replace function public.find_user_by_tag(p_name text, p_tag text)
returns table (id uuid, name text, tag text, avatar text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.tag, p.avatar
  from public.profiles p
  where upper(p.tag) = upper(p_tag)
    and (p_name is null or p_name = '' or lower(p.name) = lower(p_name))
  limit 1;
$$;

-- Accepter une demande reçue → crée les deux lignes d'amitié.
create or replace function public.accept_friend_request(p_req uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.friend_requests;
begin
  select * into r from public.friend_requests where id = p_req;
  if not found then return; end if;
  if auth.uid() is not null and r.to_user <> auth.uid() then return; end if;

  update public.friend_requests set status = 'accepted' where id = p_req;
  insert into public.friends (user_id, friend_id)
    values (r.from_user, r.to_user) on conflict do nothing;
  insert into public.friends (user_id, friend_id)
    values (r.to_user, r.from_user) on conflict do nothing;
end;
$$;

-- Envoyer une demande. Si une demande inverse est déjà en attente → on accepte direct.
create or replace function public.send_friend_request(p_target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
declare rev uuid;
begin
  if me is null then return 'auth'; end if;
  if me = p_target then return 'self'; end if;
  if exists (select 1 from public.friends where user_id = me and friend_id = p_target) then
    return 'already-friends';
  end if;

  select id into rev
  from public.friend_requests
  where from_user = p_target and to_user = me and status = 'pending';

  if rev is not null then
    perform public.accept_friend_request(rev);
    return 'accepted';
  end if;

  insert into public.friend_requests (from_user, to_user)
  values (me, p_target)
  on conflict (from_user, to_user) do update set status = 'pending', created_at = now();
  return 'sent';
end;
$$;

-- Refuser (je suis destinataire) ou annuler (je suis émetteur) une demande en attente.
create or replace function public.dismiss_friend_request(p_req uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friend_requests
  where id = p_req and (from_user = auth.uid() or to_user = auth.uid());
$$;

-- Retirer un ami (supprime les 2 sens + les demandes, pour pouvoir se ré-ajouter).
create or replace function public.remove_friend(p_friend uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  delete from public.friends
  where (user_id = me and friend_id = p_friend)
     or (user_id = p_friend and friend_id = me);
  delete from public.friend_requests
  where (from_user = me and to_user = p_friend)
     or (from_user = p_friend and to_user = me);
end;
$$;

-- Liste des amis (avec leurs champs publics).
create or replace function public.list_friends()
returns table (id uuid, name text, tag text, avatar text, since timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.tag, p.avatar, f.created_at
  from public.friends f
  join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
  order by lower(p.name);
$$;

-- Demandes en attente (reçues 'in' + envoyées 'out') avec le profil de l'autre.
create or replace function public.list_friend_requests()
returns table (
  id uuid, direction text, other_id uuid,
  name text, tag text, avatar text, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    case when r.to_user = auth.uid() then 'in' else 'out' end,
    case when r.to_user = auth.uid() then r.from_user else r.to_user end,
    p.name, p.tag, p.avatar, r.created_at
  from public.friend_requests r
  join public.profiles p
    on p.id = case when r.to_user = auth.uid() then r.from_user else r.to_user end
  where r.status = 'pending'
    and (r.from_user = auth.uid() or r.to_user = auth.uid())
  order by r.created_at desc;
$$;

grant execute on function public.find_user_by_tag(text, text) to authenticated;
grant execute on function public.send_friend_request(uuid)     to authenticated;
grant execute on function public.accept_friend_request(uuid)   to authenticated;
grant execute on function public.dismiss_friend_request(uuid)  to authenticated;
grant execute on function public.remove_friend(uuid)           to authenticated;
grant execute on function public.list_friends()                to authenticated;
grant execute on function public.list_friend_requests()        to authenticated;
