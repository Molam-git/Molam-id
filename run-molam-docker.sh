#!/bin/bash

clear

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              MOLAM-ID - DOCKER BUILD & RUN                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "Ce script va :"
echo "  1. Arrêter les conteneurs existants"
echo "  2. Builder les images Docker"
echo "  3. Démarrer tous les services (DB, API, Web UI)"
echo ""
read -p "Appuyez sur Entrée pour continuer..."

echo ""
echo "[1/4] Arrêt des conteneurs existants..."
docker-compose -f docker-compose.full.yml down
echo "     - OK"
echo ""

echo "[2/4] Build des images Docker..."
echo "     (Cela peut prendre quelques minutes la première fois)"
docker-compose -f docker-compose.full.yml build
if [ $? -ne 0 ]; then
    echo "     - ERREUR lors du build !"
    exit 1
fi
echo "     - OK"
echo ""

echo "[3/4] Démarrage des conteneurs..."
docker-compose -f docker-compose.full.yml up -d
if [ $? -ne 0 ]; then
    echo "     - ERREUR lors du démarrage !"
    exit 1
fi
echo "     - OK"
echo ""

echo "[4/4] Attente du démarrage complet..."
sleep 5
echo "     - OK"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    DÉMARRAGE TERMINÉ !                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo " Services en cours d'exécution:"
echo "   - Base de données PostgreSQL : localhost:5432"
echo "   - Backend API                : http://localhost:3000"
echo "   - Web UI                     : http://localhost:5173"
echo ""
echo " Vous pouvez maintenant accéder à l'application sur :"
echo "   > http://localhost:5173"
echo ""
echo " Pour voir les logs en temps réel :"
echo "   docker-compose -f docker-compose.full.yml logs -f"
echo ""
echo " Pour arrêter tous les services :"
echo "   docker-compose -f docker-compose.full.yml down"
echo ""

# Ouvrir le navigateur (selon l'OS)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:5173 2>/dev/null || true
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5173
fi

echo " Appuyez sur Entrée pour fermer..."
read
