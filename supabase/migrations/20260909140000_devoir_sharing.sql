-- reiim — partage de devoirs (étape 4/5). On invite un ami sur un devoir :
-- il peut lire le devoir et lire/écrire le contenu des espaces de travail.
-- Seul le propriétaire peut modifier/supprimer le devoir lui-même.

-- ---------------------------------------------------------------------------
-- membres invités (le propriétaire reste identifié par devoirs.owner_id)
-- ---------------------------------------------------------------------------
create table if not exists public.devoir_members (
  devoir_id uuid not null references public.devoirs (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (devoir_id, user_id)
);
alter table public.devoir_members enable row level security;

drop policy if exists "devoir_members_visible" on public.devoir_members;
create policy "devoir_members_visible" on public.devoir_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.devoirs dv
      where dv.id = devoir_members.devoir_id and dv.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- helper : ai-je accès à ce devoir (propriétaire ou membre) ?
-- ---------------------------------------------------------------------------
create or replace function public.can_access_devoir(p_devoir uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.devoirs dv where dv.id = p_devoir and dv.owner_id = auth.uid())
      or exists (select 1 from public.devoir_members m where m.devoir_id = p_devoir and m.user_id = auth.uid());
$$;
grant execute on function public.can_access_devoir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS : on remplace "propriétaire uniquement" par "propriétaire ou membre"
-- ---------------------------------------------------------------------------
drop policy if exists "devoirs_owner_all" on public.devoirs;
drop policy if exists "devoirs_read" on public.devoirs;
drop policy if exists "devoirs_owner_write" on public.devoirs;
drop policy if exists "devoirs_owner_update" on public.devoirs;
drop policy if exists "devoirs_owner_delete" on public.devoirs;

create policy "devoirs_read" on public.devoirs for select
  using (public.can_access_devoir(id));
create policy "devoirs_owner_write" on public.devoirs for insert
  with check (owner_id = auth.uid());
create policy "devoirs_owner_update" on public.devoirs for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "devoirs_owner_delete" on public.devoirs for delete
  using (owner_id = auth.uid());

drop policy if exists "devoir_work_via_owned_devoir" on public.devoir_work;
drop policy if exists "devoir_work_access" on public.devoir_work;
create policy "devoir_work_access" on public.devoir_work for all
  using (public.can_access_devoir(devoir_id))
  with check (public.can_access_devoir(devoir_id));

-- ---------------------------------------------------------------------------
-- fonctions d'invitation
-- ---------------------------------------------------------------------------

-- Inviter un ami sur un devoir dont je suis propriétaire.
create or replace function public.invite_to_devoir(p_devoir uuid, p_friend uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.devoirs where id = p_devoir and owner_id = me) then
    return 'not-owner';
  end if;
  if not exists (select 1 from public.friends where user_id = me and friend_id = p_friend) then
    return 'not-friend';
  end if;
  if exists (select 1 from public.devoirs where id = p_devoir and owner_id = p_friend) then
    return 'already-member';
  end if;
  insert into public.devoir_members (devoir_id, user_id)
  values (p_devoir, p_friend)
  on conflict do nothing;
  return 'ok';
end;
$$;

-- Retirer un membre (propriétaire) ou se retirer soi-même (membre).
create or replace function public.remove_devoir_member(p_devoir uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if p_user = me
     or exists (select 1 from public.devoirs where id = p_devoir and owner_id = me) then
    delete from public.devoir_members where devoir_id = p_devoir and user_id = p_user;
  end if;
end;
$$;

-- Membres d'un devoir (propriétaire + invités) avec leurs champs publics.
create or replace function public.list_devoir_members(p_devoir uuid)
returns table (user_id uuid, name text, tag text, avatar text, role text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.tag, p.avatar, 'owner'
  from public.devoirs dv join public.profiles p on p.id = dv.owner_id
  where dv.id = p_devoir and public.can_access_devoir(p_devoir)
  union all
  select p.id, p.name, p.tag, p.avatar, 'member'
  from public.devoir_members m join public.profiles p on p.id = m.user_id
  where m.devoir_id = p_devoir and public.can_access_devoir(p_devoir);
$$;

-- Devoirs partagés avec moi (dont je ne suis PAS propriétaire), + le propriétaire.
create or replace function public.list_shared_devoirs()
returns table (
  id uuid, d date, subject text, methods text[],
  owner_name text, owner_tag text
)
language sql
security definer
set search_path = public
as $$
  select dv.id, dv.d, dv.subject, dv.methods, p.name, p.tag
  from public.devoir_members m
  join public.devoirs dv on dv.id = m.devoir_id
  join public.profiles p on p.id = dv.owner_id
  where m.user_id = auth.uid()
  order by dv.d;
$$;

grant execute on function public.invite_to_devoir(uuid, uuid)     to authenticated;
grant execute on function public.remove_devoir_member(uuid, uuid) to authenticated;
grant execute on function public.list_devoir_members(uuid)        to authenticated;
grant execute on function public.list_shared_devoirs()            to authenticated;

-- ---------------------------------------------------------------------------
-- temps réel (étape 5) : publier les changements de contenu
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.devoir_work;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.devoir_members;
exception when duplicate_object then null;
end $$;
