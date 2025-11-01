@echo off
echo ========================================
echo   MOLAM-ID - Redemarrage Backend
echo ========================================
echo.

echo [1/3] Arret des processus Node.js...
taskkill /F /IM node.exe 2>nul
if %errorlevel% == 0 (
    echo    - Processus Node arretes
) else (
    echo    - Aucun processus Node en cours
)
echo.

echo [2/3] Attente de 2 secondes...
timeout /t 2 /nobreak >nul
echo.

echo [3/3] Demarrage du serveur backend...
echo    - Port: 3000
echo    - Briques: 1-6 (Auth, Sessions, JWT, Onboarding, LoginV2, AuthZ)
echo.
echo Appuyez sur Ctrl+C pour arreter le serveur
echo ========================================
echo.

npm start
