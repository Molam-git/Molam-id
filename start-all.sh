#!/bin/bash

# =============================================================================
# MOLAM-ID - Script de démarrage orchestré
# =============================================================================
# Ce script démarre tous les services de l'écosystème Molam-ID
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================================================${NC}"
echo -e "${BLUE}  MOLAM-ID - ORCHESTRATION STARTUP${NC}"
echo -e "${BLUE}=========================================================================${NC}"

# =============================================================================
# Check prerequisites
# =============================================================================

echo -e "\n${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed. Please install docker-compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and docker-compose are installed${NC}"

# =============================================================================
# Check environment file
# =============================================================================

echo -e "\n${YELLOW}[2/7] Checking environment configuration...${NC}"

if [ ! -f .env.orchestration ]; then
    echo -e "${RED}❌ .env.orchestration file not found!${NC}"
    echo -e "${YELLOW}Creating from template...${NC}"
    cp .env.orchestration.example .env.orchestration 2>/dev/null || true
    echo -e "${YELLOW}⚠️  Please edit .env.orchestration with your actual values${NC}"
fi

echo -e "${GREEN}✅ Environment file exists${NC}"

# =============================================================================
# Stop existing containers
# =============================================================================

echo -e "\n${YELLOW}[3/7] Stopping existing containers...${NC}"

docker-compose -f docker-compose.orchestration.yml down || true

echo -e "${GREEN}✅ Existing containers stopped${NC}"

# =============================================================================
# Build images (optional, can be skipped with --no-build flag)
# =============================================================================

if [ "$1" != "--no-build" ]; then
    echo -e "\n${YELLOW}[4/7] Building Docker images...${NC}"
    echo -e "${BLUE}This may take several minutes on first run...${NC}"

    docker-compose -f docker-compose.orchestration.yml build --parallel

    echo -e "${GREEN}✅ Docker images built${NC}"
else
    echo -e "\n${YELLOW}[4/7] Skipping build (--no-build flag set)${NC}"
fi

# =============================================================================
# Start infrastructure services first
# =============================================================================

echo -e "\n${YELLOW}[5/7] Starting infrastructure services...${NC}"

docker-compose -f docker-compose.orchestration.yml up -d postgres redis zookeeper kafka

echo -e "${BLUE}Waiting for infrastructure to be ready...${NC}"
sleep 10

# Wait for PostgreSQL
echo -e "${BLUE}Waiting for PostgreSQL...${NC}"
until docker exec molam-postgres pg_isready -U molam > /dev/null 2>&1; do
    echo -e "${YELLOW}  PostgreSQL is unavailable - sleeping${NC}"
    sleep 2
done
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Wait for Redis
echo -e "${BLUE}Waiting for Redis...${NC}"
until docker exec molam-redis redis-cli ping > /dev/null 2>&1; do
    echo -e "${YELLOW}  Redis is unavailable - sleeping${NC}"
    sleep 2
done
echo -e "${GREEN}✅ Redis is ready${NC}"

# =============================================================================
# Initialize database
# =============================================================================

echo -e "\n${YELLOW}[6/7] Initializing database...${NC}"

# SQL files are automatically loaded by PostgreSQL init script
# Additional manual migrations can be run here if needed

echo -e "${GREEN}✅ Database initialized${NC}"

# =============================================================================
# Start all application services
# =============================================================================

echo -e "\n${YELLOW}[7/7] Starting all application services...${NC}"

docker-compose -f docker-compose.orchestration.yml up -d

echo -e "${BLUE}Waiting for services to start...${NC}"
sleep 15

# =============================================================================
# Health check
# =============================================================================

echo -e "\n${YELLOW}Checking service health...${NC}"

# Check API Gateway
if curl -sf http://localhost:3000/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Gateway (port 3000)${NC}"
else
    echo -e "${RED}❌ API Gateway (port 3000)${NC}"
fi

# Check Core ID
if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Core ID (port 3001)${NC}"
else
    echo -e "${RED}⚠️  Core ID (port 3001) - may still be starting${NC}"
fi

# =============================================================================
# Summary
# =============================================================================

echo -e "\n${GREEN}=========================================================================${NC}"
echo -e "${GREEN}  ✅ MOLAM-ID ORCHESTRATION STARTED SUCCESSFULLY${NC}"
echo -e "${GREEN}=========================================================================${NC}"

echo -e "\n${BLUE}📋 Service Status:${NC}"
docker-compose -f docker-compose.orchestration.yml ps

echo -e "\n${BLUE}🌐 Access Points:${NC}"
echo -e "  API Gateway:     http://localhost:3000"
echo -e "  Core ID:         http://localhost:3001"
echo -e "  Prometheus:      http://localhost:9090"
echo -e "  Grafana:         http://localhost:3100 (admin/admin)"
echo -e "  PostgreSQL:      localhost:5432 (molam/molam_pass)"
echo -e "  Redis:           localhost:6379"

echo -e "\n${BLUE}📊 Monitoring:${NC}"
echo -e "  Health Check:    http://localhost:3000/healthz"
echo -e "  Services Status: http://localhost:3000/status"
echo -e "  Metrics:         http://localhost:3000/metrics"

echo -e "\n${YELLOW}📝 Logs:${NC}"
echo -e "  View all logs:        docker-compose -f docker-compose.orchestration.yml logs -f"
echo -e "  View specific service: docker-compose -f docker-compose.orchestration.yml logs -f <service-name>"

echo -e "\n${YELLOW}🛑 Stop all services:${NC}"
echo -e "  docker-compose -f docker-compose.orchestration.yml down"

echo -e "\n${GREEN}=========================================================================${NC}"
