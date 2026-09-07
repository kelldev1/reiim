-- reiim — auth profiles, AI credits, and usage log.
-- Applied with `supabase db push` (or `supabase migration up`).

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holds display fields + AI credits
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  avatar     text,          -- data-URL (small, downscaled client-side)
  bio        text,
  credits    integer not null default 5,
  plan       text    not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read and update *their own* row...
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ...but `credits` and `plan` must never be writable from a user session.
-- Service-role calls (the Edge Function) have auth.uid() = null and pass through.
create or replace function public.profiles_guard_billing()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.credits is distinct from old.credits
          or new.plan is distinct from old.plan) then
    raise exception 'credits/plan are managed server-side';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_billing on public.profiles;
create trigger profiles_guard_billing
  before update on public.profiles
  for each row execute function public.profiles_guard_billing();

-- Auto-create the profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ai_usage: one row per successful model call (for analytics / billing)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  feature             text,
  model               text,
  input_tokens        integer,
  output_tokens       integer,
  cached_input_tokens integer,
  created_at          timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

create policy "ai_usage: read own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

create index if not exists ai_usage_user_time
  on public.ai_usage (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- credit ops — called ONLY by the Edge Function (service role)
-- ---------------------------------------------------------------------------

-- Atomically spend one credit. Returns the new balance, or -1 if none left.
create or replace function public.deduct_ai_credit(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
     set credits = credits - 1
   where id = p_user
     and credits > 0
  returning credits into remaining;

  if not found then
    return -1;
  end if;
  return remaining;
end;
$$;

-- Give a credit back (used when the model call fails after deduction).
create or replace function public.refund_ai_credit(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set credits = credits + 1 where id = p_user;
end;
$$;

-- Lock the credit functions down: clients cannot call them directly.
revoke execute on function public.deduct_ai_credit(uuid) from anon, authenticated;
revoke execute on function public.refund_ai_credit(uuid) from anon, authenticated;
