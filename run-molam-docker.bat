@echo off
title MOLAM-ID - Docker Build & Run
cls

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║              MOLAM-ID - DOCKER BUILD ^& RUN                     ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo Ce script va :
echo   1. Arreter les conteneurs existants
echo   2. Builder les images Docker
echo   3. Demarrer tous les services (DB, API, Web UI)
echo.
pause

echo.
echo [1/4] Arret des conteneurs existants...
docker-compose -f docker-compose.full.yml down
echo      - OK
echo.

echo [2/4] Build des images Docker...
echo      (Cela peut prendre quelques minutes la premiere fois)
docker-compose -f docker-compose.full.yml build
if %errorlevel% neq 0 (
    echo      - ERREUR lors du build !
    pause
    exit /b 1
)
echo      - OK
echo.

echo [3/4] Demarrage des conteneurs...
docker-compose -f docker-compose.full.yml up -d
if %errorlevel% neq 0 (
    echo      - ERREUR lors du demarrage !
    pause
    exit /b 1
)
echo      - OK
echo.

echo [4/4] Attente du demarrage complet...
timeout /t 5 /nobreak >nul
echo      - OK
echo.

echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    DEMARRAGE TERMINE !                         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo  Services en cours d'execution:
echo    - Base de donnees PostgreSQL : localhost:5432
echo    - Backend API                : http://localhost:3000
echo    - Web UI                     : http://localhost:5173
echo.
echo  Vous pouvez maintenant acceder a l'application sur :
echo    ^> http://localhost:5173
echo.

echo  Pour voir les logs en temps reel :
echo    docker-compose -f docker-compose.full.yml logs -f
echo.
echo  Pour arreter tous les services :
echo    docker-compose -f docker-compose.full.yml down
echo.

start http://localhost:5173

echo  Ouverture du navigateur...
echo.
pause
