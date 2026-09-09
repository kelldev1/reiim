# reiim — état des lieux

_Dernière mise à jour : 2026-09-09 (Vidéos + Cartes mentales faites ; système d'amis Pseudo#TAG fait — début du partage de devoirs)._
_Ce fichier sert de mémoire entre les sessions. Le lire en premier à la reprise._

## Projet Supabase (réel, en place)

- **Project ref** : `qfnekebcpapprfhjqrry` — région `eu-west-3` (Paris) — org `egomania1's Org`.
- URL : `https://qfnekebcpapprfhjqrry.supabase.co` (dans `.env`, avec l'anon key).
- Migration `20260907120000_init.sql` : **exécutée** (SQL Editor, "Success").
- Edge Function `ai` : **déployée** (`npx supabase functions deploy ai --project-ref qfnekebcpapprfhjqrry --use-api`).
- Secret `LLM_API_KEY` : présent (contenait la clé Mistral — **à remplacer par la clé Anthropic**).
- « Confirm email » : **désactivé** (pour tester — à réactiver avant lancement).
- Compte test : `kelian.luye@gmail.com`.

---

## 1. C'est quoi reiim

Outil pour élèves (collège / lycée, France) qui sert à **faire ses devoirs EN AVANCE**.
Deux volets :
- **Planifier** : un calendrier où on glisse un « devoir » sur un jour, on choisit une
  **matière** + une ou **plusieurs méthodes d'apprentissage**.
- **Faire / résoudre** : chaque méthode a un espace de travail. Certaines méthodes ont
  aussi un **assistant IA** qui résout l'exercice et montre la démarche.

Vision affinée par l'utilisateur : « ce n'est pas qu'un planificateur, il doit être
capable de résoudre un devoir et de le faire à l'avance — et ensuite tu as les manières
d'apprendre ». Objectif : **commercialiser** le site plus tard.

Stack : Vite + React + TypeScript + Tailwind + framer-motion@10 + three.js (fond animé).
`vite-plugin-checker` (erreurs TS en overlay). `npm run build` = `tsc --noEmit && vite build`.

---

## 2. Ce qui est FAIT et fonctionne

### Thème / design
- Thème clair repassé en **noir & blanc** (avant : vert/rose bizarre). Fond shader
  monochrome. `--color-bg` / `--color-fg` / `--color-surface` = triplets **RGB**
  consommés via `rgb(var(--…))` (bug latent `hsl()` corrigé).
- Loader de démarrage = composant **beui** multi-variants (`src/components/ui/loader.tsx`),
  importé sur `framer-motion` (pas le paquet `motion`). Variant utilisé : `metaballs`,
  changeable dans `src/components/ui/boot-screen.tsx` (`VARIANT`).

### Auth + navigation
- **Auth réécrite sur Supabase** (le mock localStorage a été SUPPRIMÉ le 2026-09-07).
  `src/lib/auth.tsx` — même API `useAuth()` : `{ user, loading, login, signup, logout,
  updateProfile, refreshProfile }`. `user` a maintenant `credits` et `plan`.
- Écran login / créer un compte : `src/components/ui/auth-screen.tsx` (toggle animé,
  message « confirme ton e-mail »).
- Gate : pas connecté → écran d'auth. Connecté → loader court → Dashboard.
- Navbar : avatar (photo ou initiales) → page Profil.

### Page Profil (`src/components/ui/profile.tsx`)
- Header + avatar qui déborde, upload de **photo de profil** (redimensionnée 256px JPEG
  via canvas, stockée en data-URL), suppression, bio, mode édition, stats
  (**Crédits IA**, Activités planifiées, Membre depuis), switch thème, déconnexion.

### Calendrier (`src/components/ui/visualize-booking.tsx`)
- **Glisser-déposer** : pastille « Nouveau devoir » → on la lâche sur un jour → la carte
  s'ouvre sur ce jour. HTML5 DnD (marche pas sur mobile → le clic sur un jour marche
  aussi).
- Devoirs planifiés affichés sur les cases (pastille couleur matière + `×N` si plusieurs
  méthodes), re-glissables d'un jour à l'autre.
- Carte de sélection en 2 temps : choisir matière (chips) + **méthodes multiples** (pills
  toggle) → « Planifier » → bascule sur **l'espace de travail** (ne ferme pas). En-tête
  « Changer », bouton « Supprimer ».
- Vue « Liste » (toggle) : les devoirs du mois, cliquables.
- Persistance : `reiim-learning-selections` (clé `${year}-${month+1}-${day}`).
  `Selection = { subject: string, methods: string[] }` (migration auto depuis l'ancien
  `method` unique).

### Espaces de travail par méthode (`src/components/ui/method-workspaces.tsx`)
Persistés dans `reiim-devoir-work` (hook `useWork` de `src/lib/devoir-work.ts`),
indexés par jour × slot méthode.

| Méthode | Espace |
|---|---|
| **Exercices pratiques** (`exercices`) | **Assistant IA qui FAIT le devoir**. Si c'est la seule méthode → carte **plein écran** en 2 colonnes : à gauche l'**énoncé** (upload d'un **PDF** visualisé + zone texte), à droite le **corrigé** rendu en Markdown + maths KaTeX, bouton **Copier**. Bouton « Faire le devoir » / « Refaire ». Le PDF est envoyé tel quel à Claude (document block). Décompte des crédits. PDF gardé en mémoire (pas persisté — voir backlog). |
| Vidéos explicatives (`vidéos`) | Recherche YouTube (Edge Function `videos`), lecteur intégré, épinglage + notes ; plein écran |
| Projets concrets (`projets`) | Checklist d'étapes + barre de progression |
| Étude en groupe (`discussion`) | Quand / Où, participants (chips), points à aborder |
| Cartes mentales (`mindmap`) | **Carte radiale visuelle** : nœud central + branches qui rayonnent, connecteurs colorés, édition inline, +/− branche, plein écran, génération IA gratuite |
| Flashcards & mémorisation (`flashcards`) | Encadré « Méthode de révision » (rien à préparer) |

**Méthodes retirées le 2026-09-09** (commit `a6e256c`) : Lecture & notes (`lecture`),
Podcasts & audio (`podcast`), Simulations & labos (`simulation`), Lecture active & synthèse
(`lecture_active`). Il ne reste que les 6 ci-dessus. Composants morts supprimés
(`AudioWorkspace`, `SynthesisWorkspace`, `TextList`).

### Backend IA (déployé le 2026-09-07)
- `supabase/migrations/20260907120000_init.sql` : tables `profiles` + `ai_usage`, RLS,
  triggers, fonctions `deduct_ai_credit` / `refund_ai_credit`. **Exécutée.**
- `supabase/functions/ai/index.ts` : proxy Edge Function. Vérifie JWT → rate-limit
  1 req/5 s → débite 1 crédit (atomique, remboursé si échec) → **Claude Opus 5**
  (`claude-opus-5`, effort `high`, `max_tokens` 8000, prompt système avec exigence de
  vérification des calculs, SDK `npm:@anthropic-ai/sdk@0.124.0`) → logue les tokens.
  Accepte un PDF (`document` block). **La clé API vit uniquement là** (secret `LLM_API_KEY`).
  Passé de sonnet-5/medium → opus-5/high le 2026-09-07 soir (réponses sonnet jugées fausses
  sur un devoir de maths avancé). Coût ≈ 3–8 c/devoir. Réglable : `MODEL` / `EFFORT`.
- `src/lib/supabase.ts` (client), `src/lib/ai.ts` (`askAI()` — ajoute l'entête `apikey`).
- `SETUP.md` à la racine = la marche à suivre.

**Détour Mistral (abandonné).** Entre-temps on a essayé Mistral (offre gratuite, pour
éviter de payer). Échec : l'API Mistral renvoie `x-ratelimit-limit-req-minute: 0` tant
qu'on n'a pas « Activé PAYG » (infos de facturation **+ carte** obligatoires) — l'offre
« Gratuit » seule ne donne aucun accès API. Gemini : indispo en France. Donc **retour à
Claude**, l'utilisateur met 5 € de crédit sur la console Anthropic.

**Build + typecheck : VERTS.** L'Edge Function (Deno) n'est pas typecheckée localement.

---

## 3. OÙ ON S'ARRÊTE — prochaine étape

**Dashboard synchronisé avec Supabase (commit `798dd99`).** L'ancien `dashboard.tsx` était
le template « réservations » (chiffres bidon). Il affiche maintenant les vraies données :
KPIs (devoirs planifiés / à venir / cette semaine / crédits IA), « Devoirs à venir par
semaine », « Répartition par matière » (donut aux couleurs des matières), « Prochains
devoirs » (cliquable → calendrier), heatmap du mois, « Méthodes d'apprentissage ». États
vides soignés. Le panneau de personnalisation du fond est descendu en bas.

**⚠️ Régression RLS de l'étape 4 — trouvée et corrigée (migration `20260909150000`, lancée).**
La policy `devoirs_read` (via `can_access_devoir(id)`) faisait échouer TOUS les upserts de
devoirs en 403 (`new row violates RLS`), avalé en silence par l'appli → rien ne se
sauvegardait. Corrigé : les policies testent `owner_id` / l'appartenance en ligne. Détail
dans [[reiim-gotchas]]. Les devoirs de test créés avant le correctif sont perdus.

**Social / partage : les 5 étapes du plan §4 sont codées + migrations lancées + build vert.**
Reste à valider avec un 2e compte : accepter une demande d'ami, inviter l'ami sur un devoir,
ouvrir le devoir côté invité (doit tout voir, en lecture seule), et vérifier la synchro
temps réel (une édition d'un côté apparaît de l'autre).

**Autre chantier ouvert : les espaces de travail des méthodes d'apprentissage.**

✅ **« Vidéos explicatives » — FAIT et testé (2026-09-09).**
- Edge Function `supabase/functions/videos/index.ts` : proxy YouTube Data API v3, vérifie
  le JWT, recherche FR, remonte les chaînes pédago FR (allowlist `TRUSTED`). Pas de crédit.
  Secret **`YT_API_KEY`** en place (clé « Clé API 2 » du projet Google Cloud
  `smart-oasis-467805-p3`, restreinte à YouTube Data API v3).
- `src/lib/videos.ts` + `VideoWorkspace` dans `method-workspaces.tsx` : recherche → cartes →
  lecteur `youtube-nocookie` intégré + épinglage + cases « vu » + notes. Plein écran (bigMode)
  quand `vidéos` est la seule méthode.
- Testé : recherche « dérivée d'une fonction » → 15 vidéos, Yvan Monka en tête, lecteur OK.

✅ **« Cartes mentales » — FAIT (2026-09-09).** `MindMapWorkspace` : carte radiale visuelle
(bulles `<textarea>` auto-hauteur, connecteurs Bézier, pastilles couleur niveau 1, fond
pointillé, vue recentrée). Bouton **« Générer » GRATUIT** (feature `mindmap` dans la fonction
`ai` : Sonnet 5, effort medium, prompt strict-JSON + exigence d'exactitude, PAS de crédit).

⏭️ **Méthodes restantes sans espace** : **Lecture & notes**, **Flashcards & mémorisation**,
**Simulations & labos**.

---

## 4. SOCIAL / PARTAGE DE DEVOIRS — les 5 étapes FAITES (reste : test à 2 comptes)

But utilisateur : « j'invite un ami sur un devoir → il voit tout (corrigé, carte, notes) ».
Plan en 5 étapes :
1. ✅ **Système d'amis `Pseudo#TAG` — FAIT + migration lancée (2026-09-09).**
   - `20260909120000_friends.sql` exécutée (SQL Editor). `profiles.tag` (4 car., unique, auto).
     Compte actuel = **riley#CQ2W**. Tables `friend_requests` + `friends` (RLS lecture seule,
     écritures via fonctions security-definer). `src/lib/friends.ts`, `avatar.tsx`, page
     `friends.tsx` (onglet « Amis » + badge). `name#tag` sur le profil.
   - Testé : recherche + envoi de demande OK. Pas encore testé : accept à 2 comptes.
2. ✅ **Devoirs → Supabase — FAIT + migration lancée (2026-09-09).**
3. ✅ **Contenu des espaces → Supabase — FAIT.**
   - `20260909130000_devoirs.sql` exécutée : tables `devoirs` (unique `owner_id`+`d`) +
     `devoir_work` (`data jsonb` par slot), RLS propriétaire, triggers `updated_at`.
   - `src/lib/devoirs.ts` (list/upsert/delete/move + load/saveWork). `src/lib/devoir-work.tsx`
     (`DevoirWorkProvider` charge à l'ouverture, `useWork` lit/écrit via contexte, save
     débounce 600 ms + flush à la fermeture). `visualize-booking` : devoirs indexés par date
     ISO, `workKey` = id du devoir, import unique du localStorage (flag `reiim-devoirs-migrated`).
   - **Testé** : créer un devoir + éditer une carte mentale → rechargement → tout revient.
   - localStorage n'est PLUS la source de vérité pour les devoirs.
4. ✅ **Partage — FAIT + migration lancée (2026-09-09).**
   - `20260909140000_devoir_sharing.sql` exécutée. Table `devoir_members` (owner + amis
     invités), RLS `devoirs`/`devoir_work` passée de « propriétaire » à « propriétaire OU
     membre » (lecture partagée, écriture du devoir lui-même = propriétaire seul). Fonctions
     security-definer : `invite_to_devoir` / `remove_devoir_member` / `list_devoir_members` /
     `list_shared_devoirs`.
   - **⚠️ `20260909150000_devoir_rls_fix.sql` (correctif obligatoire, lancé).** La policy
     `devoirs_read` via `can_access_devoir(id)` faisait échouer TOUS les upserts de devoirs
     (`.upsert()` PostgREST → `INSERT ... ON CONFLICT DO UPDATE RETURNING` → Postgres applique
     la policy SELECT à la nouvelle ligne, que `can_access_devoir` ne voit pas → 403). Les
     policies testent maintenant `owner_id` / l'appartenance directement sur la ligne.
     `devoir_members_visible` réduite à `user_id = auth.uid()`. Détail : [[reiim-gotchas]].
   - `src/lib/devoirs.ts` : `listDevoirs()` fusionne mes devoirs + ceux partagés (RPC
     `list_shared_devoirs`, collision de date → le mien gagne) ; `Devoir.shared`/`ownerHandle` ;
     `inviteToDevoir` / `removeDevoirMember` / `listDevoirMembers`.
   - `visualize-booking.tsx` : `<MembersBar>` (avatars des membres + bouton « Inviter un ami »
     → menu déroulant des amis pas encore membres). Carte de l'invité en lecture seule (pas de
     « Changer », bouton « Quitter ce devoir partagé » au lieu de « Supprimer »). Pastille
     « partagé » sur la case du calendrier. `deleteSelection` route vers `removeDevoirMember`
     si `shared`, sinon `deleteDevoir`.
   - **Testé (1 compte, après le correctif)** : créer un devoir → rechargement → il persiste,
     le dashboard le compte ; `MembersBar` s'affiche, menu « Inviter un ami » liste les amis
     (vide → message OK), upsert `devoir_work` OK. Pas encore testé : invitation réelle + vue
     de l'invité (besoin d'un 2e compte).
5. ✅ **Temps réel — FAIT (2026-09-09).**
   - `devoir_work` + `devoir_members` ajoutées à la publication `supabase_realtime`.
   - `DevoirWorkProvider` s'abonne au canal `devoir_work:<devoirId>` (postgres_changes,
     filtre `devoir_id=eq.<id>`), ignore l'écho de ses propres écritures (compare JSON), met à
     jour `work[slot]`. `useWork` adopte la valeur serveur tant que le champ n'a pas été
     édité localement (`serverVal` dans les deps du `useEffect` d'adoption).
   - Pas testable à 1 compte ; code en place, publication configurée.

---

Redonner des crédits IA pendant les tests (SQL Editor) :
`update public.profiles set credits = 100 where email = 'kelian.luye@gmail.com';`

### Ensuite (backlog commercialisation, dans SETUP.md aussi)
- [ ] **Paiement** : Lemon Squeezy (merchant of record, gère la TVA UE) ou Stripe +
      webhook qui recharge `profiles.credits`
- [ ] **Rate limit dur** (Upstash Redis / verrou Postgres) — l'actuel est « soft »
- [ ] **Captcha** inscription (hCaptcha, gratuit)
- [ ] **Streaming** de la réponse IA (SSE depuis la fonction) pour l'UX
- [ ] **RGPD** : mentions légales, consentement, région Supabase `eu-*`
- [ ] **PDF persistant** : bucket Supabase Storage (RLS par user) au lieu du blob en mémoire
      — actuellement le PDF de l'énoncé est reperdu au rechargement de la page
- [ ] Brancher d'autres méthodes sur l'assistant si utile (l'utilisateur avait dit :
      exercices + peut-être générer des exos d'entraînement / corriger)
- [ ] Bundle JS = 1 MB (293 KB gzip) depuis l'ajout de supabase-js → code-splitting

---

## 4. Décisions prises (ne pas re-débattre)

- **Auth obligatoire** (pas skippable), **comptes = Supabase** (avant : mock localStorage).
- **Loader** = composant beui, à chaque ouverture de l'app, atterrit sur le Dashboard.
- **Modèle IA = Claude Sonnet 5** (choix coût/qualité de l'utilisateur ; ~1,5–2,5 c/requête
  avec cache). Réglable en une constante `MODEL` / `EFFORT` dans la fonction.
- **Sélection multiple de méthodes** : les espaces de travail s'empilent.
- **Méthodes sans IA pour l'instant** (juste rappel de révision) : Vidéos, Lecture & notes,
  Flashcards, Simulations & labos. (Exercices pratiques : avait été mis là au départ, puis
  l'utilisateur a demandé d'y ajouter l'IA — c'est fait.)
- **Commercialisation gratuite impossible** : free tier = dev only, quotas, clé exposée.
  Solution retenue = backend-proxy + crédits + plafond de dépense + paiement.

---

## 5. Points d'attention / pièges connus

- **Mistral offre gratuite = piège** : l'API renvoie `429 "Rate limit exceeded"` avec
  `x-ratelimit-limit-req-minute: 0` en permanence tant que « PAYG » n'est pas activé
  (carte bancaire obligatoire). Le plan « Gratuit » et la vérif téléphone ne suffisent
  pas. Ne pas y retourner sans carte.
- **Déploiement Edge Function** : `--use-api` évite Docker. `npx supabase login` ne marche
  PAS en non-TTY (il faut le vrai terminal de l'utilisateur). Le dashboard Supabase
  (pages Edge Functions → Code / Logs) était cassé toute la session (cascade Usercentrics) ;
  Secrets et SQL Editor marchaient.
- **`prefers-reduced-motion` + framer-motion@10 + React.StrictMode** = pages figées à
  `opacity:0` (blanches). Corrigé le 2026-09-07 : `<React.StrictMode>` retiré de
  `main.tsx`, `AnimatePresence mode="wait"` retiré partout (deadlock), `<MotionConfig
  reducedMotion="user">` ajouté dans `App.tsx`. **Ne pas remettre StrictMode ni
  `mode="wait"`.**
- Les captures d'écran plein écran de l'app rendent parfois **blanc** à cause du canvas
  WebGL du fond — utiliser `zoom` sur une région pour vérifier le rendu réel.
- `src/components/LearningCalendar.tsx` = **code mort** (dupliqué, pas importé). Erreurs TS
  corrigées mais le fichier pourrait être supprimé.
- `visualize-booking.tsx` : indentation du `return` un peu décalée après retrait d'un
  wrapper — cosmétique, Prettier réglera.
- Fond animé (`AuraBackground`) : le hot-swap de shader au changement de style ne
  fonctionne pas parfaitement (three.js `material.fragmentShader` + `needsUpdate`).
- Machine de l'utilisateur : « réduire les animations » activé, Windows 11, dev sur
  `H:\reiim`, terminal Git Bash au départ (bug « claude crash » au début de session =
  MinTTY, résolu en passant à Windows Terminal / le binaire natif marchait).

---

## 6. Fichiers clés

```
src/
  App.tsx                     Root : loader → gate auth → AppShell (dashboard/calendrier/profil)
  main.tsx                    PAS de StrictMode (voir §5)
  lib/
    auth.tsx                  AuthProvider sur Supabase + useAuth()
    supabase.ts               client Supabase
    ai.ts                     askAI() → Edge Function
    devoir-work.ts            useWork() — persistance localStorage des espaces de travail
    background.tsx / theme.tsx  providers fond animé + thème
  components/ui/
    visualize-booking.tsx     LE calendrier + DnD + carte devoir (gros fichier)
    method-workspaces.tsx     les 6 espaces + ExerciseWorkspace (IA) + dispatcher
    dashboard.tsx / navbar.tsx / profile.tsx / auth-screen.tsx / boot-screen.tsx
    loader.tsx                composant beui multi-variants
    background.tsx            AuraBackground (shader three.js)
supabase/
  migrations/…_init.sql       schéma BDD
  functions/ai/index.ts       proxy IA (Deno)
  config.toml
SETUP.md                      marche à suivre config (à faire par l'utilisateur)
.env.example
```

Storage localStorage : `reiim-theme`, `reiim-learning-selections`, `reiim-devoir-work`.
Supabase gère la session auth (plus de `reiim-users` / `reiim-session`).
