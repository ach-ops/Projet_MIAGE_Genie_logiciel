#!/usr/bin/env bash

# Script pour lancer le backend et le frontend en parallèle

# Aller dans le dossier backend
cd backend
# Lancer le serveur en mode développement avec nodemon
npm run dev &
BACKEND_PID=$!
cd ..

# Aller dans le dossier frontend
cd frontend
# Lancer le frontend en mode développement
npm run dev &
FRONTEND_PID=$!

# Attendre que les deux serveurs se terminent
wait $BACKEND_PID
wait $FRONTEND_PID
