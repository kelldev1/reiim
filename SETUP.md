# Mise en route — backend IA (Supabase + proxy Claude)

Le calendrier / les espaces de travail marchent en local sans rien.
**L'auth (comptes) et l'assistant IA ont besoin de Supabase** — déjà configuré pour ce
projet (ref `qfnekebcpapprfhjqrry`). Ce fichier documente la config pour la reprendre ou
la refaire ailleurs.

Architecture : le navigateur ne parle jamais au modèle. Il passe par une **Edge Function**
(`supabase/functions/ai`) qui détient la clé API, vérifie les crédits de l'utilisateur et
limite le débit.

```
React  →  Edge Function "ai"  →  API Anthropic (Claude Opus 5)
          (clé API ICI, jamais dans le bundle)
```

Modèle : **Claude Opus 5** (`claude-opus-5`, effort `high`) — le plus fort en maths.
Repasser à `claude-sonnet-5` (2,5× moins cher) si le coût prime. Réglable dans
`supabase/functions/ai/index.ts` : `MODEL`,
`EFFORT` (`low`→`max`), `MAX_TOKENS`. Le secret reste `LLM_API_KEY`.

---

## 1. Projet Supabase

Déjà créé : `qfnekebcpapprfhjqrry`, région `eu-west-3` (Paris).
Pour en refaire un : https://supabase.com → **New project** (plan gratuit), puis
**Project Settings → API** pour `Project URL`, `anon` key, `service_role` key.

## 2. Variables front (`.env`, déjà rempli)

```
VITE_SUPABASE_URL=https://qfnekebcpapprfhjqrry.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

(Ces deux valeurs sont publiques, elles peuvent être dans le bundle.)

## 3. Base de données

La migration `supabase/migrations/20260907120000_init.sql` est **déjà exécutée**. Elle crée :
table `profiles` (nom, avatar, bio, **credits** = 5 par défaut, plan), table `ai_usage`
(log des tokens), les triggers, et les fonctions `deduct_ai_credit` / `refund_ai_credit`
(verrouillées, appelables seulement par la fonction).

Pour la rejouer sur un nouveau projet :

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## 4. Clé du modèle (secret de la fonction)

1. **console.anthropic.com → Billing** : ajouter du crédit (5 € ≈ ~150 devoirs avec Opus,
   ~400 avec Sonnet).
2. **console.anthropic.com → API keys** : créer une clé (`sk-ant-…`).
3. La poser comme secret de la fonction :

```bash
npx supabase secrets set LLM_API_KEY=sk-ant-... --project-ref qfnekebcpapprfhjqrry
```

Ou via le dashboard : **Edge Functions → Secrets** → `LLM_API_KEY`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont injectés
automatiquement dans les Edge Functions — rien à faire.

## 5. Déployer la fonction

```bash
npx supabase login                 # dans un vrai terminal
npx supabase functions deploy ai --project-ref qfnekebcpapprfhjqrry --use-api
```

(`--use-api` = build côté serveur, pas besoin de Docker.)

## 6. Réglages du dashboard Supabase

- **Authentication → Providers → Email** : « Confirm email » est **désactivé** pour tester.
  **À réactiver avant le lancement public.**
- **Authentication → URL Configuration** : ajouter l'URL du front (localhost + prod) dans
  *Redirect URLs*.

## 7. Coûts & limites

- **Claude Opus 5** : ~5 $/1M entrée, ~25 $/1M sortie. Un devoir ≈ 3–8 c. (Sonnet 5 = 2,5× moins cher.)
- Le proxy limite par **crédit** (5 offerts) + **rate-limit** 1 req/5 s par utilisateur.
- **console.anthropic.com → Limits** : fixer un plafond de dépense mensuel.

## 8. Tester

```bash
npm run dev
```

1. Crée un compte → tu arrives sur le dashboard (5 crédits offerts).
2. Onglet **Calendrier** → glisse « Nouveau devoir » sur un jour.
3. Matière + méthode **« Exercices pratiques »** → **Planifier**.
4. Colle un énoncé → **« Faire le devoir »**. Ça consomme 1 crédit.

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

Si le déploiement échoue sur un paramètre inconnu (`output_config`, `effort`, `thinking`…) :
le SDK que Deno récupère est trop vieux — l'import est épinglé
(`npm:@anthropic-ai/sdk@0.124.0`), monter la version puis redéployer.

> **Détour Mistral (abandonné)** : l'offre « gratuite » Mistral renvoie
> `x-ratelimit-limit-req-minute: 0` tant qu'on n'a pas activé « PAYG » (carte bancaire
> obligatoire). Ne pas y retourner sans carte.

---

## Reste à faire avant de commercialiser

- [ ] **Paiement** : Lemon Squeezy ou Stripe + webhook qui recharge `profiles.credits`
- [ ] **Rate limit dur** (Upstash Redis ou verrou Postgres) — l'actuel est « soft »
- [ ] **Captcha** à l'inscription (hCaptcha, gratuit)
- [ ] **Streaming** de la réponse (SSE depuis la fonction) pour l'UX
- [ ] **RGPD** : mentions légales, consentement, hébergement UE (région Supabase `eu-west-3` ✓)
- [ ] Réactiver « Confirm email »
- [ ] Brancher les autres méthodes (Lecture & notes, Flashcards…) sur l'assistant si besoin
