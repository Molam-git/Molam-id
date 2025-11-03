@echo off
REM ============================================================================
REM MOLAM-ID - Script d'initialisation de la base de données (Windows)
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║         MOLAM-ID - INITIALISATION DE LA BASE DE DONNÉES          ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

REM Vérifier que Node.js est installé
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERREUR: Node.js n'est pas installé
    echo    Téléchargez-le sur https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js trouvé:
node --version
echo.

REM Vérifier que PostgreSQL est accessible
echo 🔌 Vérification de PostgreSQL...
echo.

REM Lancer le script Node.js
node init-database.js

if %errorlevel% equ 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════╗
    echo ║                    ✅ SUCCÈS !                                     ║
    echo ╚════════════════════════════════════════════════════════════════════╝
    echo.
    echo La base de données a été initialisée avec succès.
    echo Vous pouvez maintenant lancer votre serveur avec: npm start
    echo.
) else (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════╗
    echo ║                    ❌ ERREUR                                       ║
    echo ╚════════════════════════════════════════════════════════════════════╝
    echo.
    echo L'initialisation a échoué. Vérifiez:
    echo   1. PostgreSQL est bien démarré
    echo   2. Votre fichier .env contient les bonnes informations
    echo   3. L'utilisateur PostgreSQL a les permissions nécessaires
    echo.
)

pause
