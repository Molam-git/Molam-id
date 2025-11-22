# Guide d'Administration - Molam ID

Ce guide explique comment utiliser les fonctionnalités d'administration de Molam ID, incluant la gestion des utilisateurs et des rôles.

## Table des matières

1. [Création du Super Admin](#création-du-super-admin)
2. [Authentification Admin](#authentification-admin)
3. [Gestion des Utilisateurs](#gestion-des-utilisateurs)
4. [Gestion des Rôles](#gestion-des-rôles)
5. [Exemples d'utilisation](#exemples-dutilisation)

---

## Création du Super Admin

### Première étape : Initialiser le premier Super Admin

Avant de pouvoir utiliser les fonctionnalités d'administration, vous devez créer le premier utilisateur super admin :

```bash
node scripts/create-super-admin.js
```

Le script vous demandera :
- Email du super admin
- Mot de passe (minimum 8 caractères)
- Numéro de téléphone (format E.164, ex: +221771234567)

**Exemple :**
```
📧 Email du super admin: admin@molam.sn
🔑 Mot de passe (min 8 caractères): SuperSecure123!
📱 Téléphone (format E.164, ex: +221771234567): +221771234567
```

Le script créera :
- Un utilisateur avec le statut `active`
- Le rôle `super_admin` dans le `role_profile`
- Une entrée dans `molam_user_roles` avec `trusted_level = 100`
- Un log d'audit de la création

---

## Authentification Admin

### Se connecter en tant que Super Admin

```bash
POST /api/id/login
Content-Type: application/json

{
  "email": "admin@molam.sn",
  "password": "SuperSecure123!"
}
```

**Réponse :**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "user_id": "uuid-here",
    "molam_id": "MID-XXXXXXXXXXXX",
    "email": "admin@molam.sn",
    "roles": ["super_admin"]
  }
}
```

Utilisez le `access_token` dans le header `Authorization` pour toutes les requêtes admin :
```
Authorization: Bearer <access_token>
```

---

## Gestion des Utilisateurs

Toutes ces routes nécessitent le rôle `super_admin`.

### 1. Lister tous les utilisateurs

```bash
GET /api/admin/users?page=1&limit=20&status=active&search=john
Authorization: Bearer <token>
```

**Paramètres de requête :**
- `page` (optional) : Numéro de page (défaut: 1)
- `limit` (optional) : Nombre d'éléments par page (défaut: 20)
- `status` (optional) : Filtrer par statut (`active`, `pending`, `suspended`, `closed`)
- `role` (optional) : Filtrer par rôle (`client`, `agent`, `merchant`, `super_admin`, etc.)
- `search` (optional) : Rechercher par email, téléphone ou molam_id

**Réponse :**
```json
{
  "users": [
    {
      "id": "uuid",
      "molam_id": "MID-XXXXXXXXXXXX",
      "email": "user@example.com",
      "phone_e164": "+221771234567",
      "role_profile": ["client"],
      "status": "active",
      "kyc_status": "verified",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 2. Obtenir les statistiques des utilisateurs

```bash
GET /api/admin/users/stats
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "active_users": "1250",
  "pending_users": "45",
  "suspended_users": "12",
  "deleted_users": "8",
  "total_users": "1315",
  "verified_kyc": "980",
  "new_today": "23",
  "new_this_week": "156"
}
```

### 3. Obtenir les détails d'un utilisateur

```bash
GET /api/admin/users/:userId
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "id": "uuid",
  "molam_id": "MID-XXXXXXXXXXXX",
  "email": "user@example.com",
  "phone_e164": "+221771234567",
  "role_profile": ["client", "merchant"],
  "status": "active",
  "kyc_status": "verified",
  "kyc_reference": "KYC-REF-123",
  "lang_pref": "fr",
  "currency_pref": "XOF",
  "metadata": {},
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z",
  "roles_detailed": [
    {
      "role_name": "client",
      "module": "*",
      "trusted_level": 10,
      "granted_at": "2025-01-15T10:00:00Z",
      "expires_at": null
    }
  ]
}
```

### 4. Créer un nouvel utilisateur

```bash
POST /api/admin/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "phone": "+221771234568",
  "password": "SecurePass123!",
  "roles": ["client"],
  "status": "active",
  "kycStatus": "none"
}
```

**Réponse :**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "new-uuid",
    "molam_id": "MID-YYYYYYYYYYYY",
    "email": "newuser@example.com",
    "phone_e164": "+221771234568",
    "role_profile": ["client"],
    "status": "active",
    "kyc_status": "none",
    "created_at": "2025-01-20T14:30:00Z"
  }
}
```

### 5. Mettre à jour un utilisateur

```bash
PATCH /api/admin/users/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "updated@example.com",
  "status": "active",
  "kycStatus": "verified",
  "roles": ["client", "merchant"]
}
```

**Réponse :**
```json
{
  "message": "User updated successfully",
  "user": {
    "id": "uuid",
    "molam_id": "MID-XXXXXXXXXXXX",
    "email": "updated@example.com",
    "phone_e164": "+221771234567",
    "role_profile": ["client", "merchant"],
    "status": "active",
    "kyc_status": "verified",
    "updated_at": "2025-01-20T14:35:00Z"
  }
}
```

### 6. Suspendre un utilisateur

```bash
POST /api/admin/users/:userId/suspend
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Activité suspecte détectée"
}
```

**Réponse :**
```json
{
  "message": "User suspended successfully",
  "user": {
    "id": "uuid",
    "molam_id": "MID-XXXXXXXXXXXX",
    "email": "user@example.com",
    "status": "suspended"
  }
}
```

### 7. Activer un utilisateur

```bash
POST /api/admin/users/:userId/activate
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "message": "User activated successfully",
  "user": {
    "id": "uuid",
    "molam_id": "MID-XXXXXXXXXXXX",
    "email": "user@example.com",
    "status": "active"
  }
}
```

### 8. Supprimer un utilisateur (soft delete)

```bash
DELETE /api/admin/users/:userId
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "message": "User deleted successfully",
  "user": {
    "id": "uuid",
    "molam_id": "MID-XXXXXXXXXXXX",
    "email": "user@example.com"
  }
}
```

**Note :** Vous ne pouvez pas supprimer votre propre compte.

### 9. Obtenir les logs d'audit d'un utilisateur

```bash
GET /api/admin/users/:userId/audit?page=1&limit=50
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "logs": [
    {
      "id": "uuid",
      "actor_id": "admin-uuid",
      "action": "user_updated",
      "metadata": {
        "email": "updated@example.com",
        "status": "active"
      },
      "created_at": "2025-01-20T14:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15
  }
}
```

---

## Gestion des Rôles

### 1. Lister tous les rôles disponibles

```bash
GET /api/admin/roles
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "roles": [
    {
      "role_name": "client",
      "module": "*",
      "display_name": "Client",
      "description": "Utilisateur standard",
      "is_system_role": true
    },
    {
      "role_name": "super_admin",
      "module": "*",
      "display_name": "Super Administrateur",
      "description": "Administrateur global",
      "is_system_role": true
    }
  ],
  "count": 2
}
```

### 2. Créer un nouveau rôle

```bash
POST /api/admin/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "role_name": "pay_manager",
  "module": "pay",
  "display_name": "Gestionnaire Pay",
  "description": "Gestionnaire du module Pay",
  "inherits_from": null
}
```

**Réponse :**
```json
{
  "message": "Role created successfully",
  "role": {
    "id": "uuid",
    "role_name": "pay_manager",
    "module": "pay",
    "display_name": "Gestionnaire Pay",
    "description": "Gestionnaire du module Pay",
    "inherits_from": null,
    "is_system_role": false,
    "created_at": "2025-01-20T15:00:00Z"
  }
}
```

### 3. Supprimer un rôle

```bash
DELETE /api/admin/roles/:roleName
Authorization: Bearer <token>
```

**Note :** Les rôles système (is_system_role = true) ne peuvent pas être supprimés.

### 4. Obtenir les rôles d'un utilisateur

```bash
GET /api/admin/users/:userId/roles
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "user_id": "uuid",
  "role_profile": ["client", "merchant"],
  "roles": [
    {
      "id": "uuid",
      "role_name": "client",
      "module": "*",
      "trusted_level": 10,
      "granted_at": "2025-01-15T10:00:00Z",
      "expires_at": null,
      "display_name": "Client",
      "description": "Utilisateur standard"
    }
  ],
  "count": 1
}
```

### 5. Assigner un rôle à un utilisateur

```bash
POST /api/admin/users/:userId/assign-role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role_name": "merchant",
  "module": "pay",
  "trusted_level": 20,
  "expires_at": null
}
```

**Réponse :**
```json
{
  "message": "Role assigned successfully",
  "role": {
    "id": "uuid",
    "user_id": "user-uuid",
    "role_name": "merchant",
    "module": "pay",
    "trusted_level": 20,
    "granted_at": "2025-01-20T15:10:00Z",
    "expires_at": null
  }
}
```

### 6. Révoquer un rôle d'un utilisateur

```bash
DELETE /api/admin/users/:userId/revoke-role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role_name": "merchant",
  "module": "pay"
}
```

**Réponse :**
```json
{
  "message": "Role revoked successfully"
}
```

**Note :** Vous ne pouvez pas révoquer votre propre rôle `super_admin`.

---

## Exemples d'utilisation

### Exemple complet : Créer un nouveau merchant

```bash
# 1. Créer l'utilisateur
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@restaurant.sn",
    "phone": "+221771234569",
    "password": "MerchantPass123!",
    "roles": ["client"],
    "status": "active"
  }'

# 2. Assigner le rôle merchant (en utilisant l'userId obtenu)
curl -X POST http://localhost:3001/api/admin/users/{userId}/assign-role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role_name": "merchant",
    "module": "pay",
    "trusted_level": 20
  }'

# 3. Vérifier les rôles
curl -X GET http://localhost:3001/api/admin/users/{userId}/roles \
  -H "Authorization: Bearer <token>"
```

### Exemple : Gérer un utilisateur problématique

```bash
# 1. Suspendre l'utilisateur
curl -X POST http://localhost:3001/api/admin/users/{userId}/suspend \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Comportement frauduleux détecté"
  }'

# 2. Consulter l'historique d'audit
curl -X GET http://localhost:3001/api/admin/users/{userId}/audit \
  -H "Authorization: Bearer <token>"

# 3. Si nécessaire, supprimer l'utilisateur
curl -X DELETE http://localhost:3001/api/admin/users/{userId} \
  -H "Authorization: Bearer <token>"
```

---

## Sécurité

### Bonnes pratiques

1. **Protection du compte super_admin**
   - Utilisez un mot de passe fort (16+ caractères)
   - Activez MFA pour le compte super_admin
   - Ne partagez jamais les identifiants

2. **Gestion des tokens**
   - Les access tokens expirent après 15 minutes
   - Utilisez le refresh token pour renouveler
   - Révoquezles sessions inactives régulièrement

3. **Audit**
   - Tous les actions admin sont loggées dans `molam_audit_logs`
   - Consultez régulièrement les logs d'audit
   - Surveillez les actions inhabituelles

4. **Principe du moindre privilège**
   - N'accordez le rôle `super_admin` qu'aux personnes de confiance
   - Utilisez des rôles spécifiques par module (`pay_admin`, `eats_admin`) quand possible
   - Définissez des `expires_at` pour les rôles temporaires

---

## Dépannage

### Erreur : "Cannot delete your own account"
Vous essayez de supprimer ou suspendre votre propre compte. Utilisez un autre compte super_admin pour cette opération.

### Erreur : "Cannot revoke your own super_admin role"
Vous ne pouvez pas révoquer votre propre rôle super_admin pour des raisons de sécurité.

### Erreur : "Cannot delete system role"
Les rôles système ne peuvent pas être supprimés. Ce sont des rôles essentiels au fonctionnement de la plateforme.

### Erreur : "Role not found"
Le rôle que vous essayez d'assigner n'existe pas. Consultez la liste des rôles disponibles avec `GET /api/admin/roles`.

---

## Support

Pour toute question ou problème :
- Documentation technique : `/docs`
- Équipe technique : tech@molam.sn
