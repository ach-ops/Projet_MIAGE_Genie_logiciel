# Projet MIAGE — Génie Logiciel

Application web de suivi des transports en commun du réseau STAN (Nancy) : horaires théoriques, passages temps réel, itinéraires multimodaux et statistiques de retards.

---

## Prérequis

- **Node.js** >= 22.12.0
- **npm** >= 10
- Une instance **MongoDB** accessible (locale ou distante)
- Une clé API **WeatherAPI** (gratuite sur [weatherapi.com](https://www.weatherapi.com))
- Une clé API **GOOGLEMAPS** (payant sur GCP)

---

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd Projet_MIAGE_Genie_logiciel
```

### 2. Installer les dépendances

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 3. Configurer les variables d'environnement

Créer un fichier `.env` dans le dossier `backend/` :

```env
# Serveur
PORT=3000
NODE_ENV=development

# Fuseau horaire (obligatoire pour convertir les heures GTFS)
TZ=Europe/Paris

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=stan_delays

# Flux GTFS temps réel
GTFS_RT_URL=https://proxy.transport.data.gouv.fr/resource/fluo-stan-nancy-gtfs-rt-trip-update

# Météo (WeatherAPI)
WEATHER_API_KEY=<votre-clé>

# Origines autorisées par le CORS (laisser vide en dev, sinon séparer par des virgules)
CORS_ORIGINS=

# Paramètres optionnels (valeurs par défaut ci-dessous)
CACHE_DURATION_MS=30000
MAX_ARRIVALS=8
AXIOS_TIMEOUT_MS=8000
```

Créer un fichier `.env` dans le dossier `frontend/` :
```env

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=<votre-clé>

```

> Le fichier `.env` ne doit jamais être commité. Il est déjà ignoré par `.gitignore`.

---

## Lancement en développement

### Option A — Script tout-en-un

**A la racine du projet**
```bash
chmod +x run.sh
./run.sh
```

### Option B — Terminaux séparés

**Terminal 1 — Backend :**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend :**
```bash
cd frontend
npm run dev
```

L'application est accessible sur **http://localhost:5173**  
L'API backend tourne sur **http://localhost:3000**

> Le proxy Vite redirige automatiquement les appels `/api` vers `localhost:3000` en développement.

---

## Tests

```bash
# Tests backend
cd backend && npm test

# Tests avec couverture
cd backend && npm run test:coverage

# Tests frontend
cd frontend && npm run test:unit
```

---

## Structure du projet

```
├── backend/
│   ├── config/          # Configuration
│   ├── controllers/     # Handlers HTTP (transport, itinéraire, météo…)
│   ├── data/gtfs/       # Fichiers GTFS statiques (stops, routes, trips…)
│   ├── middleware/      # Validation, logs, gestion d'erreurs
│   ├── routes/          # Définition des routes Express
│   ├── services/        # Logique métier (GTFS, temps réel, MongoDB…)
│   └── utils/           # Utilitaires (logger, time, stream)
├── frontend/
│   └── src/
│       ├── components/  # Composants Vue (carte, arrêts, itinéraire…)
│       ├── composables/ # Hooks réutilisables
│       ├── stores/      # État global Pinia
│       ├── types/       # Types TypeScript
│       └── views/       # Pages de l'application
├── run.sh               # Lance backend + frontend en parallèle
└── package.json
```

---

## Variables d'environnement — récapitulatif

| Variable | Obligatoire | Description |
|---|---|---|
| `PORT` | oui | Port du serveur Express |
| `TZ` | oui | Fuseau horaire (ex: `Europe/Paris`) |
| `MONGO_URI` | oui | URI de connexion MongoDB |
| `MONGO_DB` | oui | Nom de la base MongoDB |
| `GTFS_RT_URL` | oui | URL du flux GTFS temps réel |
| `WEATHER_API_KEY` | oui | Clé API WeatherAPI |
| `CORS_ORIGINS` | prod uniquement | Origines autorisées, séparées par des virgules |
| `CACHE_DURATION_MS` | non | Durée de cache du flux RT (défaut : `30000`) |
| `MAX_ARRIVALS` | non | Nombre max de passages retournés (défaut : `8`) |
| `AXIOS_TIMEOUT_MS` | non | Timeout HTTP en ms (défaut : `8000`) |
| `VITE_GOOGLE_MAPS_API_KEY` | oui | Clé API GoogleMaps |
