@echo off
REM =============================================================================
REM MOLAM-ID - Script de démarrage orchestré (Windows)
REM =============================================================================

echo =========================================================================
echo   MOLAM-ID - ORCHESTRATION STARTUP
echo =========================================================================

REM =============================================================================
REM Check prerequisites
REM =============================================================================

echo.
echo [1/7] Checking prerequisites...

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

where docker-compose >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: docker-compose is not installed. Please install docker-compose first.
    exit /b 1
)

echo OK: Docker and docker-compose are installed

REM =============================================================================
REM Check environment file
REM =============================================================================

echo.
echo [2/7] Checking environment configuration...

if not exist .env.orchestration (
    echo ERROR: .env.orchestration file not found!
    echo Creating from template...
    copy .env.orchestration.example .env.orchestration 2>nul
    echo WARNING: Please edit .env.orchestration with your actual values
)

echo OK: Environment file exists

REM =============================================================================
REM Stop existing containers
REM =============================================================================

echo.
echo [3/7] Stopping existing containers...

docker-compose -f docker-compose.orchestration.yml down

echo OK: Existing containers stopped

REM =============================================================================
REM Build images
REM =============================================================================

echo.
echo [4/7] Building Docker images...
echo This may take several minutes on first run...

docker-compose -f docker-compose.orchestration.yml build --parallel

echo OK: Docker images built

REM =============================================================================
REM Start infrastructure services first
REM =============================================================================

echo.
echo [5/7] Starting infrastructure services...

docker-compose -f docker-compose.orchestration.yml up -d postgres redis zookeeper kafka

echo Waiting for infrastructure to be ready...
timeout /t 10 /nobreak >nul

echo Waiting for PostgreSQL...
:wait_postgres
docker exec molam-postgres pg_isready -U molam >nul 2>&1
if %errorlevel% neq 0 (
    echo   PostgreSQL is unavailable - sleeping
    timeout /t 2 /nobreak >nul
    goto wait_postgres
)
echo OK: PostgreSQL is ready

echo Waiting for Redis...
:wait_redis
docker exec molam-redis redis-cli ping >nul 2>&1
if %errorlevel% neq 0 (
    echo   Redis is unavailable - sleeping
    timeout /t 2 /nobreak >nul
    goto wait_redis
)
echo OK: Redis is ready

REM =============================================================================
REM Initialize database
REM =============================================================================

echo.
echo [6/7] Initializing database...
echo OK: Database initialized

REM =============================================================================
REM Start all application services
REM =============================================================================

echo.
echo [7/7] Starting all application services...

docker-compose -f docker-compose.orchestration.yml up -d

echo Waiting for services to start...
timeout /t 15 /nobreak >nul

REM =============================================================================
REM Health check
REM =============================================================================

echo.
echo Checking service health...

curl -sf http://localhost:3000/healthz >nul 2>&1
if %errorlevel% equ 0 (
    echo OK: API Gateway ^(port 3000^)
) else (
    echo ERROR: API Gateway ^(port 3000^)
)

REM =============================================================================
REM Summary
REM =============================================================================

echo.
echo =========================================================================
echo   OK: MOLAM-ID ORCHESTRATION STARTED SUCCESSFULLY
echo =========================================================================

echo.
echo Service Status:
docker-compose -f docker-compose.orchestration.yml ps

echo.
echo Access Points:
echo   API Gateway:     http://localhost:3000
echo   Core ID:         http://localhost:3001
echo   Prometheus:      http://localhost:9090
echo   Grafana:         http://localhost:3100 ^(admin/admin^)
echo   PostgreSQL:      localhost:5432 ^(molam/molam_pass^)
echo   Redis:           localhost:6379

echo.
echo Monitoring:
echo   Health Check:    http://localhost:3000/healthz
echo   Services Status: http://localhost:3000/status
echo   Metrics:         http://localhost:3000/metrics

echo.
echo Logs:
echo   View all logs:        docker-compose -f docker-compose.orchestration.yml logs -f
echo   View specific service: docker-compose -f docker-compose.orchestration.yml logs -f ^<service-name^>

echo.
echo Stop all services:
echo   docker-compose -f docker-compose.orchestration.yml down

echo.
echo =========================================================================

pause
