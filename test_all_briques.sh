#!/bin/bash
# test_all_briques.sh
# Script de test global pour toutes les briques Molam-id (1-9)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
SKIPPED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((SKIPPED++))
}

echo "======================================================================"
echo "  MOLAM-ID - Test Suite Complet (Briques 1-9)"
echo "======================================================================"
echo ""

# Check prerequisites
log_info "Vérification des prérequis..."

if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_warning "Docker n'est pas installé (tests d'intégration seront limités)"
fi

log_info "Node version: $(node --version)"
log_info "NPM version: $(npm --version)"

# Check if server is running
log_info "Vérification du serveur Molam-id..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    log_success "Serveur Molam-id en cours d'exécution"
else
    log_error "Serveur Molam-id non accessible sur http://localhost:3000"
    log_info "Démarrage du serveur..."
    npm start &
    SERVER_PID=$!
    sleep 5
fi

echo ""
echo "======================================================================"
echo "  BRIQUES 1-3 : Authentification de base"
echo "======================================================================"
echo ""

# Test Brique 1
log_info "Test Brique 1 : Signup/Login basique..."
if [ -f "test_brique1.js" ]; then
    if node test_brique1.js; then
        log_success "Brique 1 : Signup/Login OK"
    else
        log_error "Brique 1 : Échec"
    fi
else
    log_warning "Brique 1 : Fichier test manquant"
fi

# Test Brique 2
log_info "Test Brique 2 : Token refresh..."
if [ -f "test_brique2.js" ]; then
    if node test_brique2.js; then
        log_success "Brique 2 : Token refresh OK"
    else
        log_error "Brique 2 : Échec"
    fi
else
    log_warning "Brique 2 : Fichier test manquant"
fi

# Test Brique 3
log_info "Test Brique 3 : Logout..."
if [ -f "test_brique3.js" ]; then
    if node test_brique3.js; then
        log_success "Brique 3 : Logout OK"
    else
        log_error "Brique 3 : Échec"
    fi
else
    log_warning "Brique 3 : Fichier test manquant"
fi

echo ""
echo "======================================================================"
echo "  BRIQUE 4 : Onboarding avancé & KYC"
echo "======================================================================"
echo ""

log_info "Test Brique 4 : Onboarding OTP..."
if [ -f "test_brique4_signup_init.js" ]; then
    if node test_brique4_signup_init.js; then
        log_success "Brique 4 (init) : Signup init OK"
    else
        log_error "Brique 4 (init) : Échec"
    fi
else
    log_warning "Brique 4 (init) : Fichier test manquant"
fi

if [ -f "test_brique4_signup_verify.js" ]; then
    if node test_brique4_signup_verify.js; then
        log_success "Brique 4 (verify) : OTP verify OK"
    else
        log_error "Brique 4 (verify) : Échec"
    fi
else
    log_warning "Brique 4 (verify) : Fichier test manquant"
fi

if [ -f "test_brique4_signup_complete.js" ]; then
    if node test_brique4_signup_complete.js; then
        log_success "Brique 4 (complete) : Signup complete OK"
    else
        log_error "Brique 4 (complete) : Échec"
    fi
else
    log_warning "Brique 4 (complete) : Fichier test manquant"
fi

echo ""
echo "======================================================================"
echo "  BRIQUE 5 : Session Management"
echo "======================================================================"
echo ""

log_info "Test Brique 5 : Session management..."
if [ -f "test_brique5.js" ]; then
    if node test_brique5.js; then
        log_success "Brique 5 : Session management OK"
    else
        log_error "Brique 5 : Échec"
    fi
else
    log_warning "Brique 5 : Fichier test manquant - Création en cours..."
    # Créer un test basique si manquant
fi

echo ""
echo "======================================================================"
echo "  BRIQUE 6 : RBAC & AuthZ"
echo "======================================================================"
echo ""

log_info "Test Brique 6 : Authorization service..."
if [ -f "test_brique6_authz.js" ]; then
    if node test_brique6_authz.js; then
        log_success "Brique 6 : AuthZ OK"
    else
        log_error "Brique 6 : Échec"
    fi
else
    log_warning "Brique 6 : Fichier test manquant"
fi

echo ""
echo "======================================================================"
echo "  BRIQUE 7 : Audit Logs Immuables"
echo "======================================================================"
echo ""

log_info "Test Brique 7 : Audit logs..."
if [ -d "brique-audit" ]; then
    cd brique-audit/ci
    if [ -f "test_insert_and_verify.sh" ]; then
        chmod +x test_insert_and_verify.sh
        if ./test_insert_and_verify.sh; then
            log_success "Brique 7 : Audit logs OK"
        else
            log_error "Brique 7 : Échec"
        fi
    else
        log_warning "Brique 7 : Script test manquant"
    fi
    cd ../..
else
    log_warning "Brique 7 : Répertoire manquant"
fi

echo ""
echo "======================================================================"
echo "  BRIQUE 8 : KYC/AML Pipeline"
echo "======================================================================"
echo ""

log_info "Test Brique 8 : KYC/AML..."
if [ -d "brique-08-kyc-aml" ]; then
    cd brique-08-kyc-aml/ci
    if [ -f "test_local_kyc_flow.sh" ]; then
        chmod +x test_local_kyc_flow.sh
        if ./test_local_kyc_flow.sh; then
            log_success "Brique 8 : KYC/AML OK"
        else
            log_error "Brique 8 : Échec"
        fi
    else
        log_warning "Brique 8 : Script test manquant"
    fi
    cd ../..
else
    log_warning "Brique 8 : Répertoire manquant"
fi

echo ""
echo "======================================================================"
echo "  BRIQUE 9 : Extended AuthZ"
echo "======================================================================"
echo ""

log_info "Test Brique 9 : Extended AuthZ..."
if [ -f "test_brique9.js" ]; then
    if node test_brique9.js; then
        log_success "Brique 9 : Extended AuthZ OK"
    else
        log_error "Brique 9 : Échec"
    fi
else
    log_warning "Brique 9 : Fichier test manquant"
fi

# Summary
echo ""
echo "======================================================================"
echo "  RÉSUMÉ DES TESTS"
echo "======================================================================"
echo ""
echo -e "${GREEN}Réussis : $PASSED${NC}"
echo -e "${RED}Échoués  : $FAILED${NC}"
echo -e "${YELLOW}Ignorés  : $SKIPPED${NC}"
echo ""

TOTAL=$((PASSED + FAILED + SKIPPED))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$((PASSED * 100 / TOTAL))
    echo "Taux de réussite : $SUCCESS_RATE%"
fi

echo ""
echo "======================================================================"

# Cleanup
if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
fi

# Exit code
if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
