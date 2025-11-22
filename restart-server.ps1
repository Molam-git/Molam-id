# Script PowerShell pour redémarrer le serveur Molam-ID

Write-Host "🔄 Redémarrage du serveur Molam-ID..." -ForegroundColor Cyan
Write-Host ""

# Arrêter tous les processus Node.js qui contiennent "server.js"
Write-Host "⏹️  Arrêt du serveur en cours..." -ForegroundColor Yellow
$processes = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*server.js*"
}

if ($processes) {
    $processes | ForEach-Object {
        Write-Host "   Arrêt du processus Node.js (PID: $($_.Id))" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "✅ Serveur arrêté" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Aucun serveur en cours d'exécution" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Démarrage du serveur..." -ForegroundColor Cyan
Write-Host ""

# Démarrer le serveur
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm start"

Write-Host ""
Write-Host "✅ Serveur redémarré !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines étapes :" -ForegroundColor Yellow
Write-Host "   1. Ouvrez http://localhost:3000/admin dans votre navigateur" -ForegroundColor White
Write-Host "   2. Déconnectez-vous si vous êtes déjà connecté" -ForegroundColor White
Write-Host "   3. Reconnectez-vous avec :" -ForegroundColor White
Write-Host "      Email: admin@molam.sn" -ForegroundColor Cyan
Write-Host "      Password: SuperSecure123!" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Vous pourrez maintenant créer des utilisateurs !" -ForegroundColor Green
Write-Host ""

# Attendre avant de fermer
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
