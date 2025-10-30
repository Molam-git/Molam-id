#!/bin/bash
# Script pour exécuter tous les tests des briques Molam-ID

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🧪 TESTS DE TOUTES LES BRIQUES MOLAM-ID              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Compteurs
total_briques=0
passed_briques=0
failed_briques=0

# Fonction pour tester une brique
test_brique() {
    local brique_dir=$1
    local brique_name=$2
    local test_file=$3

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 Test: $brique_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ -d "$brique_dir" ]; then
        if [ -f "$brique_dir/$test_file" ]; then
            cd "$brique_dir"
            if node "$test_file" 2>&1; then
                echo ""
                echo "✅ $brique_name: RÉUSSI"
                ((passed_briques++))
            else
                echo ""
                echo "❌ $brique_name: ÉCHEC"
                ((failed_briques++))
            fi
            cd ..
            ((total_briques++))
        else
            echo "⚠️  Fichier de test non trouvé: $test_file"
        fi
    else
        echo "⚠️  Répertoire non trouvé: $brique_dir"
    fi
}

# Test des briques
test_brique "brique-06-password-reset" "Brique 6 - Password Reset" "test_structure.cjs"
test_brique "brique-07-biometrics" "Brique 7 - Biometrics" "test_structure.js"
test_brique "brique-08-voice-auth" "Brique 8 - Voice Auth" "test_structure.js"
test_brique "brique-10-device" "Brique 10 - Device Fingerprint" "test_structure.cjs"
test_brique "brique-21-role-mgmt" "Brique 21 - API Role Management" "test_structure.cjs"
test_brique "brique-22-admin-id" "Brique 22 - API Admin ID" "test_structure.cjs"
test_brique "brique-23-sessions-monitoring" "Brique 23 - Sessions Monitoring" "test_structure.cjs"
test_brique "brique-24-sdk-auth" "Brique 24 - SDK Auth" "test_structure.cjs"
test_brique "brique-25-ui-id" "Brique 25 - UI ID Management" "test_structure.cjs"
test_brique "brique-26-admin-ui" "Brique 26 - Admin Console UI" "test_structure.cjs"
test_brique "brique-27-i18n" "Brique 27 - Multilingue (i18n)" "test_structure.cjs"
test_brique "brique-29-user-profile" "Brique 29 - User Profile" "test_structure.cjs"
test_brique "brique-30-export-profile" "Brique 30 - Export Profile (GDPR)" "test_structure.cjs"
test_brique "brique-31-rbac-granular" "Brique 31 - RBAC Granularité" "test_structure.cjs"
test_brique "brique-32-api-role-mgmt" "Brique 32 - API Role Management" "test_structure.cjs"

# Rapport final
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    📊 RAPPORT DE SYNTHÈSE                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Total briques testées: $total_briques"
echo "✅ Briques réussies: $passed_briques"
echo "❌ Briques échouées: $failed_briques"
echo ""

if [ $failed_briques -eq 0 ]; then
    success_rate=100
    echo "🎉 SUCCÈS: Toutes les briques ont passé les tests! (${success_rate}%)"
    echo ""
    exit 0
else
    success_rate=$((passed_briques * 100 / total_briques))
    echo "⚠️  Taux de réussite: ${success_rate}%"
    echo ""
    exit 1
fi
