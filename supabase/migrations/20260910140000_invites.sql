-- reiim — liens d'invitation (accès privé sans inscription publique).
--
-- Un compte autorisé (profiles.can_invite = true) génère un lien via create_invite().
-- La personne qui ouvre le lien crée son compte via l'Edge Function `redeem-invite`
-- (rôle service) : l'inscription publique Supabase reste donc fermée.

-- ---------------------------------------------------------------------------
-- profiles.can_invite : qui a le droit de générer des liens d'invitation.
-- Le(s) compte(s) existant(s) = propriétaire(s) → true. Les comptes créés
-- ensuite (via invitation) sont à false par défaut.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists can_invite boolean not null default false;

-- Le tout premier compte = propriétaire → autorisé. (Idempotent : ne touche
-- que la ligne la plus ancienne, jamais les comptes créés par invitation.)
update public.profiles set can_invite = true
 where id = (select id from public.profiles order by created_at asc limit 1);

-- can_invite rejoint credits/plan : jamais modifiable depuis une session utilisateur.
create or replace function public.profiles_guard_billing()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.credits    is distinct from old.credits
          or new.plan       is distinct from old.plan
          or new.can_invite is distinct from old.can_invite) then
    raise exception 'credits/plan/can_invite are managed server-side';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- invite_codes
-- ---------------------------------------------------------------------------
create table if not exists public.invite_codes (
  code        text primary key,
  created_by  uuid not null references auth.users (id) on delete cascade,
  credits     integer not null default 100 check (credits >= 0 and credits <= 100000),
  max_uses    integer not null default 1   check (max_uses >= 1 and max_uses <= 1000),
  used_count  integer not null default 0   check (used_count >= 0),
  note        text,
  expires_at  timestamptz not null default (now() + interval '30 days'),
  created_at  timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- Le créateur voit ses propres liens ; aucune écriture directe (tout passe par RPC).
drop policy if exists "invite_codes_select_own" on public.invite_codes;
create policy "invite_codes_select_own" on public.invite_codes
  for select using (auth.uid() = created_by);

create index if not exists invite_codes_creator
  on public.invite_codes (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- RPC (côté propriétaire)
-- ---------------------------------------------------------------------------

-- Génère un lien d'invitation. Renvoie la ligne créée.
create or replace function public.create_invite(
  p_credits  integer default 100,
  p_max_uses integer default 1,
  p_note     text    default null
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if not exists (
    select 1 from public.profiles where id = auth.uid() and can_invite
  ) then
    raise exception 'compte non autorisé à créer des invitations';
  end if;

  insert into public.invite_codes (code, created_by, credits, max_uses, note)
  values (
    replace(gen_random_uuid()::text, '-', '')
      || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    auth.uid(),
    greatest(0, least(coalesce(p_credits, 100), 100000)),
    greatest(1, least(coalesce(p_max_uses, 1), 1000)),
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.list_invites()
returns setof public.invite_codes
language sql
security definer
set search_path = public
as $$
  select * from public.invite_codes
   where created_by = auth.uid()
   order by created_at desc;
$$;

create or replace function public.revoke_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.invite_codes
   where code = p_code and created_by = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC (côté serveur — appelées UNIQUEMENT par l'Edge Function redeem-invite)
-- ---------------------------------------------------------------------------

-- Consomme une place sur un lien, de façon ATOMIQUE.
-- Renvoie le nombre de crédits à accorder, ou -1 si invalide / expiré / épuisé.
create or replace function public.claim_invite(p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  update public.invite_codes
     set used_count = used_count + 1
   where code = p_code
     and expires_at > now()
     and used_count < max_uses
  returning credits into v_credits;

  if not found then
    return -1;
  end if;
  return v_credits;
end;
$$;

-- Rend une place (si la création de compte échoue après claim_invite).
create or replace function public.release_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invite_codes
     set used_count = greatest(0, used_count - 1)
   where code = p_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions : clients = seulement les RPC "propriétaire", jamais le reste.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_invite(integer, integer, text) from public, anon;
revoke execute on function public.list_invites()                          from public, anon;
revoke execute on function public.revoke_invite(text)                     from public, anon;
revoke execute on function public.claim_invite(text)   from public, anon, authenticated;
revoke execute on function public.release_invite(text) from public, anon, authenticated;

grant execute on function public.create_invite(integer, integer, text) to authenticated;
grant execute on function public.list_invites()                        to authenticated;
grant execute on function public.revoke_invite(text)                   to authenticated;
