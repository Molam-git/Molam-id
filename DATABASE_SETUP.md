# 🗄️ Configuration de la Base de Données Molam-ID

Ce guide vous explique comment initialiser la base de données PostgreSQL pour Molam-ID.

## 📋 Prérequis

1. **PostgreSQL installé et démarré**
   - Version recommandée: PostgreSQL 14+
   - Port par défaut: 5432

2. **Base de données créée**
   ```bash
   # Se connecter à PostgreSQL
   psql -U postgres

   # Créer la base de données
   CREATE DATABASE molam;

   # Créer l'utilisateur (optionnel)
   CREATE USER molam WITH PASSWORD 'molam_pass';

   # Donner les permissions
   GRANT ALL PRIVILEGES ON DATABASE molam TO molam;
   ```

3. **Fichier .env configuré**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=molam
   DB_PASSWORD=molam_pass
   DB_NAME=molam
   ```

## 🚀 Initialisation de la Base de Données

### Méthode 1: Script Batch (Windows - Recommandé)

Double-cliquez sur le fichier ou exécutez dans le terminal :

```bash
init-database.bat
```

### Méthode 2: Script NPM

```bash
npm run db:init
```

### Méthode 3: Script Node.js direct

```bash
node init-database.js
```

## 📊 Tables créées

Le script va créer automatiquement les tables suivantes :

### Tables de base (Core)
- `molam_users` - Utilisateurs
- `molam_sessions` - Sessions utilisateur
- `molam_audit_logs` - Logs d'audit
- `molam_revoked_tokens` - Tokens révoqués
- `molam_verification_codes` - Codes OTP
- `molam_user_auth` - Authentification externe
- `molam_kyc_docs` - Documents KYC

### RBAC & Authorization
- `molam_roles_catalog` - Catalogue des rôles
- `molam_user_roles` - Attribution des rôles
- `molam_policies` - Policies ABAC
- `molam_authz_decisions` - Décisions d'autorisation
- `molam_authz_cache` - Cache des décisions
- `molam_permissions` - Permissions granulaires
- `molam_role_permissions` - Association rôles ↔ permissions
- `molam_role_hierarchy` - Hiérarchie des rôles
- `molam_attributes` - Attributs utilisateur pour ABAC
- `molam_authz_audit` - Audit des décisions

### Brique 10: Device Fingerprinting
- `molam_devices` - Devices identifiés
- `molam_device_sessions` - Historique des connexions
- `molam_device_changes` - Changements de devices

### Brique 11: MFA/2FA
- `molam_mfa_recovery_codes` - Codes de récupération MFA
- `molam_mfa_logs` - Historique MFA

### Brique 13: Blacklist & Anti-Fraude
- `molam_blacklist` - Entités bloquées
- `molam_failed_login_attempts` - Tentatives échouées
- `molam_blacklist_logs` - Logs de blocages

### Autres tables
- `molam_rate_limits` - Rate limiting
- `molam_webhook_events` - Webhooks reçus

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

## 📝 Fichiers SQL source

Les schémas SQL sont situés dans le dossier `sql/` :

- `sql/000_unified_schema.sql` - Schéma principal unifié
- `sql/010_device_fingerprinting.sql` - Device fingerprinting
- `sql/011_mfa.sql` - MFA/2FA
- `sql/013_blacklist.sql` - Blacklist

## 🔄 Réinitialisation complète

⚠️ **ATTENTION:** Ceci supprime TOUTES les données !

```bash
psql -U molam -d molam -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:init
```

## 📚 Documentation supplémentaire

- [Architecture Molam-ID](./docs/architecture.md)
- [Guide de développement](./docs/development.md)
- [API Documentation](./docs/api.md)

---

**Note:** Pour toute question ou problème, consultez les logs d'erreur affichés par le script.
