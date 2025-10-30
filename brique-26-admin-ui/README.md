# Brique 26 - UI de gestion ID (Admin Interne par Filiale)

## Vue d'ensemble

Brique 26 fournit une console d'administration interne pour gérer les employés Molam avec une séparation stricte par filiale (subsidiary). Cette brique permet aux administrateurs de gérer les employés, rôles, sessions, et d'auditer les actions dans leur département uniquement.

## Objectif fonctionnel

Console d'administration interne réservée aux employés Molam (Super Admin, Admin, Auditor, Marketer, Sales, etc.) avec séparation stricte par filiale :

### Fonctionnalités principales

1. **Gestion des employés**
   - Création de comptes employés avec rattachement à une filiale
   - Activation/désactivation de comptes
   - Attribution de rôles spécifiques à la filiale

2. **Séparation par filiale (Subsidiary Separation)**
   - Départements : `pay`, `eats`, `talk`, `ads`, `shop`, `free`, `id`, `global`
   - Un admin Molam Pay ne peut pas voir les rôles Molam Eats
   - Un auditeur Shop ne voit que les logs Shop
   - Isolation complète au niveau base de données via RLS (Row-Level Security)

3. **Vues d'accès hiérarchiques**
   - Filtrage par rôle, module, utilisateur
   - Statistiques par département
   - Vue employés avec leurs rôles assignés

4. **Surveillance des sessions**
   - Visualisation des connexions actives
   - Révocation de session en cas de fraude
   - Historique des sessions par employé

5. **Audit en temps réel**
   - Actions horodatées et traçables
   - Logs immuables dans `molam_audit_logs` et `molam_admin_actions`
   - Filtrage par département et période

6. **Interopérabilité SIRA**
   - Alertes sur anomalies (ex: employé accédant module non autorisé)
   - Intégration avec système de détection d'anomalies

## Architecture

### Stack technique

- **Backend**: TypeScript 5.3.3, Node.js 18+, Express.js 4.18.2
- **Database**: PostgreSQL 14+ avec RLS, fonctions SQL, vues
- **Web UI**: React 18.2, TypeScript, Tailwind CSS 3.4, Vite 5.0
- **Mobile**: React Native 0.73
- **Desktop**: Electron 28.1
- **HarmonyOS**: ArkTS (native)
- **Auth**: JWT RS256 + mTLS (pour APIs internes)

### Structure du projet

```
brique-26-admin-ui/
├── sql/
│   └── 026_admin_ui.sql          # Schéma DB avec RLS et fonctions
├── api/
│   ├── src/
│   │   ├── types/index.ts        # Types TypeScript (Department, Employee, etc.)
│   │   ├── services/
│   │   │   └── admin.service.ts  # Logique métier avec vérification permissions
│   │   ├── controllers/
│   │   │   └── admin.controller.ts
│   │   ├── routes/
│   │   │   └── admin.routes.ts   # 12 endpoints API
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── authz.ts
│   │   ├── config/
│   │   │   └── database.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── pages/
│   │   │   └── AdminDashboard.tsx  # Interface admin principale
│   │   └── lib/
│   │       └── api.ts
│   ├── package.json
│   └── vite.config.ts
├── mobile/
│   └── src/
│       └── screens/
│           └── AdminConsoleScreen.tsx  # React Native
├── harmony/
│   └── feature/
│       └── admin/
│           └── AdminConsolePage.ets    # HarmonyOS ArkTS
├── test_structure.cjs            # Tests de structure (12 tests)
└── README.md
```

## Base de données

### Tables principales

#### molam_employees

Répertoire des employés avec rattachement département :

```sql
CREATE TABLE molam_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id),
  employee_id TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL CHECK (department IN ('pay','eats','talk','ads','shop','free','id','global')),
  position TEXT NOT NULL,
  manager_id UUID REFERENCES molam_employees(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### molam_admin_actions

Journal spécifique aux actions administratives :

```sql
CREATE TABLE molam_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES molam_users(id),
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES molam_users(id),
  target_employee_id TEXT,
  target_department TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Fonctions SQL critiques

#### can_admin_manage_department

Vérifie si un admin peut gérer un département spécifique :

```sql
CREATE OR REPLACE FUNCTION can_admin_manage_department(
  p_admin_user_id UUID,
  p_target_department TEXT
) RETURNS BOOLEAN
```

- Super admin : peut gérer tous les départements
- Admin régulier : peut gérer uniquement son département
- Retourne `true` si autorisé, `false` sinon

#### get_admin_accessible_departments

Retourne la liste des départements accessibles à un admin :

```sql
CREATE OR REPLACE FUNCTION get_admin_accessible_departments(
  p_admin_user_id UUID
) RETURNS TEXT[]
```

- Super admin : `ARRAY['pay','eats','talk','ads','shop','free','id','global']`
- Admin régulier : `ARRAY['<son_département>']`

#### create_employee

Crée un employé avec vérification de permissions et journalisation :

```sql
CREATE OR REPLACE FUNCTION create_employee(
  p_admin_id UUID,
  p_user_id UUID,
  p_employee_id TEXT,
  p_department TEXT,
  p_position TEXT,
  p_start_date DATE,
  p_manager_id UUID DEFAULT NULL
) RETURNS UUID
```

### Row-Level Security (RLS)

Politiques RLS pour isolation par département :

```sql
-- Lecture : admin voit uniquement les employés de ses départements accessibles
CREATE POLICY admin_view_employees ON molam_employees
  FOR SELECT
  USING (department = ANY(get_admin_accessible_departments(auth.uid())));

-- Écriture : admin peut modifier uniquement si can_admin_manage_department = true
CREATE POLICY admin_manage_employees ON molam_employees
  FOR UPDATE
  USING (can_admin_manage_department(auth.uid(), department));
```

## API Backend

### Endpoints (12 au total)

#### Employés

- `GET /api/id/admin/employees?department=<dept>&includeInactive=<bool>`
  - Liste les employés avec filtrage par département
  - Retourne uniquement les employés des départements accessibles à l'admin

- `GET /api/id/admin/employees/:id`
  - Détails d'un employé spécifique
  - Vérifie que l'admin a accès au département de l'employé

- `POST /api/id/admin/employees`
  - Crée un nouvel employé
  - Body : `{ user_id, employee_id, department, position, start_date, manager_id? }`
  - Vérifie permissions avant création

- `PATCH /api/id/admin/employees/:id`
  - Met à jour un employé
  - Body : `{ position?, manager_id?, department? }`
  - Si changement de département → vérifie permissions sur ancien ET nouveau département

- `POST /api/id/admin/employees/:id/deactivate`
  - Désactive un employé (soft delete)
  - Révoque automatiquement tous les rôles actifs

#### Rôles

- `GET /api/id/admin/roles?department=<dept>`
  - Liste des rôles disponibles par département

- `POST /api/id/admin/roles/assign`
  - Attribue un rôle à un employé
  - Body : `{ user_id, role_name, justification }`

- `POST /api/id/admin/roles/revoke`
  - Révoque un rôle
  - Body : `{ grant_id, reason }`

#### Sessions

- `GET /api/id/admin/sessions?department=<dept>&userId=<uuid>`
  - Sessions actives avec filtrage par département

- `POST /api/id/admin/sessions/:sessionId/revoke`
  - Révoque une session utilisateur

#### Audit & Stats

- `GET /api/id/admin/audit?department=<dept>&limit=<n>&offset=<n>`
  - Logs d'audit filtrés par département

- `GET /api/id/admin/stats`
  - Statistiques par département (nombre d'employés actifs, rôles, etc.)

### Service Layer

Le fichier `admin.service.ts` contient la logique métier avec vérification systématique des permissions :

```typescript
export async function getAdminPermissions(adminUserId: string): Promise<AdminPermissions> {
  // Détermine si super_admin et liste des départements accessibles
}

export async function listEmployees(
  adminUserId: string,
  department?: Department,
  includeInactive = false
): Promise<EmployeeWithUser[]> {
  // Appelle get_employees_by_department() qui filtre automatiquement
}

export async function createEmployee(
  adminUserId: string,
  dto: CreateEmployeeDTO
): Promise<string> {
  // Appelle create_employee() SQL qui vérifie permissions
}
```

## Interface Web

### AdminDashboard.tsx

Interface principale avec :

1. **Filtrage par département**
   - Dropdown pour sélectionner un département
   - Affichage "All Departments" si super admin

2. **Statistiques par département**
   - Cartes colorées avec badges de département
   - Nombre d'employés actifs par département

3. **Tableau des employés**
   - Nom, email, ID employé, département, position, statut
   - Badges colorés par département (vert=pay, orange=eats, bleu=talk, etc.)
   - Badge actif/inactif

4. **Logs d'audit en temps réel**
   - Liste des 30 dernières actions
   - Horodatage, action, employé concerné, département
   - Détails JSON cliquables

### Design Apple-like

- Cartes arrondies avec ombres subtiles
- Palette de couleurs par département
- Typographie SF Pro-inspired
- Animations fluides (hover, transitions)
- Responsive (mobile, tablet, desktop)

## Mobile & HarmonyOS

### AdminConsoleScreen.tsx (React Native)

- ScrollView avec RefreshControl
- FlatList pour employés et audit logs
- TouchableOpacity pour filtres département
- Couleurs département harmonisées avec Web
- AsyncStorage pour tokens JWT

### AdminConsolePage.ets (HarmonyOS)

- Native ArkTS implementation
- `@ohos.net.http` pour requêtes API
- `@ohos.data.preferences` pour stockage secure
- Grid layout pour statistiques
- Scroll vertical pour employés et logs

## Sécurité

### Authentication & Authorization

1. **JWT RS256**
   - Token signé avec clé privée RSA
   - Validation avec clé publique
   - Claims : `sub` (user_id), `roles`, `department`

2. **mTLS (mutual TLS)**
   - Certificats client pour APIs internes
   - Validation côté serveur
   - Révocation via CRL/OCSP

3. **RBAC strict**
   - Vérification de `can_admin_manage_department()` avant toute action
   - Auditor : lecture seule
   - Admin : gestion de son département uniquement
   - Super admin : gestion globale

### Audit & Compliance

1. **Traçabilité**
   - Toutes les actions → `molam_admin_actions`
   - Champs : admin_user_id, action_type, target, ip_address, user_agent, timestamp

2. **Immuabilité**
   - Logs en append-only (pas de UPDATE/DELETE)
   - Archivage après N jours (configurable)

3. **GDPR**
   - Pas de fuite de données cross-département
   - Export des données admin possible (sur demande justifiée)
   - Anonymisation des logs après départ employé (optionnel)

## Tests

### Structure Tests (test_structure.cjs)

12 tests couvrant :

1. **SQL Migration (4 tests)**
   - Fichier présent
   - Table `molam_employees` définie
   - Table `molam_admin_actions` définie
   - Fonctions SQL (`can_admin_manage_department`, `get_admin_accessible_departments`, etc.)

2. **Backend API (7 tests)**
   - Types définis (`Department`, `Employee`, etc.)
   - Service layer présent
   - Controllers définis
   - Routes configurées
   - Middleware auth/authz
   - Server et config

3. **Web UI (2 tests)**
   - AdminDashboard component présent
   - Config Vite

**Résultat** : 12/12 tests réussis (100%)

```bash
cd brique-26-admin-ui
node test_structure.cjs
```

## Déploiement

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- Redis (pour caching sessions)
- Certificats TLS (mTLS)

### Installation

1. **Base de données**
   ```bash
   psql -U postgres -d molam_db -f sql/026_admin_ui.sql
   ```

2. **Backend API**
   ```bash
   cd api
   npm install
   cp .env.example .env
   # Configurer DATABASE_URL, JWT_PUBLIC_KEY, REDIS_URL
   npm run build
   npm start
   ```

3. **Web UI**
   ```bash
   cd web
   npm install
   cp .env.example .env
   # Configurer VITE_API_BASE_URL
   npm run build
   npm run preview  # ou déployer dist/ sur CDN
   ```

4. **Mobile**
   ```bash
   cd mobile
   npm install
   # iOS
   cd ios && pod install && cd ..
   npx react-native run-ios
   # Android
   npx react-native run-android
   ```

5. **HarmonyOS**
   ```bash
   # Ouvrir dans DevEco Studio
   # Build & Run sur émulateur ou device
   ```

### Variables d'environnement

**Backend (api/.env)**
```env
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/molam_db
REDIS_URL=redis://localhost:6379
JWT_PUBLIC_KEY_PATH=/path/to/public.pem
CORS_ORIGIN=http://localhost:5174
MTLS_CA_CERT=/path/to/ca.pem
MTLS_CLIENT_CERT=/path/to/client.pem
MTLS_CLIENT_KEY=/path/to/client-key.pem
```

**Web (web/.env)**
```env
VITE_API_BASE_URL=http://localhost:3001
```

## Utilisation

### Scénario : Admin Molam Pay crée un employé

1. **Connexion**
   - Admin se connecte avec JWT (rôle `pay_admin`)
   - Récupère accessible_departments → `['pay']`

2. **Création employé**
   ```bash
   POST /api/id/admin/employees
   {
     "user_id": "uuid-existing-user",
     "employee_id": "EMP-PAY-001",
     "department": "pay",
     "position": "Backend Developer",
     "start_date": "2025-01-15"
   }
   ```
   - SQL vérifie `can_admin_manage_department(admin_id, 'pay')` → `true`
   - Employé créé
   - Log dans `molam_admin_actions` : `employee.create`

3. **Tentative de voir employés Eats**
   ```bash
   GET /api/id/admin/employees?department=eats
   ```
   - Retour : `[]` (RLS filtre automatiquement)
   - Admin Pay ne voit pas les employés Eats

### Scénario : Super Admin gère tous départements

1. **Connexion**
   - Super admin se connecte
   - `is_super_admin: true`
   - `accessible_departments: ['pay','eats','talk','ads','shop','free','id','global']`

2. **Vue globale**
   ```bash
   GET /api/id/admin/employees
   ```
   - Retourne TOUS les employés de TOUS les départements

3. **Création employé dans n'importe quel département**
   ```bash
   POST /api/id/admin/employees
   { "department": "eats", ... }  # Succès
   ```

## Intégration SIRA

### Détection d'anomalies

SIRA (Système d'Intelligence et Réponse aux Anomalies) analyse les logs d'audit en temps réel :

1. **Alertes**
   - Employé accédant module non autorisé
   - Tentatives répétées de modification cross-département
   - Révocations massives de sessions (possible compromission)

2. **Actions automatiques**
   - Suspension temporaire du compte admin
   - Notification au super admin
   - Log dans `molam_audit_logs` avec niveau `critical`

3. **API SIRA**
   ```bash
   POST /api/sira/anomaly-detected
   {
     "anomaly_type": "unauthorized_department_access",
     "user_id": "uuid",
     "context": {
       "attempted_department": "eats",
       "user_department": "pay"
     }
   }
   ```

## Roadmap

### Phase 1 (Actuelle) ✅
- SQL schema avec RLS
- Backend API complet
- Web UI avec filtrage département
- Mobile & HarmonyOS screens
- Tests de structure

### Phase 2 (À venir)
- Interface de création/modification employé (formulaires)
- Gestion des rôles par drag-and-drop
- Graphiques de statistiques (Charts.js ou Recharts)
- Export CSV/Excel des employés et audit logs
- Notifications push sur actions critiques

### Phase 3 (Futur)
- Workflow d'approbation pour rôles sensibles
- Intégration SIRA avancée (ML pour détection anomalies)
- Dashboard temps réel avec WebSocket
- Historique des changements avec diff (avant/après)
- API GraphQL pour queries complexes

## Support & Documentation

- **Architecture globale** : Voir `/docs/architecture.md`
- **Guide d'intégration** : Voir `/docs/integration.md`
- **API Reference** : Swagger disponible à `/api/docs` (après démarrage backend)
- **Contact** : admins@molam.sn

## Licence

Propriétaire - Molam SN © 2025
