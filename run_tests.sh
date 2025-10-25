#!/bin/bash
# run_tests.sh - Script pour préparer et lancer tous les tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       MOLAM-ID - Préparation et Exécution des Tests        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Install dependencies
echo -e "${YELLOW}[1/7]${NC} Installation des dépendances Node.js..."
npm install
echo -e "${GREEN}✓${NC} Dépendances installées\n"

# Step 2: Start Docker environment
echo -e "${YELLOW}[2/7]${NC} Démarrage de l'environnement Docker..."
docker-compose -f docker-compose.test.yml up -d
echo -e "${GREEN}✓${NC} Services Docker démarrés\n"

# Step 3: Wait for services to be ready
echo -e "${YELLOW}[3/7]${NC} Attente du démarrage des services (30 secondes)..."
sleep 30

# Check health endpoints
echo -e "${BLUE}    Vérification des services...${NC}"

if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓${NC} Molam API (port 3000)"
else
    echo -e "${RED}    ✗${NC} Molam API non accessible"
fi

if curl -s http://localhost:4100/health > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓${NC} Audit Verifier (port 4100)"
else
    echo -e "${YELLOW}    ⚠${NC} Audit Verifier non accessible (tests Brique 7 peuvent échouer)"
fi

if curl -s http://localhost:4201/health > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓${NC} KYC API (port 4201)"
else
    echo -e "${YELLOW}    ⚠${NC} KYC API non accessible (tests Brique 8 peuvent échouer)"
fi

echo ""

# Step 4: Create MinIO buckets
echo -e "${YELLOW}[4/7]${NC} Configuration de MinIO (buckets S3)..."

# Check if MinIO is accessible
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo -e "${BLUE}    Création des buckets...${NC}"

    # Install MinIO client if not present
    if ! command -v mc &> /dev/null; then
        echo -e "${BLUE}    Installation du client MinIO...${NC}"
        wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
        chmod +x /tmp/mc
        MC_CMD="/tmp/mc"
    else
        MC_CMD="mc"
    fi

    # Configure MinIO alias
    $MC_CMD alias set molam-local http://localhost:9000 minioadmin minioadmin --api S3v4 2>/dev/null || true

    # Create buckets
    $MC_CMD mb molam-local/molam-audit 2>/dev/null || echo -e "${BLUE}    Bucket molam-audit déjà existant${NC}"
    $MC_CMD mb molam-local/molam-kyc 2>/dev/null || echo -e "${BLUE}    Bucket molam-kyc déjà existant${NC}"

    echo -e "${GREEN}    ✓${NC} Buckets MinIO configurés"
else
    echo -e "${YELLOW}    ⚠${NC} MinIO non accessible - Création manuelle requise:"
    echo -e "${BLUE}      1. Ouvrir http://localhost:9001${NC}"
    echo -e "${BLUE}      2. Login: minioadmin / minioadmin${NC}"
    echo -e "${BLUE}      3. Créer buckets: molam-audit, molam-kyc${NC}"
fi

echo ""

# Step 5: Initialize databases
echo -e "${YELLOW}[5/7]${NC} Vérification des bases de données..."

# Check PostgreSQL main
if docker exec molam-postgres-main pg_isready -U molam -d molam > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓${NC} PostgreSQL main (molam)"
else
    echo -e "${RED}    ✗${NC} PostgreSQL main non prêt"
fi

# Check PostgreSQL audit
if docker exec molam-postgres-audit pg_isready -U molam -d molam_audit > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓${NC} PostgreSQL audit (molam_audit)"
else
    echo -e "${YELLOW}    ⚠${NC} PostgreSQL audit non prêt"
fi

# Check PostgreSQL KYC
if docker exec molam-postgres-kyc pg_isready -U molam -d molam_kyc > /dev/null 2>&1; then
    echo -e "${GREEN}    ✓${NC} PostgreSQL KYC (molam_kyc)"
else
    echo -e "${YELLOW}    ⚠${NC} PostgreSQL KYC non prêt"
fi

echo ""

# Step 6: Run tests
echo -e "${YELLOW}[6/7]${NC} Exécution des tests..."
echo ""

npm test

# Capture exit code
TEST_EXIT_CODE=$?

echo ""

# Step 7: Cleanup (optional)
echo -e "${YELLOW}[7/7]${NC} Nettoyage (optionnel)..."
read -p "Voulez-vous arrêter l'environnement Docker ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.test.yml down
    echo -e "${GREEN}✓${NC} Environnement arrêté"
else
    echo -e "${BLUE}ℹ${NC} Environnement toujours actif. Pour l'arrêter: npm run test:env:down"
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      Tests terminés                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -f "test-report.json" ]; then
    echo -e "${GREEN}📊 Rapport disponible: test-report.json${NC}"
fi

echo ""

exit $TEST_EXIT_CODE
