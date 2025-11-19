# 🗄️ Configuration de la base de données Molam-ID

Ce document explique comment créer et initialiser la base de données PostgreSQL pour le système Molam-ID avec toutes les briques.

## 📋 Prérequis

1. **PostgreSQL** (version 12+)
   - Téléchargement: https://www.postgresql.org/download/
   - Assurez-vous que `psql` est accessible via la ligne de commande

2. **Node.js** (version 16+)
   - Téléchargement: https://nodejs.org/

3. **Dépendances npm installées**
   ```bash
   npm install
   ```

## 🚀 Installation complète (2 étapes)

### Étape 1: Créer la base de données

Cette étape crée la base de données vide `molam` et l'utilisateur PostgreSQL.

**Windows:**
```bash
.\create-database.bat
```

**Linux/Mac:**
```bash
psql -U postgres -f create-database.sql
```

> ⚠️ **ATTENTION:** Cette opération supprimera la base de données `molam` si elle existe déjà!

**Ce que fait ce script:**
- Supprime la base `molam` existante (si elle existe)
- Crée l'utilisateur PostgreSQL `molam` avec le mot de passe `molam_pass`
- Crée la base de données `molam` avec l'encodage UTF-8
- Active les extensions `uuid-ossp` et `pgcrypto`
- Configure les privilèges nécessaires

### Étape 2: Créer les tables

Cette étape crée toutes les tables des briques dans la base de données.

**Windows:**
```bash
.\init-database.bat
```

**Linux/Mac:**
```bash
npm run db:init
```

**Ce que fait ce script:**
- Exécute tous les fichiers SQL dans l'ordre correct
- Crée les tables pour toutes les briques (1-36 + audit)
- Initialise les données de référence (rôles, permissions, etc.)
- Affiche un résumé des tables créées

## 📦 Briques incluses

Le script initialise les tables pour les briques suivantes:

| Brique | Description | Fichier SQL |
|--------|-------------|-------------|
| **0-5** | Tables de base (users, sessions, audit, KYC, authZ) | `000_unified_schema.sql` |
| **6** | Password/PIN Reset | `006_password_pin_reset.sql` |
| **7** | Biometrics | `007_biometrics_core.sql` |
| **8** | KYC/AML + Voice Auth | `01_kyc_schema.sql`, `02_kyc_functions.sql`, `002_voice_auth.sql` |
| **9** | Geo-location | `003_geo.sql`, `003_geo_seed.sql` |
| **10** | Device Fingerprinting | `010_device.sql` |
| **11** | MFA/2FA | `011_mfa.sql` |
| **12** | Delegation | `012_delegated_access.sql` |
| **13** | Blacklist | `013_blacklist_suspensions.sql` |
| **14** | Audit Logs | `014_audit_logs.sql` |
| **15** | i18n | `015_i18n.sql` |
| **16** | Foreign Exchange | `016_fx.sql` |
| **17** | User Profile | `017_profile.sql` |
| **18** | Update Profile | `018_update_profile.sql` |
| **19** | Export Profile | `019_export_profile.sql` |
| **20** | RBAC Granular | `020_rbac_granular.sql`, `seed_rbac.sql` |
| **21** | Role Management | `021_role_mgmt.sql` |
| **22** | Admin ID | `022_admin_id.sql` |
| **23** | Sessions Monitoring | `023_sessions_monitoring.sql` |
| **24** | SDK Auth | `024_sdk_auth.sql` |
| **25** | UI ID | `025_ui_id.sql` |
| **26** | Admin UI | `026_admin_ui.sql` |
| **27** | i18n Extended | `027_i18n.sql` |
| **28** | Multi-currency | `028_multicurrency.sql` |
| **29** | User Profile Extended | `029_user_profile.sql` |
| **30** | Profile Export | `030_profile_export.sql` |
| **31** | RBAC Extended | `031_rbac.sql` |
| **32** | API Role Management | `032_role_management.sql` |
| **33** | Admin ID Governance | `033_admin_id_governance.sql` |
| **34** | Sessions Monitoring Extended | `034_sessions_monitoring.sql` |
| **36** | UI ID Extended | `036_ui_id.sql` |
| **Audit** | Système d'audit blockchain | `01_schema.sql`, `02_functions.sql` |

## ✅ Vérification

Après l'exécution, vous devriez voir :

```
✅ Initialisation terminée avec succès!

💡 Vous pouvez maintenant lancer votre serveur avec: npm start
```

Pour vérifier manuellement les tables :

```bash
psql -U molam -d molam -c "\dt molam_*"
```

## 🔧 Dépannage

### Erreur: "Connexion refusée"

**Cause:** PostgreSQL n'est pas démarré ou n'est pas accessible

**Solution:**
- Windows: Vérifiez que le service PostgreSQL est démarré dans Services
- Vérifiez le port dans `.env` (par défaut 5432)

### Erreur: "Password authentication failed"

**Cause:** Mauvais mot de passe dans le fichier `.env`

**Solution:**
- Vérifiez `DB_USER` et `DB_PASSWORD` dans `.env`
- Assurez-vous que l'utilisateur existe dans PostgreSQL

### Erreur: "Database does not exist"

**Cause:** La base de données n'a pas été créée

**Solution:**
```bash
psql -U postgres -c "CREATE DATABASE molam;"
```

### Erreur: "Permission denied"

**Cause:** L'utilisateur n'a pas les permissions nécessaires

**Solution:**
```bash
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE molam TO molam;"
```

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet:

```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=molam
DB_PASSWORD=molam_pass
DB_NAME=molam

# JWT Configuration
JWT_SECRET=votre_secret_jwt_super_securise
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Application
NODE_ENV=development
PORT=3000
```

### Paramètres par défaut

Si aucun fichier `.env` n'est présent, les valeurs par défaut suivantes sont utilisées:
- **Hôte:** `localhost`
- **Port:** `5432`
- **Utilisateur:** `molam`
- **Mot de passe:** `molam_pass`
- **Base de données:** `molam`

## 🔍 Vérification de l'installation

Après l'exécution des scripts, vous pouvez vérifier que tout fonctionne:

### 1. Connexion à la base de données
```bash
psql -U molam -d molam
```

### 2. Lister les tables
```sql
\dt molam_*
```

### 3. Compter les tables
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'molam_%';
```

### 4. Vérifier un utilisateur de test
```sql
SELECT * FROM molam_users LIMIT 1;
```

## 🧹 Nettoyage et maintenance

### Nettoyer les données expirées
```sql
SELECT cleanup_expired_data();
SELECT cleanup_authz_cache();
SELECT cleanup_expired_authz_cache();
```

### Réinitialiser complètement la base
```bash
# 1. Supprimer et recréer la base
.\create-database.bat

# 2. Recréer toutes les tables
.\init-database.bat
```

## 📚 Structure des tables principales

### molam_users
Table centrale des utilisateurs avec informations d'identité, KYC, et préférences.

### molam_sessions
Gestion des sessions avec refresh tokens et suivi des devices.

### molam_audit_logs
Journal d'audit de toutes les actions utilisateurs.

### molam_roles / molam_user_roles
Système RBAC (Role-Based Access Control) pour la gestion des permissions.

### molam_policies
Système ABAC (Attribute-Based Access Control) pour des règles d'autorisation dynamiques.

## 🔐 Sécurité

- Les mots de passe sont hashés avec bcrypt (Argon2id recommandé en production)
- Les tokens sont stockés sous forme de hash
- Les données sensibles sont dans des colonnes JSONB chiffrées (selon la brique)
- Audit trail complet de toutes les opérations

## 📞 Support

Pour toute question ou problème:
1. Consultez les logs d'erreur affichés par les scripts
2. Vérifiez que PostgreSQL est bien démarré
3. Consultez la documentation PostgreSQL: https://www.postgresql.org/docs/

---

**Dernière mise à jour:** 2025-01-19
