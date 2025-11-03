# Guide de Test - Molam-ID

**Comment tester toutes les briques implémentées**

---

## Prérequis

1. **Serveur démarré**:
```bash
cd c:\Users\lomao\Desktop\Molam\Molam-id
npm start
```

2. **Base de données PostgreSQL active**:
```bash
docker ps | findstr molam-postgres
```

3. **Outil de test HTTP**:
   - Postman (recommandé)
   - Insomnia
   - curl
   - VS Code REST Client extension

---

## Test 1: Health Check ✅

### Vérifier que le serveur fonctionne

**Requête**:
```http
GET http://localhost:3000/
Accept: application/json
```

**Réponse attendue**:
```json
{
  "service": "Molam-ID Core",
  "version": "1.0.0",
  "status": "running",
  "briques": ["1-Auth", "2-Sessions", "3-JWT", ...],
  "timestamp": "2025-11-02T...",
  "environment": "development"
}
```

**Via curl**:
```bash
curl http://localhost:3000/api/health
```

---

## Test 2: Créer un Utilisateur

### Inscription d'un nouvel utilisateur

**Requête**:
```http
POST http://localhost:3000/api/id/signup/init
Content-Type: application/json

{
  "channel": "email",
  "identifier": "test@molam.sn",
  "password": "SecurePass123!",
  "full_name": "Test User"
}
```

**Réponse attendue**:
```json
{
  "signup_id": "...",
  "channel": "email",
  "identifier": "test@molam.sn",
  "expires_at": "...",
  "message": "OTP sent to test@molam.sn"
}
```

**Note**: Le code OTP sera affiché dans les logs du serveur (console).

---

## Test 3: Vérifier l'OTP et Compléter l'Inscription

### Étape 2: Vérifier l'OTP

**Récupérer l'OTP des logs**:
```bash
# Chercher dans la console du serveur:
# "📧 OTP Code: 123456"
```

**Requête**:
```http
POST http://localhost:3000/api/id/signup/verify
Content-Type: application/json

{
  "signup_id": "VOTRE_SIGNUP_ID",
  "code": "123456"
}
```

**Réponse attendue**:
```json
{
  "signup_id": "...",
  "verified": true,
  "message": "OTP verified successfully"
}
```

### Étape 3: Compléter l'inscription

**Requête**:
```http
POST http://localhost:3000/api/id/signup/complete
Content-Type: application/json

{
  "signup_id": "VOTRE_SIGNUP_ID"
}
```

**Réponse attendue**:
```json
{
  "user_id": "...",
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "expires_in": 900,
  "session_id": "..."
}
```

**💾 IMPORTANT**: Sauvegarder le `access_token` et le `user_id` pour les tests suivants!

---

## Test 4: Login

### Se connecter avec email/password

**Requête**:
```http
POST http://localhost:3000/api/id/login
Content-Type: application/json

{
  "identifier": "test@molam.sn",
  "password": "SecurePass123!",
  "identifier_type": "email"
}
```

**Réponse attendue**:
```json
{
  "user_id": "...",
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 900,
  "session_id": "..."
}
```

---

## Test 5: MFA/2FA (Brique 11) 🔐

### 5.1 Setup MFA

**Requête**:
```http
POST http://localhost:3000/api/id/mfa/setup
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

**Réponse attendue**:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "recoveryCodes": [
    "ABCD-1234",
    "EFGH-5678",
    ...
  ],
  "otpauth_url": "otpauth://totp/..."
}
```

**Actions**:
1. Ouvrir Google Authenticator sur votre téléphone
2. Scanner le QR code (afficher l'image base64 dans le navigateur)
3. Sauvegarder les recovery codes

### 5.2 Activer MFA

**Obtenir le code TOTP depuis Google Authenticator** (6 chiffres)

**Requête**:
```http
POST http://localhost:3000/api/id/mfa/enable
Authorization: Bearer VOTRE_ACCESS_TOKEN
Content-Type: application/json

{
  "code": "123456"
}
```

**Réponse attendue**:
```json
{
  "message": "MFA enabled successfully",
  "mfa_enabled": true
}
```

### 5.3 Vérifier MFA

**Requête**:
```http
POST http://localhost:3000/api/id/mfa/verify
Authorization: Bearer VOTRE_ACCESS_TOKEN
Content-Type: application/json

{
  "code": "654321"
}
```

### 5.4 Status MFA

**Requête**:
```http
GET http://localhost:3000/api/id/mfa/status
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

**Réponse attendue**:
```json
{
  "mfa_enabled": true,
  "has_backup_codes": true,
  "backup_codes_count": 8
}
```

---

## Test 6: Password Reset (Brique 6) 🔑

### 6.1 Demander un reset

**Requête**:
```http
POST http://localhost:3000/api/id/password/forgot
Content-Type: application/json

{
  "email": "test@molam.sn"
}
```

**Réponse attendue**:
```json
{
  "message": "If this email exists, a reset link has been sent"
}
```

**Note**: Le lien de reset sera dans les logs du serveur.

### 6.2 Reset le password

**Récupérer le token des logs**:
```
🔗 Reset Link: http://localhost:3000/reset-password?token=ABC123...
```

**Requête**:
```http
POST http://localhost:3000/api/id/password/reset
Content-Type: application/json

{
  "token": "ABC123...",
  "new_password": "NewSecurePass456!"
}
```

**Réponse attendue**:
```json
{
  "message": "Password reset successfully"
}
```

### 6.3 Changer le password (authentifié)

**Requête**:
```http
POST http://localhost:3000/api/id/password/change
Authorization: Bearer VOTRE_ACCESS_TOKEN
Content-Type: application/json

{
  "old_password": "NewSecurePass456!",
  "new_password": "AnotherPass789!"
}
```

---

## Test 7: Device Fingerprinting (Brique 10) 📱

### 7.1 Enregistrer un device

**Requête**:
```http
POST http://localhost:3000/api/id/devices/register
Authorization: Bearer VOTRE_ACCESS_TOKEN
Content-Type: application/json

{
  "device_info": {
    "device_type": "mobile",
    "os": "Android",
    "os_version": "13",
    "browser": "Chrome",
    "browser_version": "120",
    "screen_resolution": "1080x2400",
    "timezone": "Africa/Dakar",
    "language": "fr-SN",
    "country": "SN",
    "city": "Dakar",
    "metadata": {
      "canvas_fingerprint": "abc123",
      "webgl_fingerprint": "def456"
    }
  }
}
```

**Réponse attendue**:
```json
{
  "device_id": "...",
  "fingerprint": "sha256_hash...",
  "is_new_device": true,
  "trust_score": 50,
  "anomalies": {
    "detected": true,
    "reasons": ["new_device"],
    "risk_score": 20
  }
}
```

### 7.2 Lister mes devices

**Requête**:
```http
GET http://localhost:3000/api/id/devices
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

### 7.3 Historique d'un device

**Requête**:
```http
GET http://localhost:3000/api/id/devices/DEVICE_ID/sessions
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

### 7.4 Mettre à jour la confiance

**Requête**:
```http
POST http://localhost:3000/api/id/devices/DEVICE_ID/trust
Authorization: Bearer VOTRE_ACCESS_TOKEN
Content-Type: application/json

{
  "trust_level": "trusted"
}
```

---

## Test 8: Blacklist (Brique 13) 🚫

### 8.1 Tester l'auto-blacklist

**Faire 6 tentatives de login échouées**:

```bash
# Tentative 1
curl -X POST http://localhost:3000/api/id/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@molam.sn","password":"WRONG_PASSWORD","identifier_type":"email"}'

# Tentative 2
curl -X POST http://localhost:3000/api/id/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@molam.sn","password":"WRONG_PASSWORD","identifier_type":"email"}'

# ... Répéter 5 fois
```

**Après 5 tentatives**, l'utilisateur sera blacklisté automatiquement pour 24h.

**Tentative 6**:
```http
POST http://localhost:3000/api/id/login
Content-Type: application/json

{
  "identifier": "test@molam.sn",
  "password": "SecurePass123!",
  "identifier_type": "email"
}
```

**Réponse attendue**:
```json
{
  "error": "Access denied",
  "message": "Your account has been temporarily blocked due to suspicious activity"
}
```

### 8.2 Blacklist manuelle (Admin)

**Note**: Vous devez d'abord attribuer le rôle `id_admin` à votre utilisateur.

**Ajouter à la blacklist**:
```http
POST http://localhost:3000/api/id/blacklist/add
Authorization: Bearer ADMIN_ACCESS_TOKEN
Content-Type: application/json

{
  "type": "ip",
  "value": "192.168.1.100",
  "reason": "Suspicious activity detected",
  "severity": "high",
  "expires_at": null
}
```

**Lister la blacklist**:
```http
GET http://localhost:3000/api/id/blacklist
Authorization: Bearer ADMIN_ACCESS_TOKEN
```

---

## Test 9: RBAC & Permissions (Briques 20-23) 👥

### 9.1 Attribuer le rôle admin

**D'abord, obtenir votre user_id**:
```sql
-- Via database
docker exec molam-postgres psql -U molam -d molam -c "SELECT id, email FROM molam_users WHERE email = 'test@molam.sn';"
```

**Attribuer le rôle admin**:
```http
POST http://localhost:3000/v1/authz/users/VOTRE_USER_ID/roles
Authorization: Bearer VOTRE_ACCESS_TOKEN
Content-Type: application/json

{
  "role_name": "id_admin",
  "module": "id",
  "trusted_level": 100
}
```

**Note**: Pour ce premier test, vous devrez peut-être l'attribuer directement en DB:
```sql
docker exec molam-postgres psql -U molam -d molam -c "
  INSERT INTO molam_user_roles (user_id, role_name, module, trusted_level)
  VALUES ('VOTRE_USER_ID', 'id_admin', 'id', 100);
"
```

### 9.2 Lister les rôles d'un user

**Requête**:
```http
GET http://localhost:3000/v1/authz/users/VOTRE_USER_ID/roles
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

**Réponse attendue**:
```json
{
  "user_id": "...",
  "roles": [
    {
      "role_name": "id_admin",
      "module": "id",
      "trusted_level": 100
    }
  ]
}
```

### 9.3 Lister les permissions

**Requête**:
```http
GET http://localhost:3000/v1/authz/users/VOTRE_USER_ID/permissions
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

**Réponse attendue**:
```json
{
  "user_id": "...",
  "permissions": [
    {
      "permission_name": "id:user:read",
      "module": "id",
      "resource": "user",
      "action": "read",
      "description": "Lire les informations utilisateur"
    },
    ...
  ]
}
```

### 9.4 Décision d'autorisation

**Requête**:
```http
POST http://localhost:3000/v1/authz/decide
Content-Type: application/json

{
  "user_id": "VOTRE_USER_ID",
  "path": "/api/id/users",
  "method": "GET",
  "module": "id",
  "context": {}
}
```

**Réponse attendue**:
```json
{
  "decision": "allow",
  "ttl": 300,
  "auditId": "abc123...",
  "reason": "Admin role - full access",
  "cached": false
}
```

---

## Test 10: Sessions Management

### 10.1 Lister mes sessions actives

**Requête**:
```http
GET http://localhost:3000/api/id/sessions
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

### 10.2 Révoquer une session

**Requête**:
```http
POST http://localhost:3000/api/id/sessions/SESSION_ID/revoke
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

### 10.3 Révoquer toutes les sessions

**Requête**:
```http
POST http://localhost:3000/api/id/sessions/revoke-all
Authorization: Bearer VOTRE_ACCESS_TOKEN
```

---

## Test 11: Base de Données

### Vérifier les tables créées

```bash
docker exec molam-postgres psql -U molam -d molam -c "\dt molam_*"
```

**Résultat attendu**: 22 tables

### Vérifier les rôles

```bash
docker exec molam-postgres psql -U molam -d molam -c "
  SELECT role_name, module, display_name FROM molam_roles;
"
```

**Résultat attendu**: 4 rôles (id_user, id_moderator, id_admin, superadmin)

### Vérifier les permissions

```bash
docker exec molam-postgres psql -U molam -d molam -c "
  SELECT permission_name, module FROM molam_permissions;
"
```

**Résultat attendu**: 9 permissions

### Vérifier les policies

```bash
docker exec molam-postgres psql -U molam -d molam -c "
  SELECT name, effect, priority FROM molam_policies;
"
```

**Résultat attendu**: 3 policies

---

## Checklist de Test Complet ✅

- [ ] ✅ Serveur démarre sans erreur
- [ ] ✅ Health check répond
- [ ] ✅ Signup (init → verify → complete)
- [ ] ✅ Login avec email/password
- [ ] ✅ MFA Setup (QR code généré)
- [ ] ✅ MFA Enable (code TOTP vérifié)
- [ ] ✅ Password Forgot (token généré)
- [ ] ✅ Password Reset (avec token)
- [ ] ✅ Password Change (authentifié)
- [ ] ✅ Device Register (fingerprint créé)
- [ ] ✅ Device List (mes appareils)
- [ ] ✅ Blacklist Auto (après 5 tentatives)
- [ ] ✅ Blacklist Manual (admin)
- [ ] ✅ Role Assign (id_admin)
- [ ] ✅ Permissions List (9 permissions ID)
- [ ] ✅ AuthZ Decision (allow/deny)
- [ ] ✅ Sessions List
- [ ] ✅ Session Revoke

---

## Problèmes Courants

### 1. "Not authenticated"
**Solution**: Ajouter l'header `Authorization: Bearer VOTRE_TOKEN`

### 2. "Access denied - Blacklisted"
**Solution**: Attendre 24h ou supprimer manuellement de la blacklist:
```sql
docker exec molam-postgres psql -U molam -d molam -c "
  DELETE FROM molam_blacklist WHERE value = 'test@molam.sn';
"
```

### 3. "Permission denied"
**Solution**: Attribuer le rôle approprié en DB

### 4. "Invalid OTP"
**Solution**: Vérifier que le code est bien récupéré des logs du serveur

---

## Script de Test Automatique

Créer un fichier `test.http` dans VS Code avec REST Client:

```http
### Variables
@baseUrl = http://localhost:3000
@accessToken = VOTRE_TOKEN

### 1. Health Check
GET {{baseUrl}}/api/health

### 2. Signup Init
POST {{baseUrl}}/api/id/signup/init
Content-Type: application/json

{
  "channel": "email",
  "identifier": "test@molam.sn",
  "password": "SecurePass123!",
  "full_name": "Test User"
}

### 3. Login
POST {{baseUrl}}/api/id/login
Content-Type: application/json

{
  "identifier": "test@molam.sn",
  "password": "SecurePass123!",
  "identifier_type": "email"
}

### 4. MFA Setup
POST {{baseUrl}}/api/id/mfa/setup
Authorization: Bearer {{accessToken}}

### 5. List Devices
GET {{baseUrl}}/api/id/devices
Authorization: Bearer {{accessToken}}

### 6. List Sessions
GET {{baseUrl}}/api/id/sessions
Authorization: Bearer {{accessToken}}
```

---

## Conclusion

Avec ce guide, vous pouvez tester:
- ✅ Toutes les briques de Sprint 1 (MFA, Devices, Blacklist, Password Reset)
- ✅ Toutes les briques de Sprint 2 (RBAC, Permissions, Policies, Audit)
- ✅ L'intégration complète du système

**Prochaine étape**: Si tous les tests passent, on peut commencer Sprint 3! 🚀
