-- reiim — profil public d'un ami (consultation depuis la page « Amis »).
-- N'expose que des champs publics (jamais l'e-mail ni les crédits) et
-- uniquement si l'appelant est ami avec la personne (ou que c'est lui-même).

create or replace function public.public_profile(p_user uuid)
returns table (
  id uuid,
  name text,
  tag text,
  avatar text,
  banner text,
  bio text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.tag, p.avatar, p.banner, p.bio, p.created_at
  from public.profiles p
  where p.id = p_user
    and (
      p_user = auth.uid()
      or exists (
        select 1 from public.friends f
        where f.user_id = auth.uid() and f.friend_id = p_user
      )
    );
$$;

revoke execute on function public.public_profile(uuid) from public, anon;
grant  execute on function public.public_profile(uuid) to authenticated;
