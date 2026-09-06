# reiim — instructions projet

App **Vite + React 18 + TypeScript + Tailwind**. Point d'entrée `src/main.tsx` → `src/App.tsx`.
(Le repo contient aussi des fichiers C#/.NET `reiim.*.csproj` — ignore-les, on travaille sur la partie web.)

## Règle n°1 : ne jamais laisser le code cassé

Après **chaque** modification de fichier `.ts`/`.tsx` :

1. Un hook lance automatiquement une vérification **syntaxe** (esbuild). S'il signale une
   erreur → la corriger immédiatement, ne pas enchaîner.
2. Avant de dire « c'est fait », lancer :
   ```
   npm run typecheck
   ```
   et vérifier qu'on n'a pas **ajouté** d'erreur (le projet en a déjà — voir plus bas).
3. Si le serveur dev tourne, regarder son terminal : `vite-plugin-checker` y affiche
   les erreurs TypeScript en direct.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur dev (port 3000, overlay d'erreurs actif) |
| `npm run typecheck` | Vérifie les types — **à lancer avant de conclure** |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (réaligne tout le code) |
| `npm run check` | typecheck + lint |
| `npm run build` | typecheck puis build de prod |

## Workflow d'une nouvelle fonctionnalité

1. Partir d'un état propre : `git status` doit être clean (sinon commit ou stash).
2. Faire la modif **par petits morceaux**, vérifier après chacun.
3. `npm run typecheck` → 0 nouvelle erreur.
4. Tester dans le navigateur (http://localhost:3000).
5. `git add -A && git commit -m "..."` dès que ça marche.
6. Si quelque chose casse et qu'on ne trouve pas vite → `git checkout .` pour revenir
   au dernier état fonctionnel, et recommencer plus petit.

## Conventions de code

- Composants : un fichier = un composant principal. Si un fichier exporte des
  constantes/hooks **en plus** d'un composant, les sortir dans un fichier séparé
  (sinon le Fast Refresh casse — c'est ce que signale `react-refresh/only-export-components`).
- JSX : toujours vérifier que chaque `(`, `{`, `<Tag>` a sa fermeture. La majorité
  des plantages viennent de là.
- Un seul élément racine par `return` JSX, sinon `<>...</>`.
- Imports : alias `@/` = `src/` (ex. `import { cn } from '@/lib/utils'`).
- Style : Prettier (pas de `;`, guillemets simples). Lancer `npm run format` si besoin.

## Dette technique connue (au 2026-09-06)

`npm run typecheck` et `npm run lint` remontent déjà **~30 erreurs préexistantes**,
notamment dans :
- `src/lib/utils.ts` — logique de type incohérente (lignes ~19-49)
- `src/components/ui/dashboard.tsx` — `BackgroundConfig` n'a pas de propriété `background`
- `src/components/LearningCalendar.tsx` — `Intl.DateTimeFormat` mal configuré (ligne ~161)

Ne pas considérer ces erreurs comme « normales » : ce sont de vrais problèmes qui
fragilisent tout ce qu'on ajoute par-dessus. Proposer de les corriger quand c'est pertinent.
Objectif : revenir à **0 erreur**, puis y rester.
