# keskonmanj

Suggestions de plats pour la semaine, générées par Claude (Sonnet 5.5).

- **Générer** : choisir des tags (healthy, protéiné, qui cale…) et, si on veut,
  les ingrédients qu'on a déjà (éventuellement « uniquement ceux-là »), générer un
  plat, l'aimer ♡ et/ou le **prévoir** pour la semaine.
- **Prévus** : plats à cuisiner cette semaine, y compris ajoutés à la main.
- **Courses** : ingrédients de tous les plats prévus, regroupés, à cocher.
- **Aimés** : bibliothèque des plats likés, avec recherche.

Même stack que le dashboard : front Vite + React 18 + TypeScript, back Python
sans framework (`http.server`) + `python-dotenv`, plus le SDK `anthropic`.
Le back sert l'API (`/api/*`) **et** le front buildé (`dist/`) sur un seul
port, **8800** (le dashboard utilise 5173 et 8799). Les données sont dans
`server/data.json`, partagées entre tous les appareils.

## Développement local

```bash
cp server/.env.example server/.env        # puis renseigner ANTHROPIC_API_KEY
python -m venv server/.venv
server/.venv/Scripts/pip install -r server/requirements.txt   # Windows
npm install
server/.venv/Scripts/python server/main.py   # API sur :8800
npm run dev                                   # front sur :5174, proxy /api → :8800
```

`npm run test` lance les tests (vitest), `npm run build` construit `dist/`.

## Déploiement sur la Raspberry

Une fois (sur la Pi) :

```bash
git clone https://github.com/ChiliChunk/keskonmanj.git ~/keskonmanj
cd ~/keskonmanj
python3 -m venv server/.venv
server/.venv/bin/pip install -r server/requirements.txt
nano server/.env                     # ANTHROPIC_API_KEY=...
npm install && npm run build
sudo cp deploy/keskonmanj.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now keskonmanj
```

L'app est alors sur `http://192.168.1.130:8800`.

Mise à jour :

```bash
cd ~/keskonmanj && git pull && npm install && npm run build \
  && server/.venv/bin/pip install -r server/requirements.txt \
  && sudo systemctl restart keskonmanj
```
