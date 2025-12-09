@echo off
REM =============================================================================
REM Build and Push Molam ID Standalone API to GHCR
REM =============================================================================

echo.
echo ================================================================
echo   Building Molam ID Standalone API
echo ================================================================
echo.

cd /d %~dp0

REM Build the image
echo [1/3] Building Docker image...
docker build -t molam-id-standalone-api:latest .

if errorlevel 1 (
    echo ERROR: Docker build failed!
    exit /b 1
)

echo.
echo [2/3] Tagging image for GHCR...
docker tag molam-id-standalone-api:latest ghcr.io/malang27/molam-id-api:latest

if errorlevel 1 (
    echo ERROR: Docker tag failed!
    exit /b 1
)

echo.
echo [3/3] Pushing to GHCR...
echo You may need to login first with: docker login ghcr.io -u malang27
docker push ghcr.io/malang27/molam-id-api:latest

if errorlevel 1 (
    echo ERROR: Docker push failed!
    echo.
    echo Try logging in first:
    echo   docker login ghcr.io -u malang27
    exit /b 1
)

echo.
echo ================================================================
echo   SUCCESS! Image pushed to ghcr.io/malang27/molam-id-api:latest
echo ================================================================
echo.
echo Next steps:
echo   1. Go to your Kubernetes control plane
echo   2. Restart the deployment:
echo      kubectl rollout restart deployment/molam-id-api -n molam
echo   3. Wait for pods to be ready:
echo      kubectl get pods -n molam -w
echo   4. Test the API:
echo      curl https://app.molam.tech/api/id/signup
echo.

pause
