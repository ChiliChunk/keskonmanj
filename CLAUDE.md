# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vue d'ensemble

Keskonmanj suggère des plats pour la semaine (générés par Claude Sonnet 5.5),
garde une bibliothèque de plats aimés, un menu de la semaine (midi/soir) et
une liste de courses. Elle reprend exprès la stack du projet voisin
`../dashboard` pour ne pas multiplier les dépendances sur la Raspberry qui
héberge les deux :

- **Front** : Vite + React 18 + TypeScript strict, à la racine.
- **Back** : `server/`, Python sans framework (`http.server`), plus
  `python-dotenv` et le SDK `anthropic`. Il sert à la fois l'API (`/api/*`)
  et le front buildé (`dist/`) sur **un seul port, 8800** (le dashboard
  occupe 5173 et 8799 sur la même machine).

Toutes les données vivent côté serveur dans `server/data.json` (non
versionné), et non en IndexedDB comme dans le dashboard : téléphone et PC
doivent voir le même menu et la même liste de courses.

## Commandes

```bash
npm run dev       # Vite sur :5174, proxy /api → :8800
npm run build     # tsc -b puis build Vite (dist/, servi par le back)
npm run test      # vitest run
npx vitest run src/domain/shopping.test.ts   # un seul fichier de test
```

Back (venv dans `server/.venv`, clé dans `server/.env`, voir
`server/.env.example`) :

```bash
server/.venv/Scripts/python server/main.py   # Windows ; bin/python sur la Pi
```

Le back sert `dist/` : après une modif du front, il faut `npm run build` pour
la voir sur :8800 (ou passer par `npm run dev` sur :5174). Une modif Python
demande de relancer le serveur. `.claude/launch.json` déclare la config
`keskonmanj` (back sur :8800) pour le Browser pane.

Pas de lint configuré (contrairement au dashboard) ; `tsc -b` fait office de
vérification.

## Déploiement (Raspberry `framboise3`)

Hôte SSH `framboise3` (192.168.1.130, utilisateur `chili`), app dans
`~/keskonmanj`, service systemd `keskonmanj` (`deploy/keskonmanj.service`).
Mise à jour après un push :

```bash
ssh framboise3 "cd ~/keskonmanj && git pull && npm install && npm run build && sudo systemctl restart keskonmanj"
```

Le serveur met ~20 s à écouter après un redémarrage (import du SDK Anthropic
lent sur une Pi 3) : attendre avant de conclure qu'il est en panne. Logs :
`sudo journalctl -u keskonmanj`. Le `server/.env` de la Pi n'est pas dans
git et contient la clé API.

## Architecture

### Back (`server/`)

- **`main.py`** : routeur HTTP à la main (`do_GET`/`do_POST`/`do_DELETE`
  sur les segments du chemin) et persistance. `load_data()` complète par
  `setdefault` toute clé ajoutée après coup (`plan`, `pantry`, `weeks`,
  `customTags`, `sources` de chaque plat) : c'est la seule « migration »,
  le `data.json` de la Pi date d'anciennes versions. Toute nouvelle clé doit
  y être ajoutée. Écritures sous `_lock` (`ThreadingHTTPServer`) et
  atomiques (fichier `.tmp` puis `replace`).
- **`generator.py`** : génération des plats. Les N plats demandés sortent
  d'**un seul** appel en sortie structurée (`Menu` pydantic), pour que le
  modèle les varie entre eux. Les plats déjà connus et ceux proposés dans la
  session (`recent`) sont passés comme « à éviter », et une cuisine est
  tirée au hasard quand il n'y a pas de précision : sans ça, « Autre idée »
  renvoyait souvent le même plat.
- **`sources.py`** : photos et liens de vraies recettes. Claude fait une
  recherche web (outil serveur `web_search_20260209`). Les liens sont lus
  directement dans les blocs `web_search_tool_result`, pas recopiés par le
  modèle. Puis le serveur récupère lui-même l'`og:image` de chaque page, en
  parallèle, avec un User-Agent de navigateur. C'est une route séparée
  (`/api/sources`) appelée par le front *après* la génération : les recettes
  s'affichent sans attendre les photos.

### Front (`src/`)

- **`App.tsx`** possède tout l'état partagé (plats, plan, placard, tags…) et
  le synchronise avec le serveur. Les onglets restent **montés** et sont
  seulement masqués (`hidden`), pour que le plat généré et la saisie en
  cours survivent à un changement d'onglet.
- **Enregistrement des plats** (`upsert` dans `App.tsx`) : les sauvegardes
  passent par une file d'attente, et chaque modification est un *patch*
  appliqué sur la dernière version renvoyée par le serveur. Sans ça, deux
  clics rapprochés (♡ puis « Prévoir ») partaient de la même copie et le
  second écrasait le premier. Les vues appellent donc toujours
  `onSave(dish, patch)`, jamais `onSave({...dish, ...patch})`.
- **Cycle de vie d'un plat** : un plat généré n'existe que dans l'état local
  de `GenerateView` tant qu'il n'est ni aimé ni prévu ; une retouche (✎)
  reste alors locale. Le serveur supprime un plat qui n'est plus ni aimé ni
  prévu, et libère ses créneaux du menu (`forget_in_plan`, reflété côté
  front par `withoutDish`). Les ids sont attribués par le serveur :
  `crypto.randomUUID` n'existe pas hors contexte sécurisé, et l'app est
  servie en HTTP simple sur le réseau local.
- **Menu** (`PlannedView`) : `WeekPlan` associe une clé de créneau à
  `{dishId}` ou `{text}`. Les clés de la semaine 1 sont sans préfixe
  (`lundi-midi`), les suivantes préfixées (`s2-lundi-midi`) : c'est le format
  d'avant l'ajout des semaines, déjà enregistré (voir `slotKey`). Le
  glisser-déposer HTML ne marche pas au doigt : on peut aussi toucher un plat
  puis une case.
- **`src/domain/`** : logique pure et testée (vitest, environnement `node`).
  `ingredientKey` regroupe les ingrédients (casse, espaces, pluriel simple)
  et sert de clé aux cases cochées. `isInPantry` masque les ingrédients du
  placard, variantes comprises (« huile » couvre « huile d'olive », mais
  « poivre » ne couvre pas « poivron »). La liste de courses ne fait
  qu'accoler les quantités par plat, sans les additionner : les unités sont
  rarement compatibles.

## Conventions

Mêmes conventions que le dashboard. Interface, commentaires et messages de
commit en français. Les commentaires expliquent un choix non évident, pas ce
que fait le code. TypeScript strict avec `noUncheckedIndexedAccess` et
`noUnusedLocals`/`noUnusedParameters`. Tests colocalisés en `*.test.ts`.
Palette et polices dans `src/ui/theme.css` (variables CSS en `:root`) ; le
titre utilise Barriecito, comme l'app Recipease.
