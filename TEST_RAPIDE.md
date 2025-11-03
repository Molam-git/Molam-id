# Test Rapide - Molam-ID

## Serveur

✅ **Serveur actif** sur port 3000
✅ **Health check** fonctionne: http://localhost:3000/api/health

## Comment tester

### Option 1: VS Code REST Client (RECOMMANDÉ)

1. **Installer l'extension**: "REST Client" par Huachao Mao dans VS Code

2. **Ouvrir le fichier**: [test.http](./test.http)

3. **Utiliser les tests**:
   - Cliquer sur "Send Request" au-dessus de chaque requête
   - Les variables sont automatiquement capturées entre les requêtes
   - Très pratique pour tester le flow complet

### Option 2: Postman

1. **Importer la collection** depuis [GUIDE_TEST.md](./GUIDE_TEST.md)

2. **Tester dans l'ordre**:
   - Health Check
   - Signup → Verify → Complete
   - Login
   - MFA Setup → Enable
   - Devices Register
   - Sessions List

### Option 3: Curl (ligne de commande)

**Health Check**:
```bash
curl http://localhost:3000/api/health
```

**Pour les autres tests, utiliser Postman ou VS Code REST Client** car curl sur Windows pose des problèmes d'échappement.

## Tests de Base de Données

### Vérifier toutes les tables

```bash
docker exec molam-postgres psql -U molam -d molam -c "\dt molam_*"
```

**Résultat attendu**: 23 tables (y compris molam_rate_limits)

### Vérifier les rôles RBAC

```bash
docker exec molam-postgres psql -U molam -d molam -c "SELECT role_name, display_name FROM molam_roles;"
```

**Résultat attendu**:
- id_user
- id_moderator
- id_admin
- superadmin

### Vérifier les permissions

```bash
docker exec molam-postgres psql -U molam -d molam -c "SELECT COUNT(*) FROM molam_permissions;"
```

**Résultat attendu**: 9 permissions

### Vérifier les policies

```bash
docker exec molam-postgres psql -U molam -d molam -c "SELECT name, effect FROM molam_policies;"
```

**Résultat attendu**:
- deny_blacklisted_users (deny)
- allow_admin_all (allow)
- rate_limit_api (deny)

## Tests Fonctionnels Prioritaires

### 1. ✅ Health Check
```
GET http://localhost:3000/api/health
```
**Statut attendu**: 200 OK

### 2. Login avec utilisateur existant

Si vous avez déjà des utilisateurs en DB:
```sql
docker exec molam-postgres psql -U molam -d molam -c "SELECT email FROM molam_users LIMIT 1;"
```

Puis testez le login avec Postman/VS Code REST Client.

### 3. MFA Flow (si utilisateur authentifié)

1. Setup MFA → Obtenir QR code
2. Scanner avec Google Authenticator
3. Enable MFA avec code TOTP
4. Verify MFA

### 4. Device Registration

Après login, enregistrer un device avec ses caractéristiques.

### 5. RBAC

Attribuer un rôle admin à un utilisateur:
```sql
docker exec molam-postgres psql -U molam -d molam -c "
  INSERT INTO molam_user_roles (user_id, role_name, module, trusted_level)
  VALUES ('VOTRE_USER_ID', 'id_admin', 'id', 100)
  ON CONFLICT DO NOTHING;
"
```

## Tables Créées ✅

- [x] molam_users
- [x] molam_sessions
- [x] molam_devices (+ device_sessions, device_changes)
- [x] molam_blacklist (+ blacklist_logs, failed_login_attempts)
- [x] molam_mfa_logs
- [x] molam_password_reset_tokens
- [x] molam_password_history
- [x] molam_permissions
- [x] molam_roles
- [x] molam_role_permissions
- [x] molam_user_roles
- [x] molam_policies
- [x] molam_authz_decisions
- [x] molam_authz_cache
- [x] molam_rate_limits

**Total**: 23 tables

## Briques Opérationnelles ✅

**Sprint 1**:
- [x] Brique 10: Device Fingerprinting
- [x] Brique 11: MFA/2FA
- [x] Brique 13: Blacklist & Anti-Fraude
- [x] Brique 6: Password Reset

**Sprint 2**:
- [x] Brique 20: Permission Management
- [x] Brique 21: Role Management
- [x] Brique 22: Policy Engine
- [x] Brique 23: Audit Trail

**Pré-existant**:
- [x] Briques 1-6: Auth Core, Sessions, JWT, Onboarding, LoginV2, AuthZ

## Endpoints Disponibles

**Total**: ~35 endpoints

Voir la liste complète dans [GUIDE_TEST.md](./GUIDE_TEST.md)

## Problèmes Connus

### 1. Email Service non configuré

Les liens de reset password et les OTP sont affichés dans les **logs du serveur** au lieu d'être envoyés par email.

**Solution temporaire**: Regarder la console du serveur pour récupérer:
- Les codes OTP
- Les liens de reset password

### 2. Windows Curl Issues

Les commandes curl complexes ne fonctionnent pas bien sur Windows à cause de l'échappement.

**Solution**: Utiliser Postman ou VS Code REST Client

### 3. Premier Admin

Pour le premier utilisateur admin, l'attribuer directement en SQL:
```sql
docker exec molam-postgres psql -U molam -d molam -c "
  -- Récupérer l'ID du premier user
  SELECT id, email FROM molam_users LIMIT 1;

  -- Attribuer le rôle admin
  INSERT INTO molam_user_roles (user_id, role_name, module, trusted_level)
  VALUES ('COPIER_USER_ID_ICI', 'id_admin', 'id', 100);
"
```

## Recommandations de Test

1. **Utiliser VS Code REST Client** avec le fichier `test.http`
2. **Tester dans l'ordre** du flow utilisateur
3. **Vérifier les logs** du serveur pour les OTP et tokens
4. **Tester la DB** avec les commandes SQL ci-dessus

## Prochaines Étapes

Une fois les tests validés:
- [ ] Sprint 3: Profil & Data Management
- [ ] Sprint 4: Auth Avancé (Social Login, Biometric)
- [ ] Sprint 5: Admin & Monitoring
- [ ] Sprint 6: Audit & Compliance

---

**État actuel**: 14/36 briques = 39% ✅

**Système opérationnel** avec sécurité renforcée (MFA, Devices, Blacklist, RBAC)
