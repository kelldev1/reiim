-- reiim — bannière de profil (image de couverture).
-- Même principe que profiles.avatar : petite image redimensionnée côté client,
-- stockée en data-URL. Modifiable par l'utilisateur sur sa propre ligne.

alter table public.profiles
  add column if not exists banner text;
