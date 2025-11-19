#!/bin/bash

# =============================================================================
# MOLAM-ID - Script de test d'intégration
# =============================================================================
# Ce script teste tous les services de l'écosystème Molam-ID
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a FAILED_SERVICES

echo -e "${BLUE}=========================================================================${NC}"
echo -e "${BLUE}  MOLAM-ID - INTEGRATION TESTS${NC}"
echo -e "${BLUE}=========================================================================${NC}"

# =============================================================================
# Helper function to test a service
# =============================================================================

test_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1 || echo "000")

    if [ "$response" == "$expected_status" ] || [ "$response" == "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_SERVICES+=("$name")
        return 1
    fi
}

# =============================================================================
# Test Infrastructure Services
# =============================================================================

echo -e "\n${YELLOW}[1/5] Testing Infrastructure Services...${NC}"

# PostgreSQL
echo -n "Testing PostgreSQL... "
if docker exec molam-postgres pg_isready -U molam > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_SERVICES+=("PostgreSQL")
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Redis
echo -n "Testing Redis... "
if docker exec molam-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_SERVICES+=("Redis")
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# =============================================================================
# Test API Gateway
# =============================================================================

echo -e "\n${YELLOW}[2/5] Testing API Gateway...${NC}"

test_service "API Gateway Health" "http://localhost:3000/healthz"
test_service "API Gateway Status" "http://localhost:3000/status"

# =============================================================================
# Test Core Identity Services (Briques 1-5)
# =============================================================================

echo -e "\n${YELLOW}[3/5] Testing Core Identity Services...${NC}"

test_service "Core ID Health" "http://localhost:3001/api/health"

# =============================================================================
# Test Authentication & Security Services (Briques 6-11)
# =============================================================================

echo -e "\n${YELLOW}[4/5] Testing Authentication & Security Services...${NC}"

test_service "Brique 06 - Password Reset" "http://localhost:8085/health"
test_service "Brique 07 - Biometrics" "http://localhost:8080/health"
test_service "Brique 08 - Voice Auth" "http://localhost:8081/health"
test_service "Brique 09 - Geo & Timezone" "http://localhost:3009/health"
test_service "Brique 10 - Device Fingerprint" "http://localhost:8083/healthz"
test_service "Brique 11 - MFA/2FA" "http://localhost:8084/health"

# =============================================================================
# Test Delegation & Control Services (Briques 12-15)
# =============================================================================

echo -e "\n${YELLOW}[5/5] Testing Delegation & Control Services...${NC}"

test_service "Brique 12 - Delegation" "http://localhost:3012/health"
test_service "Brique 13 - Blacklist" "http://localhost:3013/health"
test_service "Brique 14 - Audit Logs" "http://localhost:3014/health"
test_service "Brique 15 - i18n" "http://localhost:3015/health"

# =============================================================================
# Test Data & Profile Services (Briques 16-19)
# =============================================================================

echo -e "\n${YELLOW}Testing Data & Profile Services...${NC}"

test_service "Brique 16 - FX/Multicurrency" "http://localhost:3016/health"
test_service "Brique 17 - User Profile" "http://localhost:3017/health"
test_service "Brique 18 - Update Profile" "http://localhost:3018/health"
test_service "Brique 19 - Export Profile" "http://localhost:3019/health"

# =============================================================================
# Test RBAC & Authorization Services (Briques 20-23)
# =============================================================================

echo -e "\n${YELLOW}Testing RBAC & Authorization Services...${NC}"

test_service "Brique 20 - RBAC Granular" "http://localhost:3020/health"
test_service "Brique 21 - Role Management" "http://localhost:3021/health"
test_service "Brique 22 - Admin ID" "http://localhost:3022/health"
test_service "Brique 23 - Sessions Monitoring" "http://localhost:3023/health"

# =============================================================================
# Test Admin Services (Briques 33-34)
# =============================================================================

echo -e "\n${YELLOW}Testing Admin Services...${NC}"

test_service "Brique 33 - API Admin" "http://localhost:3033/health"
test_service "Brique 34 - Advanced Sessions Monitoring" "http://localhost:3034/healthz"

# =============================================================================
# Test Observability Services
# =============================================================================

echo -e "\n${YELLOW}Testing Observability Services...${NC}"

test_service "Prometheus" "http://localhost:9090/-/healthy"
test_service "Grafana" "http://localhost:3100/api/health"

# =============================================================================
# Summary 
# =============================================================================

echo -e "\n${BLUE}=========================================================================${NC}"
echo -e "${BLUE}  TEST SUMMARY${NC}"
echo -e "${BLUE}=========================================================================${NC}"

echo -e "\nTotal Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
echo -e "${RED}Failed:       $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "\n${RED}Failed Services:${NC}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo -e "  - $service"
    done
    echo -e "\n${YELLOW}Tip: Check service logs with:${NC}"
    echo -e "  docker-compose -f docker-compose.orchestration.yml logs -f <service-name>"
    exit 1
else
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    exit 0
fi

echo -e "${BLUE}=========================================================================${NC}"
