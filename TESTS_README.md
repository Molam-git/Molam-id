# Tests - Molam-id (Briques 1-9)

## 📋 Vue d'ensemble

Ce projet contient une suite de tests complète pour toutes les briques du système Molam-id (1 à 9).

### Fichiers de tests créés

| Fichier | Brique | Description |
|---------|--------|-------------|
| `src/test_brique1.js` | 1 | Table molam_users |
| `src/test_brique2.js` | 2 | Token refresh |
| `src/test_brique3.js` | 3 | Logout |
| `src/test_brique4_foundations.js` | 4 | Onboarding foundations |
| `src/test_brique4_onboarding.js` | 4 | Onboarding flow complet |
| `src/test_brique5.js` | 5 | **Session Management** ✨ NOUVEAU |
| `src/test_brique6_authz.js` | 6 | RBAC & AuthZ |
| `src/test_brique7.js` | 7 | **Audit Logs Immuables** ✨ NOUVEAU |
| `src/test_brique8.js` | 8 | **KYC/AML Pipeline** ✨ NOUVEAU |
| `src/test_brique9.js` | 9 | Extended AuthZ |

### Infrastructure de test

| Fichier | Description |
|---------|-------------|
| `src/test_runner.js` | Orchestrateur principal (exécute tous les tests) |
| `docker-compose.test.yml` | Environnement Docker complet pour les tests |
| `run_tests.sh` | Script bash pour préparer et lancer tous les tests |
| `TEST_GUIDE.md` | Guide détaillé d'utilisation |
| `test-report.json` | Rapport JSON généré automatiquement |

## 🚀 Quick Start

### Option 1 : Script automatique (Recommandé)

```bash
# Rendre le script exécutable
chmod +x run_tests.sh

# Lancer le script
./run_tests.sh
```

Ce script :
1. ✅ Installe les dépendances
2. ✅ Démarre Docker Compose
3. ✅ Attend que les services soient prêts
4. ✅ Configure MinIO (buckets S3)
5. ✅ Vérifie les bases de données
6. ✅ Lance tous les tests
7. ✅ Génère un rapport

### Option 2 : Manuelle avec npm

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer l'environnement Docker
npm run test:env:up

# 3. Attendre 30 secondes puis créer les buckets MinIO
# Ouvrir http://localhost:9001 (minioadmin/minioadmin)
# Créer buckets: molam-audit, molam-kyc

# 4. Lancer tous les tests
npm test

# 5. Arrêter l'environnement
npm run test:env:down
```

### Option 3 : Tests individuels

```bash
# Tester une brique spécifique
npm run test:brique1
npm run test:brique2
npm run test:brique5  # Session Management
npm run test:brique7  # Audit
npm run test:brique8  # KYC
```

## 📊 Rapport de tests

Après l'exécution, un rapport `test-report.json` est généré :

```json
{
  "timestamp": "2025-10-24T12:00:00.000Z",
  "duration": "45.32",
  "total": 10,
  "passed": 9,
  "failed": 0,
  "skipped": 1,
  "successRate": "90.0",
  "categories": {
    "auth": { "passed": 4, "failed": 0, "skipped": 0 },
    "onboarding": { "passed": 2, "failed": 0, "skipped": 0 },
    "authz": { "passed": 2, "failed": 0, "skipped": 0 },
    "audit": { "passed": 1, "failed": 0, "skipped": 0 },
    "kyc": { "passed": 0, "failed": 0, "skipped": 1 }
  }
}
```

## 🏗️ Architecture de test

```
Docker Compose Test Environment
├── postgres-main (5432)      → Briques 1-6, 9
├── postgres-audit (5433)     → Brique 7
├── postgres-kyc (5434)       → Brique 8
├── kafka + zookeeper (9092)  → Brique 7
├── minio (9000/9001)         → Briques 7, 8
├── opensearch (9200)         → Brique 7
├── molam-api (3000)          → API principale
├── audit-verifier (4100)     → API Audit
├── audit-writer              → Worker Audit
├── batch-uploader            → Worker Audit
├── kyc-api (4201)            → API KYC
└── kyc-processor             → Worker KYC
```

## 📝 Nouveaux tests créés

### Brique 5 : Session Management (`test_brique5.js`)

Teste :
- ✅ Device binding lors du login
- ✅ Token rotation sur refresh
- ✅ Multi-device sessions
- ✅ Liste des sessions actives
- ✅ Révocation de session spécifique
- ✅ Révocation de toutes les sessions
- ✅ Validation des tokens révoqués

### Brique 7 : Audit Immuable (`test_brique7.js`)

Teste :
- ✅ Verifier API health check
- ✅ Insertion d'événements d'audit
- ✅ Vérification d'intégrité (hash + signature)
- ✅ Tables append-only
- ✅ Chaîne de hash (prev_hash)
- ✅ Merkle trees (via batches)

### Brique 8 : KYC/AML (`test_brique8.js`)

Teste :
- ✅ KYC API health check
- ✅ Upload multipart de documents
- ✅ Stockage S3/MinIO crypté
- ✅ Traitement asynchrone (processor)
- ✅ OCR sur documents
- ✅ Face matching & liveness
- ✅ Sanctions screening
- ✅ Décisions automatiques

## 🎯 Services nécessaires

### Pour toutes les briques (1-6, 9)
- PostgreSQL (port 5432)
- Molam API (port 3000)

### Pour Brique 7 (Audit)
- PostgreSQL Audit (port 5433)
- Kafka (port 9092)
- MinIO (ports 9000, 9001)
- OpenSearch (port 9200)
- Audit Verifier API (port 4100)

### Pour Brique 8 (KYC)
- PostgreSQL KYC (port 5434)
- MinIO (ports 9000, 9001)
- KYC API (port 4201)

## 🔧 Scripts npm disponibles

| Commande | Description |
|----------|-------------|
| `npm test` | Lance tous les tests |
| `npm run test:all` | Lance tous les tests (alias) |
| `npm run test:brique1` | Test Brique 1 |
| `npm run test:brique2` | Test Brique 2 |
| `npm run test:brique3` | Test Brique 3 |
| `npm run test:brique4` | Test Brique 4 (foundations + onboarding) |
| `npm run test:brique5` | Test Brique 5 (Session Management) |
| `npm run test:brique6` | Test Brique 6 (RBAC & AuthZ) |
| `npm run test:brique7` | Test Brique 7 (Audit) |
| `npm run test:brique8` | Test Brique 8 (KYC) |
| `npm run test:brique9` | Test Brique 9 (Extended AuthZ) |
| `npm run test:env:up` | Démarre l'environnement Docker |
| `npm run test:env:down` | Arrête l'environnement Docker |
| `npm run test:env:logs` | Affiche les logs Docker |

## 📖 Documentation

Pour un guide détaillé, voir [TEST_GUIDE.md](TEST_GUIDE.md)

## 🐛 Troubleshooting

### Services ne démarrent pas

```bash
# Vérifier les logs
npm run test:env:logs

# Redémarrer proprement
npm run test:env:down
docker system prune -f
npm run test:env:up
```

### Tests timeout

Augmenter les délais d'attente :
- Après `test:env:up` : attendre 60 secondes au lieu de 30
- Dans `test_brique8.js` : ligne 60, passer de 15000 à 30000ms

### Buckets MinIO non créés

Créer manuellement :
1. Ouvrir http://localhost:9001
2. Login: minioadmin / minioadmin
3. Créer buckets: `molam-audit`, `molam-kyc`

### Base de données vide

```bash
# Recréer les volumes
npm run test:env:down
docker volume prune -f
npm run test:env:up
```

## 📈 Performances

Temps d'exécution moyen (sur machine standard) :

- **Briques 1-3** : ~10 secondes
- **Brique 4** : ~15 secondes
- **Brique 5** : ~20 secondes
- **Brique 6** : ~10 secondes
- **Brique 7** : ~15 secondes
- **Brique 8** : ~25 secondes
- **Brique 9** : ~10 secondes

**Total** : ~1-2 minutes

## ✨ Nouveautés

### Session Management complet (Brique 5)
- Nouveau fichier de test avec 11 étapes de validation
- Couvre device binding, multi-sessions, révocations

### Audit Logs testable (Brique 7)
- Test d'intégrité cryptographique
- Vérification de la chaîne de hash
- Test de l'API verifier

### KYC Pipeline end-to-end (Brique 8)
- Upload de documents réels
- Test du workflow complet (OCR → Face → Sanctions → Décision)
- Validation des tables de base de données

## 🎓 Utilisation en CI/CD

Le fichier `docker-compose.test.yml` est prêt pour l'intégration CI/CD :

```yaml
# Exemple GitHub Actions
- name: Run tests
  run: |
    npm run test:env:up
    sleep 30
    npm test
    npm run test:env:down
```

## 📞 Support

Pour toute question :
1. Consulter [TEST_GUIDE.md](TEST_GUIDE.md)
2. Vérifier les logs : `npm run test:env:logs`
3. Consulter le rapport : `test-report.json`

---

**🎉 Système de tests complet pour Molam-id Briques 1-9 !**
