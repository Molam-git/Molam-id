@echo off
REM ============================================================================
REM MOLAM-ID - Script de configuration complète (Windows)
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║         MOLAM-ID - CONFIGURATION COMPLÈTE                        ║
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

REM Lancer le script Node.js
node setup-complete.js

if %errorlevel% equ 0 (
    echo.
    echo 🎉 Configuration terminée avec succès!
    echo.
) else (
    echo.
    echo ❌ La configuration a échoué.
    echo.
)

pause
