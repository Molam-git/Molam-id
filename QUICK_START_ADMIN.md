# Quick Start - Test Admin sur Localhost

Guide rapide pour tester les fonctionnalités admin en local.

## Prérequis

1. PostgreSQL installé et démarré
2. Base de données `molam` créée
3. Variables d'environnement configurées dans `.env`
4. Dépendances installées (`npm install`)

## Étape 1: Vérifier la base de données

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Vérifier que la base molam existe
\l

# Si elle n'existe pas, la créer
CREATE DATABASE molam;

# Se connecter à la base
\c molam

# Vérifier les tables
\dt
```

**Tables importantes à vérifier :**
- `molam_users` - Utilisateurs
- `molam_roles` - Catalogue de rôles
- `molam_user_roles` - Attribution des rôles
- `molam_audit_logs` - Logs d'audit

## Étape 2: Exécuter les migrations

Si les tables n'existent pas, exécutez les scripts SQL :

```bash
psql -U postgres -d molam -f sql/000_unified_schema.sql
psql -U postgres -d molam -f sql/020_rbac_complete.sql
```

Ou si vous avez un script de migration :

```bash
npm run migrate
```

## Étape 3: Démarrer le serveur

```bash
# En mode développement
npm run dev

# Ou en mode normal
npm start
```

Vérifiez que le serveur démarre sans erreur. Vous devriez voir :

```
================================================================================
🚀 MOLAM-ID CORE SERVER
================================================================================
📡 Server listening on port 3001
🌍 Environment: development
📦 Briques: 1-5 (Auth Core), 6 (Password+AuthZ), 10 (Devices), 11 (MFA), 13 (Blacklist), Admin
================================================================================
```

## Étape 4: Créer le Super Admin

```bash
node scripts/create-super-admin.js
```

Suivez les instructions et fournissez :
- **Email** : `admin@molam.sn` (ou votre choix)
- **Mot de passe** : Au moins 8 caractères (ex: `SuperSecure123!`)
- **Téléphone** : Format E.164 (ex: `+221771234567`)

Vous devriez voir :

```
================================================================================
🔐 CRÉATION DU SUPER ADMINISTRATEUR
================================================================================

✅ Super Admin créé avec succès!

📋 Détails du compte:
  - Molam ID: MID-XXXXXXXXXXXX
  - Email: admin@molam.sn
  - Téléphone: +221771234567
  - Rôles: super_admin
  - Statut: active
```

## Étape 5: Tester avec le script automatique

```bash
node test-admin-local.js
```

Ce script va automatiquement :
1. ✅ Vérifier que le serveur fonctionne
2. 🔐 Se connecter avec le super admin
3. 👥 Tester la gestion des utilisateurs
4. 🎭 Tester la gestion des rôles
5. 🔒 Tester la sécurité
6. 🧹 Nettoyer les données de test

## Étape 6: Tester manuellement avec curl

### 1. Login

```bash
curl -X POST http://localhost:3001/api/id/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@molam.sn\",\"password\":\"SuperSecure123!\"}"
```

**Copiez le `access_token` retourné.**

### 2. Lister les utilisateurs

```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### 3. Obtenir les statistiques

```bash
curl -X GET http://localhost:3001/api/admin/users/stats \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### 4. Lister les rôles

```bash
curl -X GET http://localhost:3001/api/admin/roles \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

## Étape 7: Tester avec VSCode REST Client (Recommandé)

Si vous utilisez VSCode :

1. Installez l'extension **REST Client**
2. Ouvrez le fichier `test-admin.http`
3. Modifiez les variables en haut du fichier :
   ```
   @baseUrl = http://localhost:3001
   @email = admin@molam.sn
   @password = SuperSecure123!
   ```
4. Cliquez sur **"Send Request"** au-dessus de chaque requête

C'est la méthode la plus simple et interactive !

## Étape 8: Tester avec Postman

1. Importez la collection depuis `test-admin.http` ou créez manuellement
2. Créez une variable d'environnement `baseUrl` = `http://localhost:3001`
3. Login : `POST {{baseUrl}}/api/id/login`
4. Copiez le token dans les variables d'environnement
5. Testez les autres endpoints

## Dépannage

### Erreur : "Cannot connect to server"
```bash
# Vérifiez que le serveur est démarré
npm start

# Vérifiez le port
netstat -ano | findstr :3001
```

### Erreur : "User not found" au login
```bash
# Recréez le super admin
node scripts/create-super-admin.js
```

### Erreur : "Role not found"
```bash
# Exécutez les seeds de rôles
psql -U postgres -d molam -f brique-20-rbac-granular/sql/seed_rbac.sql
```

### Erreur 500 sur les routes admin
```bash
# Vérifiez les logs du serveur
# Vérifiez que les tables existent dans la BDD
psql -U postgres -d molam -c "\dt"

# Vérifiez les rôles dans la BDD
psql -U postgres -d molam -c "SELECT * FROM molam_roles LIMIT 5;"
```

### Les erreurs de base de données
```bash
# Vérifiez la connexion dans .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=molam
DB_PASSWORD=molam_pass
DB_NAME=molam

# Testez la connexion
psql -U molam -d molam -h localhost
```

## Endpoints Disponibles

### User Management (super_admin uniquement)
- `GET /api/admin/users` - Liste des utilisateurs
- `GET /api/admin/users/stats` - Statistiques
- `GET /api/admin/users/:userId` - Détails utilisateur
- `POST /api/admin/users` - Créer utilisateur
- `PATCH /api/admin/users/:userId` - Modifier utilisateur
- `DELETE /api/admin/users/:userId` - Supprimer utilisateur
- `POST /api/admin/users/:userId/suspend` - Suspendre
- `POST /api/admin/users/:userId/activate` - Activer
- `GET /api/admin/users/:userId/audit` - Logs d'audit

### Role Management (super_admin uniquement)
- `GET /api/admin/roles` - Liste des rôles
- `POST /api/admin/roles` - Créer rôle
- `DELETE /api/admin/roles/:roleName` - Supprimer rôle
- `GET /api/admin/users/:userId/roles` - Rôles utilisateur
- `POST /api/admin/users/:userId/assign-role` - Assigner rôle
- `DELETE /api/admin/users/:userId/revoke-role` - Révoquer rôle

## Prochaines étapes

1. Lisez [ADMIN_GUIDE.md](ADMIN_GUIDE.md) pour la documentation complète
2. Testez toutes les fonctionnalités avec [test-admin.http](test-admin.http)
3. Créez d'autres utilisateurs et testez les permissions
4. Explorez les logs d'audit

## Support

En cas de problème :
1. Vérifiez les logs du serveur (console)
2. Consultez [ADMIN_GUIDE.md](ADMIN_GUIDE.md)
3. Vérifiez la base de données
4. Assurez-vous que toutes les migrations sont exécutées
