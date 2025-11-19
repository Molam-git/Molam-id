@echo off
REM ============================================================================
REM MOLAM-ID - Script de création de la base de données (Windows)
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║         MOLAM-ID - CRÉATION DE LA BASE DE DONNÉES                ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

REM Vérifier que PostgreSQL est accessible
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERREUR: PostgreSQL n'est pas accessible via la ligne de commande
    echo    Assurez-vous que PostgreSQL est installé et que 'psql' est dans le PATH
    echo    Téléchargez PostgreSQL sur https://www.postgresql.org/download/
    pause
    exit /b 1
)

echo ✅ PostgreSQL trouvé
echo.

REM Afficher un avertissement
echo ⚠️  ATTENTION: Ce script va:
echo    1. Supprimer la base de données 'molam' si elle existe
echo    2. Créer une nouvelle base de données vide 'molam'
echo    3. Créer l'utilisateur 'molam' avec le mot de passe 'molam_pass'
echo.
echo    TOUTES LES DONNÉES EXISTANTES SERONT PERDUES!
echo.
echo    Appuyez sur CTRL+C pour annuler, ou
pause

echo.
echo 🚀 Création de la base de données en cours...
echo.

REM Exécuter le script SQL
psql -U postgres -f create-database.sql

if %errorlevel% equ 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════╗
    echo ║                    ✅ SUCCÈS !                                     ║
    echo ╚════════════════════════════════════════════════════════════════════╝
    echo.
    echo La base de données 'molam' a été créée avec succès.
    echo.
    echo 📝 Prochaines étapes:
    echo    1. Exécutez: .\init-database.bat (pour créer les tables)
    echo    2. Exécutez: npm start (pour démarrer le serveur)
    echo.
) else (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════╗
    echo ║                    ❌ ERREUR                                       ║
    echo ╚════════════════════════════════════════════════════════════════════╝
    echo.
    echo La création a échoué. Vérifiez:
    echo    1. PostgreSQL est bien démarré
    echo    2. Vous avez les droits administrateur PostgreSQL
    echo    3. Le mot de passe de l'utilisateur postgres est correct
    echo.
)

pause
