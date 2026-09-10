-- reiim — rappels de devoirs par e-mail (J-7, J-3, J-1) + désinscription.
--
-- Envoi : Edge Function `send-reminders`, déclenchée chaque matin par pg_cron.
-- Ne fait rien tant que le secret RESEND_API_KEY n'est pas posé.

-- ---------------------------------------------------------------------------
-- préférences sur profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email_reminders boolean not null default true;

alter table public.profiles
  add column if not exists unsub_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_unsub_token_key
  on public.profiles (unsub_token);

-- email_reminders = préférence utilisateur (modifiable comme bio).
-- unsub_token = jamais modifiable depuis une session (comme credits/plan).
create or replace function public.profiles_guard_billing()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.credits     is distinct from old.credits
          or new.plan        is distinct from old.plan
          or new.can_invite  is distinct from old.can_invite
          or new.unsub_token is distinct from old.unsub_token) then
    raise exception 'credits/plan/can_invite/unsub_token are managed server-side';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- journal d'envoi (idempotence : un rappel donné n'est envoyé qu'une fois)
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_log (
  devoir_id uuid not null references public.devoirs (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  kind      text not null,                 -- '7d' | '3d' | '1d'
  sent_at   timestamptz not null default now(),
  primary key (devoir_id, user_id, kind)
);
alter table public.reminder_log enable row level security;
-- aucune policy : accessible uniquement au rôle service (Edge Function).

-- ---------------------------------------------------------------------------
-- rappels à envoyer maintenant (propriétaire + membres, seuils J-7/J-3/J-1)
-- Appelée uniquement par l'Edge Function (rôle service).
-- ---------------------------------------------------------------------------
create or replace function public.pending_reminders()
returns table (
  devoir_id   uuid,
  recipient_id uuid,
  email       text,
  name        text,
  d           date,
  subject     text,
  methods     text[],
  kind        text,
  is_own      boolean,
  owner_name  text,
  unsub_token uuid
)
language sql
security definer
set search_path = public
stable
as $$
  with thresholds as (
    select * from (values (7, '7d'), (3, '3d'), (1, '1d')) as t(days, kind)
  ),
  recipients as (
    select dv.id as devoir_id, dv.owner_id as recipient_id,
           dv.d, dv.subject, dv.methods, true as is_own,
           (select name from public.profiles where id = dv.owner_id) as owner_name
    from public.devoirs dv
    union
    select dv.id, m.user_id, dv.d, dv.subject, dv.methods, false,
           (select name from public.profiles where id = dv.owner_id)
    from public.devoirs dv
    join public.devoir_members m on m.devoir_id = dv.id
  )
  select r.devoir_id, r.recipient_id, u.email, p.name,
         r.d, r.subject, r.methods, t.kind, r.is_own, r.owner_name, p.unsub_token
  from recipients r
  join thresholds t on r.d = (current_date + t.days)
  join public.profiles p on p.id = r.recipient_id
  join auth.users u on u.id = r.recipient_id
  where p.email_reminders
    and u.email is not null
    and not exists (
      select 1 from public.reminder_log l
      where l.devoir_id = r.devoir_id
        and l.user_id = r.recipient_id
        and l.kind = t.kind
    )
  order by u.email, r.d;
$$;

create or replace function public.mark_reminder_sent(p_devoir uuid, p_user uuid, p_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.reminder_log (devoir_id, user_id, kind)
  values (p_devoir, p_user, p_kind)
  on conflict do nothing;
$$;

-- Désinscription en un clic depuis le mail (pas de session).
create or replace function public.unsubscribe_reminders(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_found boolean;
begin
  update public.profiles set email_reminders = false
   where unsub_token = p_token
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

-- Ré-inscription (depuis la page de confirmation de désinscription).
create or replace function public.resubscribe_reminders(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_found boolean;
begin
  update public.profiles set email_reminders = true
   where unsub_token = p_token
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;

revoke execute on function public.pending_reminders()                     from public, anon, authenticated;
revoke execute on function public.mark_reminder_sent(uuid, uuid, text)    from public, anon, authenticated;
revoke execute on function public.unsubscribe_reminders(uuid)             from public, anon, authenticated;
revoke execute on function public.resubscribe_reminders(uuid)             from public, anon, authenticated;
