# Mise en production de reiim

Le backend (Supabase + Edge Functions) est **déjà en ligne**. Il reste à :

1. déployer le front sur Vercel,
2. brancher un domaine,
3. configurer les secrets (monitoring, paiement),
4. compléter les pages légales,
5. **régénérer la clé API Anthropic**.

---

## 1. Déployer le front sur Vercel

1. Crée un compte sur [vercel.com](https://vercel.com) (offre Hobby = gratuit, suffit pour démarrer).
2. **Add New → Project → Import** le dépôt Git de reiim (pousse-le d'abord sur
   GitHub/GitLab si ce n'est pas fait).
3. Vercel détecte Vite. Le fichier `vercel.json` fournit déjà : commande de build,
   dossier de sortie, redirection SPA, cache des assets et **en-têtes de sécurité**
   (CSP, HSTS, X-Frame-Options…). Ne touche à rien.
4. **Environment Variables** — ajoute (Production + Preview) :

   | Nom | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://qfnekebcpapprfhjqrry.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | la clé `anon` (Supabase → Project Settings → API) |
   | `VITE_APP_VERSION` | *(optionnel)* ex. `$VERCEL_GIT_COMMIT_SHA` |
   | `VITE_SENTRY_DSN` | *(optionnel — voir §3)* |
   | `VITE_LEMON_CHECKOUT_20` / `_60` / `_150` | *(optionnel — voir §4)* |

5. **Deploy.** Vérifie :
   - l'app se charge, connexion OK ;
   - `/confidentialite.html`, `/mentions-legales.html`, `/cgv.html` s'affichent ;
   - en console : aucune erreur `Content-Security-Policy` (si une ressource est bloquée,
     ajoute son origine dans `vercel.json` → header `Content-Security-Policy`).

### Domaine

- Achète un domaine (OVH, Gandi, Cloudflare Registrar…).
- Vercel → Project → **Settings → Domains** → ajoute-le, suis les instructions DNS.
- **Ensuite, verrouille le CORS des fonctions** au domaine :
  ```
  npx supabase secrets set ALLOWED_ORIGINS="https://ton-domaine.fr" --project-ref qfnekebcpapprfhjqrry
  npx supabase functions deploy ai --project-ref qfnekebcpapprfhjqrry --use-api
  npx supabase functions deploy videos --project-ref qfnekebcpapprfhjqrry --use-api
  ```
  (garde `http://localhost:3000` dans la liste si tu veux continuer à développer :
  `ALLOWED_ORIGINS="https://ton-domaine.fr,http://localhost:3000"`).
- Mets à jour l'URL de redirection dans **Supabase → Authentication → URL Configuration**
  (Site URL + Redirect URLs) avec le domaine de prod.

---

## 2. Régénérer la clé API Anthropic (à faire absolument)

La clé actuelle (`LLM_API_KEY`) a été collée en clair dans une conversation.

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys** → révoque l'ancienne,
   crée-en une nouvelle.
2. ```
   npx supabase secrets set LLM_API_KEY="sk-ant-..." --project-ref qfnekebcpapprfhjqrry
   ```
   (ne pas la mettre ailleurs — elle ne doit jamais toucher le front.)
3. Pense à mettre un **plafond de dépense** sur le compte Anthropic (Settings → Limits).

---

## 3. Monitoring des erreurs (Sentry) — optionnel mais recommandé

1. [sentry.io](https://sentry.io) → nouveau projet **React**. Offre gratuite : 5 000 erreurs/mois.
2. Copie le **DSN** (ressemble à `https://xxxx@oyyyy.ingest.sentry.io/zzzz`).
3. Vercel → Environment Variables → `VITE_SENTRY_DSN` = ce DSN. Redéploie.
4. Le code ne charge Sentry que si ce DSN est présent (chunk séparé, rien en local).
   Ni replay ni tracing activés (coût + RGPD). Seul l'`id` du compte est envoyé, pas d'e-mail.
5. Mentionne Sentry dans la politique de confidentialité (marqueur déjà en place).

---

## 4. Paiement (Lemon Squeezy)

Lemon Squeezy est *merchant of record* : il encaisse, facture et gère la TVA UE à ta place.

### a. Créer la boutique et les produits

1. [lemonsqueezy.com](https://www.lemonsqueezy.com) → crée un **Store**.
2. Crée **un produit « Crédits reiim »** avec **3 variantes** (packs), par ex. :
   - 20 crédits — *prix à toi de fixer*
   - 60 crédits
   - 150 crédits
3. Pour chaque variante : **Share → Checkout link**. Note l'URL (`https://xxx.lemonsqueezy.com/checkout/buy/...`).
4. Note l'**id de chaque variante** (dans l'URL d'admin de la variante, ou via l'API).
5. Note l'**id du Store** (Settings → Stores).

### b. Configurer les secrets de la fonction webhook

```
npx supabase secrets set LEMON_STORE_ID="123456" --project-ref qfnekebcpapprfhjqrry
npx supabase secrets set LEMON_VARIANT_CREDITS='{"<id_variante_20>":20,"<id_variante_60>":60,"<id_variante_150>":150}' --project-ref qfnekebcpapprfhjqrry
```

### c. Créer le webhook

1. Lemon Squeezy → **Settings → Webhooks → Add endpoint**.
2. URL : `https://qfnekebcpapprfhjqrry.supabase.co/functions/v1/lemon-webhook`
3. Évènement : **`order_created`**.
4. Choisis un **Signing secret**, puis :
   ```
   npx supabase secrets set LEMON_WEBHOOK_SECRET="<le_signing_secret>" --project-ref qfnekebcpapprfhjqrry
   ```
5. La fonction est déjà déployée. Pour la re-déployer après un changement :
   ```
   npx supabase functions deploy lemon-webhook --project-ref qfnekebcpapprfhjqrry --use-api
   ```

### d. Configurer le front

Vercel → Environment Variables :
```
VITE_LEMON_CHECKOUT_20  = <url checkout pack 20>
VITE_LEMON_CHECKOUT_60  = <url checkout pack 60>
VITE_LEMON_CHECKOUT_150 = <url checkout pack 150>
```
Le bloc « Recharger des crédits » du profil apparaît dès qu'au moins une URL est définie.

### e. URL de retour après paiement

Dans chaque variante Lemon Squeezy → **Redirect URL after purchase** :
`https://ton-domaine.fr/?merci=1`
(l'app détecte `?merci=1`, rafraîchit le solde et nettoie l'URL).

### f. Tester

Lemon Squeezy → mode **Test**. Fais un achat test avec une carte de test Stripe
(`4242 4242 4242 4242`). Vérifie que le solde de crédits augmente dans le profil, et
que `credit_purchases` contient une ligne (SQL Editor). Le webhook est **idempotent** :
un rejeu ne recrédite pas.

---

## 5. Compléter les pages légales

`public/mentions-legales.html`, `public/cgv.html`, `public/confidentialite.html` contiennent
des marqueurs **`[À COMPLÉTER]`** / **`[À DÉCIDER]`** :

- **Identité de l'éditeur** : nom (auto-entrepreneur) ou société + forme + capital, adresse,
  **SIRET**, n° TVA si applicable, directeur de la publication, e-mail de contact.
- **Hébergeur** : ajuster si tu ne déploies pas sur Vercel.
- **Âge minimum / mineurs** : décision à prendre (proposition dans le texte : 15 ans, sinon
  accord d'un représentant légal). **À faire relire par un juriste** vu le public scolaire.
- **Médiateur de la consommation** : obligatoire pour un site marchand — adhère à un
  médiateur (ex. CM2C, Medicys) et renseigne ses coordonnées dans les CGV.
- **DPA Anthropic** : accepter/référencer l'accord de traitement des données.
- Dates de mise à jour.

---

## 6. Avant d'ouvrir à d'autres que des proches

- Réactiver **« Confirm email »** (Supabase → Authentication) **+ configurer un SMTP custom**
  (Resend / Postmark / Brevo) — le SMTP partagé Supabase est limité à 3 mails/h.
- Ajouter un écran **« Mot de passe oublié »** (route Supabase `resetPasswordForEmail`).
- **hCaptcha** sur l'inscription si tu la rouvres (voir aussi `SETUP.md`).
- **Plafond de dépense IA global** (compteur mensuel + coupe-circuit) — actuellement seuls
  les crédits par utilisateur limitent.
- Bouton **« Supprimer mon compte »** dans le profil (droit RGPD).
