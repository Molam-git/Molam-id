@echo off
title MOLAM-ID - Demarrage Automatique

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    MOLAM-ID - DEMARRAGE                        ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo [1/4] Arret des processus Node.js existants...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo      - OK
echo.

echo [2/4] Demarrage du Backend (Port 3000)...
echo      - Ouverture dans une nouvelle fenetre...
start "Molam-ID Backend" cmd /c "cd /d %~dp0 && npm start"
timeout /t 3 /nobreak >nul
echo      - OK
echo.

echo [3/4] Demarrage du Web UI (Port 5173)...
echo      - Ouverture dans une nouvelle fenetre...
start "Molam-ID Web UI" cmd /c "cd /d %~dp0brique-36-ui-id\web && npm run dev"
timeout /t 5 /nobreak >nul
echo      - OK
echo.

echo [4/4] Ouverture du navigateur...
timeout /t 3 /nobreak >nul
start http://localhost:5173
echo      - OK
echo.

echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    DEMARRAGE TERMINE !                         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo  Vous devriez voir 2 nouvelles fenetres:
echo    1. "Molam-ID Backend" - Port 3000
echo    2. "Molam-ID Web UI" - Port 5173
echo.
echo  Et votre navigateur s'est ouvert sur: http://localhost:5173
echo.
echo  NE FERMEZ PAS ces 2 fenetres tant que vous utilisez le systeme !
echo.
echo  Pour arreter le systeme:
echo    - Fermez les 2 fenetres "Molam-ID Backend" et "Molam-ID Web UI"
echo    - Ou appuyez sur Ctrl+C dans chaque fenetre
echo.
echo  Vous pouvez maintenant fermer cette fenetre.
echo.
pause
