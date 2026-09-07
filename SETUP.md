# Mise en route — backend IA (Supabase + proxy)

Le calendrier / les espaces de travail marchent en local sans rien.
**L'auth (comptes) et l'assistant IA ont besoin de Supabase** — ~15 min à configurer, gratuit.

Architecture : le navigateur ne parle jamais au modèle. Il passe par une **Edge Function**
(`supabase/functions/ai`) qui détient la clé API, vérifie les crédits de l'utilisateur et
limite le débit.

```
React  →  Edge Function "ai"  →  API Claude
          (clé API ICI, jamais dans le bundle)
```

---

## 1. Projet Supabase

1. https://supabase.com → **New project** (plan gratuit).
2. **Project Settings → API**, récupère :
   - `Project URL`
   - `anon` `public` key
   - `service_role` key (secret — ne jamais la mettre dans le front)

## 2. Variables front

```bash
cp .env.example .env
```

Remplis `.env` :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

(Ces deux valeurs sont publiques, elles peuvent être dans le bundle.)

## 3. CLI Supabase + base de données

```bash
npm i -g supabase              # ou : brew install supabase/tap/supabase
supabase login
supabase link --project-ref xxxx   # le "ref" est dans l'URL du projet
supabase db push                   # applique supabase/migrations/*.sql
```

Ça crée : table `profiles` (nom, avatar, bio, **credits** = 5 par défaut, plan),
table `ai_usage` (log des tokens), les triggers, et les fonctions `deduct_ai_credit` /
`refund_ai_credit` (verrouillées, appelables seulement par la fonction).

## 4. Clé du modèle (secret de la fonction)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont injectés
automatiquement dans les Edge Functions — rien à faire.

## 5. Déployer la fonction

```bash
supabase functions deploy ai
```

## 6. Réglages du dashboard Supabase

- **Authentication → Providers → Email** : pour tester vite, désactive
  **« Confirm email »** (sinon il faut cliquer un lien reçu par mail à chaque inscription).
- **Authentication → URL Configuration** : ajoute l'URL de ton front (localhost + prod)
  dans *Redirect URLs*.

## 7. Plafond de dépense (anti-mauvaise surprise)

Anthropic Console → **Limits** → fixe un **plafond mensuel** (ex. 10 $). Au pire,
l'API s'arrête — jamais de facture qui dérape.

## 8. Tester

```bash
npm run dev
```

1. Crée un compte → tu arrives sur le dashboard (5 crédits offerts).
2. Onglet **Calendrier** → glisse « Nouveau devoir » sur un jour.
3. Matière + méthode **« Exercices pratiques »** → **Planifier**.
4. Colle un énoncé → **« M'aider à le faire »**. Ça consomme 1 crédit.

Pour te redonner des crédits pendant les tests, dans le **SQL Editor** de Supabase :

```sql
update public.profiles set credits = 100 where email = 'toi@exemple.com';
```

---

## Réglages utiles

| Quoi | Où |
|---|---|
| Modèle / coût / qualité | `supabase/functions/ai/index.ts` → `MODEL`, `EFFORT` (`low`→`max`), `MAX_TOKENS` |
| Prompt du tuteur | même fichier → `SYSTEM` |
| Crédits offerts à l'inscription | `supabase/migrations/…_init.sql` → `credits integer not null default 5` |
| Rate limit | même fichier fonction → `RATE_WINDOW_MS` |

Si le déploiement de la fonction échoue sur `thinking` / `output_config` : le SDK que Deno
récupère est trop vieux — épingle une version dans l'import
(`npm:@anthropic-ai/sdk@X.Y.Z`) puis redéploie.

---

## Reste à faire avant de commercialiser

- [ ] **Paiement** : Lemon Squeezy ou Stripe + webhook qui recharge `profiles.credits`
- [ ] **Rate limit dur** (Upstash Redis ou verrou Postgres) — l'actuel est « soft »
- [ ] **Captcha** à l'inscription (hCaptcha, gratuit)
- [ ] **Streaming** de la réponse (SSE depuis la fonction) pour l'UX
- [ ] **RGPD** : mentions légales, consentement, hébergement UE (région Supabase `eu-*`)
- [ ] Brancher les autres méthodes (Lecture & notes, Flashcards…) sur l'assistant si besoin
