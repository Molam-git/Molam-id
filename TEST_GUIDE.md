# Guide de Test - Molam-id (Briques 1-9)

Ce guide explique comment exécuter tous les tests pour les briques 1 à 9 du système Molam-id.

## Vue d'ensemble des tests

Le projet contient des tests pour toutes les briques :

| Brique | Description | Fichier(s) de test |
|--------|-------------|-------------------|
| 1 | Table molam_users | `test_brique1.js` |
| 2 | Token refresh | `test_brique2.js` |
| 3 | Logout | `test_brique3.js` |
| 4 | Onboarding OTP | `test_brique4_foundations.js`, `test_brique4_onboarding.js` |
| 5 | Session Management | `test_brique5.js` |
| 6 | RBAC & AuthZ | `test_brique6_authz.js` |
| 7 | Audit Immuable | `test_brique7.js` |
| 8 | KYC/AML | `test_brique8.js` |
| 9 | Extended AuthZ | `test_brique9.js` |

## Prérequis

### Logiciels requis
- Node.js 18+ et npm
- Docker & Docker Compose
- PostgreSQL client (psql) pour certains tests
- Git Bash ou WSL (pour Windows)

### Installation

```bash
# Installer les dépendances Node.js
npm install

# Vérifier que Docker est installé
docker --version
docker-compose --version
```

## Option 1 : Tests complets avec environnement Docker

### 1. Démarrer l'environnement de test

```bash
# Démarrer tous les services (PostgreSQL, Kafka, MinIO, APIs)
npm run test:env:up

# Attendre que tous les services soient prêts (30-60 secondes)
# Vous pouvez suivre les logs avec:
npm run test:env:logs
```

### 2. Vérifier que les services sont prêts

```bash
# Vérifier Molam API
curl http://localhost:3000/api/health

# Vérifier Audit Verifier
curl http://localhost:4100/health

# Vérifier KYC API
curl http://localhost:4201/health
```

### 3. Créer les buckets MinIO

Pour les briques 7 et 8, vous devez créer les buckets S3 dans MinIO :

```bash
# Ouvrir MinIO Console
# URL: http://localhost:9001
# Login: minioadmin / minioadmin

# Créer les buckets:
# - molam-audit (pour Brique 7)
# - molam-kyc (pour Brique 8)
```

### 4. Exécuter tous les tests

```bash
# Lancer tous les tests
npm test

# OU
npm run test:all
```

### 5. Arrêter l'environnement

```bash
# Arrêter les services
npm run test:env:down

# OU pour nettoyer complètement (supprime les volumes)
docker-compose -f docker-compose.test.yml down -v
```

## Option 2 : Tests individuels par brique

Vous pouvez tester chaque brique individuellement :

```bash
# Brique 1
npm run test:brique1

# Brique 2
npm run test:brique2

# Brique 3
npm run test:brique3

# Brique 4
npm run test:brique4

# Brique 5
npm run test:brique5

# Brique 6
npm run test:brique6

# Brique 7
npm run test:brique7

# Brique 8
npm run test:brique8

# Brique 9
npm run test:brique9
```

## Option 3 : Environnement existant (sans Docker)

Si vous avez déjà un environnement Molam-id en cours d'exécution :

### Configuration requise

```bash
# Variables d'environnement
export API_URL=http://localhost:3000
export VERIFIER_URL=http://localhost:4100
export KYC_API_URL=http://localhost:4201
export POSTGRES_DSN=postgres://molam:molam_pass@localhost:5432/molam
export AUDIT_POSTGRES_DSN=postgres://molam:molam_pass@localhost:5433/molam_audit
export KYC_POSTGRES_DSN=postgres://molam:molam_pass@localhost:5434/molam_kyc
```

### Lancer les tests

```bash
npm test
```

## Résultats des tests

### Format de sortie

Les tests affichent :
- ✅ Tests réussis
- ❌ Tests échoués
- ⚠️  Tests ignorés (fichier manquant)

### Rapport JSON

Un rapport détaillé est généré dans `test-report.json` :

```json
{
  "timestamp": "2025-10-24T...",
  "duration": "45.32",
  "total": 10,
  "passed": 8,
  "failed": 1,
  "skipped": 1,
  "successRate": "80.0",
  "categories": { ... },
  "details": { ... }
}
```

## Tests par catégorie

### Authentification (Briques 1-3, 5)
- Création utilisateurs
- Login/Logout
- Token refresh
- Session management

**Services requis** : PostgreSQL, Molam API

### Onboarding (Brique 4)
- OTP par email/SMS
- Vérification multi-étapes
- KYC niveau P0

**Services requis** : PostgreSQL, Molam API

### Authorization (Briques 6, 9)
- RBAC (Role-Based Access Control)
- ABAC (Attribute-Based Access Control)
- Politiques & décisions

**Services requis** : PostgreSQL, Molam API

### Audit (Brique 7)
- Logs immuables
- Signatures cryptographiques
- Merkle trees
- Vérification d'intégrité

**Services requis** : PostgreSQL (audit), Kafka, MinIO, OpenSearch, Verifier API

### KYC (Brique 8)
- Upload documents
- OCR
- Face matching
- Sanctions screening
- Décisions automatiques

**Services requis** : PostgreSQL (KYC), MinIO, KYC API, KYC Processor

## Troubleshooting

### Les services ne démarrent pas

```bash
# Vérifier les logs
docker-compose -f docker-compose.test.yml logs

# Vérifier l'état des services
docker-compose -f docker-compose.test.yml ps

# Redémarrer les services
docker-compose -f docker-compose.test.yml restart
```

### Tests échouent : "Connection refused"

Les services ne sont peut-être pas encore prêts. Attendez 30-60 secondes après `test:env:up`.

```bash
# Vérifier que les services répondent
curl http://localhost:3000/api/health
curl http://localhost:4100/health
curl http://localhost:4201/health
```

### Tests Brique 7/8 échouent : Bucket not found

Créez manuellement les buckets dans MinIO :

1. Ouvrir http://localhost:9001
2. Login: minioadmin / minioadmin
3. Créer buckets: `molam-audit` et `molam-kyc`

### Base de données non initialisée

```bash
# Recréer les bases de données
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

### Tests KYC timeout

Le processor peut prendre du temps. Augmentez le délai d'attente dans le test :

```javascript
// Dans test_brique8.js, ligne ~60
await new Promise(resolve => setTimeout(resolve, 30000)); // 30 secondes au lieu de 15
```

## CI/CD

### GitHub Actions

Exemple de workflow `.github/workflows/test.yml` :

```yaml
name: Test Briques 1-9

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Start test environment
        run: npm run test:env:up

      - name: Wait for services
        run: sleep 30

      - name: Create MinIO buckets
        run: |
          docker exec molam-minio mc alias set local http://localhost:9000 minioadmin minioadmin
          docker exec molam-minio mc mb local/molam-audit
          docker exec molam-minio mc mb local/molam-kyc

      - name: Run tests
        run: npm test

      - name: Upload test report
        uses: actions/upload-artifact@v2
        if: always()
        with:
          name: test-report
          path: test-report.json

      - name: Cleanup
        if: always()
        run: npm run test:env:down
```

## Performance

### Temps d'exécution approximatifs

- Brique 1-3 : ~5 secondes
- Brique 4 : ~10 secondes
- Brique 5 : ~15 secondes
- Brique 6 : ~8 secondes
- Brique 7 : ~10 secondes
- Brique 8 : ~20 secondes
- Brique 9 : ~8 secondes

**Total** : ~1-2 minutes (selon la performance du système)

## Support

Pour toute question ou problème :
1. Vérifier les logs : `npm run test:env:logs`
2. Consulter le rapport : `test-report.json`
3. Vérifier la documentation des briques individuelles
