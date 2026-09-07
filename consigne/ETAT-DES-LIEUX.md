# reiim — état des lieux

_Dernière mise à jour : 2026-09-07 (soir — Supabase configuré, retour à Claude après un détour Mistral)._
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
| **Exercices pratiques** (`exercices`) | **Assistant IA** : colle l'énoncé → « M'aider à le faire » → réponse détaillée + démarche. Décompte des crédits. |
| Projets concrets (`projets`) | Checklist d'étapes + barre de progression |
| Étude en groupe (`discussion`) | Quand / Où, participants (chips), points à aborder |
| Cartes mentales (`mindmap`) | Arbre d'idées (5 niveaux) |
| Podcasts & audio (`podcast`) | Liste de ressources (titre, lien, note, coché) |
| Lecture active & synthèse (`lecture_active`) | Idées clés / Questions / synthèse |
| Vidéos, Lecture & notes, Flashcards, Simulations & labos | Encadré « Méthode de révision » (rien à préparer) |

### Backend IA (déployé le 2026-09-07)
- `supabase/migrations/20260907120000_init.sql` : tables `profiles` + `ai_usage`, RLS,
  triggers, fonctions `deduct_ai_credit` / `refund_ai_credit`. **Exécutée.**
- `supabase/functions/ai/index.ts` : proxy Edge Function. Vérifie JWT → rate-limit
  1 req/5 s → débite 1 crédit (atomique, remboursé si échec) → **Claude Sonnet 5**
  (`claude-sonnet-5`, effort `medium`, `max_tokens` 4000, prompt système caché,
  SDK `npm:@anthropic-ai/sdk@0.124.0`) → logue les tokens. **La clé API vit uniquement là**
  (secret `LLM_API_KEY`).
- `src/lib/supabase.ts` (client), `src/lib/ai.ts` (`askAI()` — ajoute l'entête `apikey`).
- `SETUP.md` à la racine = la marche à suivre.

**Détour Mistral (abandonné).** Entre-temps on a essayé Mistral (offre gratuite, pour
éviter de payer). Échec : l'API Mistral renvoie `x-ratelimit-limit-req-minute: 0` tant
qu'on n'a pas « Activé PAYG » (infos de facturation **+ carte** obligatoires) — l'offre
« Gratuit » seule ne donne aucun accès API. Gemini : indispo en France. Donc **retour à
Claude**, l'utilisateur met 5 € de crédit sur la console Anthropic.

**Build + typecheck : VERTS.** L'Edge Function (Deno) n'est pas typecheckée localement.

---

## 3. OÙ ON S'ARRÊTE — prochaine étape immédiate

Supabase est configuré. Il reste à **brancher la clé Anthropic** :

1. **console.anthropic.com → Billing** : ajouter **5 € de crédit**.
2. **console.anthropic.com → API keys** : créer une **nouvelle** clé (`sk-ant-…`).
   ⚠️ NE PAS réutiliser l'ancienne clé collée dans le chat au début de session (compromise).
3. Mettre à jour le secret Supabase :
   `npx supabase secrets set LLM_API_KEY=sk-ant-… --project-ref qfnekebcpapprfhjqrry`
   (ou Dashboard → Edge Functions → Secrets → éditer `LLM_API_KEY`).
4. Redéployer : `npx supabase functions deploy ai --project-ref qfnekebcpapprfhjqrry --use-api`
5. (option) Anthropic Console → **Limits** : fixer un plafond de dépense mensuel bas.

Puis tester : connecté sur `localhost:3000` → Calendrier → glisser un devoir → matière +
« Exercices pratiques » → Planifier → coller un énoncé → « M'aider à le faire »
(consomme 1 crédit ; 5 crédits offerts à l'inscription).

Redonner des crédits pendant les tests (SQL Editor) :
`update public.profiles set credits = 100 where email = 'kelian.luye@gmail.com';`

### Ensuite (backlog commercialisation, dans SETUP.md aussi)
- [ ] **Paiement** : Lemon Squeezy (merchant of record, gère la TVA UE) ou Stripe +
      webhook qui recharge `profiles.credits`
- [ ] **Rate limit dur** (Upstash Redis / verrou Postgres) — l'actuel est « soft »
- [ ] **Captcha** inscription (hCaptcha, gratuit)
- [ ] **Streaming** de la réponse IA (SSE depuis la fonction) pour l'UX
- [ ] **RGPD** : mentions légales, consentement, région Supabase `eu-*`
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
