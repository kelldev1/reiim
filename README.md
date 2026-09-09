# reiim

Application web (React + TypeScript) qui aide les élèves du **collège et du lycée** à
**prendre de l'avance sur leurs devoirs**.

Deux briques :

1. **Un calendrier** en glisser-déposer pour planifier chaque devoir : une matière + une
   ou plusieurs **méthodes de travail**.
2. **Un espace de travail par méthode**, dont plusieurs avec **assistance IA** :
   - *Exercices pratiques* — l'assistant fait le devoir (Markdown + maths KaTeX, PDF accepté)
   - *Vidéos explicatives* — recherche YouTube intégrée (chaînes pédago FR remontées)
   - *Cartes mentales* — carte radiale, génération IA gratuite
   - *Flashcards & mémorisation* — jeu de cartes + révision immersive plein écran
   - *Projets concrets*, *Étude en groupe* — organisateurs simples

Plus : **système d'amis** (`Pseudo#TAG`) et **partage d'un devoir** (l'invité voit tout, en
temps réel).

> **Accès privé.** L'inscription publique est fermée ; les comptes sont créés à la main.
> Voir `SETUP.md` → « Accès privé ».

## Stack

| | |
|---|---|
| Front | Vite 4, React 18, TypeScript (strict), Tailwind CSS 3, framer-motion 10, three.js |
| Backend | **Supabase** — Postgres + Auth + RLS + Edge Functions (Deno) |
| IA | Proxy Edge Function → API Anthropic (Claude). La clé ne quitte jamais le serveur. |
| Vidéos | Proxy Edge Function → YouTube Data API v3 |

Tout le détail d'infra (migrations, secrets, déploiement des fonctions) est dans
**`SETUP.md`**. L'état d'avancement et les décisions produit sont dans
**`consigne/ETAT-DES-LIEUX.md`**.

## Démarrer en local

```bash
npm install
cp .env.example .env      # puis remplir VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:3000
```

Le backend (Supabase + fonctions) est déjà déployé pour ce projet — le front local s'y
connecte directement.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de dev (port 3000) |
| `npm run build` | `tsc --noEmit` + build de prod dans `dist/` |
| `npm run typecheck` | vérification TypeScript seule |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run check` | typecheck + lint |
| `npm run preview` | sert le build de prod |

## Structure

```
src/
  App.tsx                     coquille : navbar + vue courante
  main.tsx                    point d'entrée (ErrorBoundary + providers)
  index.css                   tokens de thème (clair / sombre) + utilitaires
  lib/                        données + contextes
    supabase.ts  auth.tsx  theme.tsx  background.tsx
    devoirs.ts   devoir-work.tsx   friends.ts   ai.ts   videos.ts
  components/ui/
    visualize-booking.tsx     le calendrier + la carte de devoir
    method-workspaces.tsx     tous les espaces de travail par méthode
    dashboard.tsx  navbar.tsx  friends.tsx  profile.tsx  auth-screen.tsx
    markdown.tsx  avatar.tsx  loader.tsx  error-boundary.tsx
supabase/
  migrations/                 schéma + RLS (à appliquer via le SQL Editor ou `db push`)
  functions/ai/               proxy IA (Deno)
  functions/videos/           proxy YouTube (Deno)
```

## Licence

Projet privé, tous droits réservés.
