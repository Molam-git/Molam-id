@echo off
REM Script pour exécuter tous les tests des briques Molam-ID

echo ╔════════════════════════════════════════════════════════════════╗
echo ║         🧪 TESTS DE TOUTES LES BRIQUES MOLAM-ID              ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

set total_briques=0
set passed_briques=0
set failed_briques=0

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 6 - Password Reset
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-06-password-reset
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 7 - Biometrics
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-07-biometrics
node test_structure.js
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 8 - Voice Auth
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-08-voice-auth
node test_structure.js
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 10 - Device Fingerprint
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-10-device
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 21 - API Role Management
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-21-role-mgmt
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 22 - API Admin ID
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-22-admin-id
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 23 - Sessions Monitoring
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-23-sessions-monitoring
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 24 - SDK Auth
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-24-sdk-auth
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 25 - UI ID Management
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-25-ui-id
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 26 - Admin Console UI
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-26-admin-ui
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 27 - Multilingue (i18n)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-27-i18n
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 29 - User Profile
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-29-user-profile
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 30 - Export Profile (GDPR)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-30-export-profile
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 31 - RBAC Granularité
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-31-rbac-granular
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔍 Test: Brique 32 - API Role Management
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd brique-32-api-role-mgmt
node test_structure.cjs
if %ERRORLEVEL% EQU 0 (
    set /a passed_briques+=1
) else (
    set /a failed_briques+=1
)
set /a total_briques+=1
cd ..

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    📊 RAPPORT DE SYNTHÈSE                      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 📦 Total briques testées: %total_briques%
echo ✅ Briques réussies: %passed_briques%
echo ❌ Briques échouées: %failed_briques%
echo.

if %failed_briques% EQU 0 (
    echo 🎉 SUCCÈS: Toutes les briques ont passé les tests! (100%%)
    exit /b 0
) else (
    echo ⚠️  Des tests ont échoué
    exit /b 1
)
