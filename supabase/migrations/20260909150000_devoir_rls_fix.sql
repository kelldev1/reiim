-- reiim — corrige la régression RLS introduite par 20260909140000.
--
-- Symptôme : créer un devoir renvoyait 403
--   « new row violates row-level security policy for table "devoirs" »
--   → aucun devoir ne se sauvegardait (l'appli avalait l'erreur en silence).
--
-- Cause : la policy SELECT « devoirs_read » passait par can_access_devoir(id),
-- une sous-requête sur public.devoirs. Or PostgREST fait un
--   INSERT ... ON CONFLICT DO UPDATE ... RETURNING
-- et Postgres applique alors la policy SELECT à la ligne fraîchement insérée
-- pour pouvoir la renvoyer. can_access_devoir(nouvel_id) ne « voit » pas encore
-- cette ligne → renvoie false → la ligne est refusée.
--
-- Correctif : évaluer l'accès directement sur la colonne owner_id de la ligne
-- (disponible dès l'insertion) OR une sous-requête simple sur devoir_members
-- (sans repasser par public.devoirs → pas de récursion entre les deux policies).

-- ---------------------------------------------------------------------------
-- devoir_members : chacun ne voit QUE ses propres appartenances.
-- (Le propriétaire liste les membres via list_devoir_members, SECURITY DEFINER.)
-- Casse aussi la récursion potentielle devoir_members -> devoirs -> devoir_members.
-- ---------------------------------------------------------------------------
drop policy if exists "devoir_members_visible" on public.devoir_members;
create policy "devoir_members_visible" on public.devoir_members for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- devoirs : lecture = propriétaire OU membre invité, évalué « en ligne ».
-- ---------------------------------------------------------------------------
drop policy if exists "devoirs_owner_all" on public.devoirs;
drop policy if exists "devoirs_read" on public.devoirs;
drop policy if exists "devoirs_owner_write" on public.devoirs;
drop policy if exists "devoirs_owner_update" on public.devoirs;
drop policy if exists "devoirs_owner_delete" on public.devoirs;

create policy "devoirs_read" on public.devoirs for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.devoir_members m
      where m.devoir_id = devoirs.id and m.user_id = auth.uid()
    )
  );
create policy "devoirs_owner_write" on public.devoirs for insert
  with check (owner_id = auth.uid());
create policy "devoirs_owner_update" on public.devoirs for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "devoirs_owner_delete" on public.devoirs for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- devoir_work : même logique « en ligne » (on abandonne can_access_devoir sur
-- le chemin d'upsert). La sous-requête sur devoirs déclenche devoirs_read
-- ci-dessus — pas de récursion, devoir_work n'est jamais référencé en retour.
-- ---------------------------------------------------------------------------
drop policy if exists "devoir_work_via_owned_devoir" on public.devoir_work;
drop policy if exists "devoir_work_access" on public.devoir_work;

create policy "devoir_work_access" on public.devoir_work for all
  using (
    exists (
      select 1 from public.devoirs dv
      where dv.id = devoir_work.devoir_id
        and (
          dv.owner_id = auth.uid()
          or exists (
            select 1 from public.devoir_members m
            where m.devoir_id = dv.id and m.user_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.devoirs dv
      where dv.id = devoir_work.devoir_id
        and (
          dv.owner_id = auth.uid()
          or exists (
            select 1 from public.devoir_members m
            where m.devoir_id = dv.id and m.user_id = auth.uid()
          )
        )
    )
  );

-- can_access_devoir() reste utilisée par list_devoir_members / list_shared_devoirs
-- (SECURITY DEFINER, hors chemin d'écriture) — on la garde telle quelle.
