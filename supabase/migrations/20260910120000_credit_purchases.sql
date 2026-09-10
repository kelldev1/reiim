-- reiim — achats de crédits IA (paiement via Lemon Squeezy).
-- Le webhook (Edge Function `lemon-webhook`, service role) crédite le compte ;
-- rien de tout ça n'est écrivable depuis une session utilisateur.

create table if not exists public.credit_purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  credits      integer not null check (credits > 0),
  amount_cents integer,                 -- montant payé, en centimes (info)
  currency     text,
  source       text not null default 'lemonsqueezy',
  external_id  text not null,           -- id de commande du prestataire (idempotence)
  created_at   timestamptz not null default now(),
  unique (source, external_id)
);

alter table public.credit_purchases enable row level security;

-- L'utilisateur voit son propre historique d'achats ; il n'écrit jamais.
create policy "credit_purchases_read_own" on public.credit_purchases
  for select using (auth.uid() = user_id);

create index if not exists credit_purchases_user_time
  on public.credit_purchases (user_id, created_at desc);

-- Ajoute des crédits de façon ATOMIQUE et IDEMPOTENTE (rejoue le webhook sans
-- risque). Renvoie le nouveau solde, ou -1 si la commande a déjà été traitée.
create or replace function public.add_ai_credits(
  p_user uuid,
  p_credits integer,
  p_source text,
  p_external_id text,
  p_amount_cents integer default null,
  p_currency text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'p_credits doit être > 0';
  end if;

  insert into public.credit_purchases
    (user_id, credits, amount_cents, currency, source, external_id)
  values
    (p_user, p_credits, p_amount_cents, p_currency, coalesce(p_source, 'lemonsqueezy'), p_external_id)
  on conflict (source, external_id) do nothing;

  if not found then
    return -1; -- déjà traité, on ne recrédite pas
  end if;

  update public.profiles
     set credits = credits + p_credits
   where id = p_user
  returning credits into new_balance;

  return coalesce(new_balance, -1);
end;
$$;

-- Clients : interdit d'appeler directement.
revoke execute on function
  public.add_ai_credits(uuid, integer, text, text, integer, text)
  from anon, authenticated;
