# 🚀 Guide de Démarrage Rapide - Molam-ID

## Problème Actuel
Plusieurs processus Node.js sont en cours d'exécution et bloquent les ports 3000 et 3003.

## ✅ Solution Simple (3 Étapes)

### Étape 1: Arrêter Tous les Processus Node

**Option A - Via Gestionnaire des Tâches (RECOMMANDÉ)**
1. Appuyez sur `Ctrl + Shift + Esc` pour ouvrir le Gestionnaire des tâches
2. Cliquez sur l'onglet "Détails"
3. Cherchez tous les processus nommés `node.exe`
4. Clic droit sur chaque `node.exe` → "Fin de tâche"
5. Répétez jusqu'à ce qu'il n'y ait plus de `node.exe`

**Option B - Via PowerShell (Plus Rapide)**
1. Ouvrez PowerShell en tant qu'Administrateur
2. Exécutez cette commande:
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Option C - Redémarrer Windows (Le Plus Simple)**
1. Redémarrez simplement votre ordinateur
2. Tous les processus Node seront automatiquement arrêtés

---

### Étape 2: Modifier le Port à 3000

**Fichier à modifier**: `c:\Users\lomao\Desktop\Molam\Molam-id\.env`

Ouvrez le fichier `.env` et changez la ligne:
```bash
PORT=3003
```

En:
```bash
PORT=3000
```

Sauvegardez le fichier.

---

### Étape 3: Démarrer les Services

#### A) Démarrer le Backend (Terminal 1)

Ouvrez un **nouveau terminal PowerShell** et exécutez:

```powershell
cd C:\Users\lomao\Desktop\Molam\Molam-id
npm start
```

**Attendez de voir ce message**:
```
📡 Server listening on port 3000
✅ Test de connexion réussi
```

#### B) Démarrer le Web UI (Terminal 2)

Ouvrez un **DEUXIÈME terminal PowerShell** (gardez le premier ouvert!) et exécutez:

```powershell
cd C:\Users\lomao\Desktop\Molam\Molam-id\brique-36-ui-id\web
npm run dev
```

**Attendez de voir ce message**:
```
VITE v5.4.21  ready in XXX ms
➜  Local:   http://localhost:5173/
```

---

## ✅ Vérification que Tout Fonctionne

### Test 1: Backend est UP
Ouvrez un navigateur et allez à:
```
http://localhost:3000/healthz
```

Vous devriez voir:
```json
{"status":"healthy","timestamp":"..."}
```

### Test 2: Web UI est UP
Ouvrez un navigateur et allez à:
```
http://localhost:5173
```

Vous devriez voir l'interface Molam-ID avec les boutons "Connexion" et "Créer un compte".

---

## 🧪 Test Complet du Système

### Test Signup via API

Ouvrez un **troisième terminal** et exécutez:

```powershell
curl -X POST http://localhost:3000/api/id/auth/signup -H "Content-Type: application/json" -d '{\"phone\":\"+221707654321\",\"password\":\"TestPass123!\",\"firstName\":\"Test\",\"lastName\":\"User\"}'
```

**Résultat attendu**: Un JSON avec `"message":"Account created successfully"` et des tokens.

### Test Login via API

Avec le même terminal:

```powershell
curl -X POST http://localhost:3000/api/id/auth/login -H "Content-Type: application/json" -d '{\"phone\":\"+221707654321\",\"password\":\"TestPass123!\"}'
```

**Résultat attendu**: Un JSON avec les tokens d'accès.

### Test via Web UI

1. Ouvrez http://localhost:5173
2. Cliquez sur "Créer un compte"
3. Remplissez:
   - Téléphone: `+221708765432`
   - Mot de passe: `MyPassword123!`
   - Prénom: `Alice`
   - Nom: `Dupont`
4. Cliquez sur "S'inscrire"
5. Vous devriez être redirigé vers la page de profil

Ensuite, testez la connexion:
1. Déconnectez-vous
2. Cliquez sur "Connexion"
3. Entrez le même téléphone et mot de passe
4. Vous devriez être reconnecté

---

## 📊 Architecture en Cours d'Exécution

```
┌─────────────────────────────────────┐
│  Navigateur Web                     │
│  http://localhost:5173              │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Web UI (Terminal 2)                │
│  Vite Dev Server - Port 5173        │
│  React + TypeScript                 │
└─────────────┬───────────────────────┘
              │
              │ API Requests
              ▼
┌─────────────────────────────────────┐
│  Backend API (Terminal 1)           │
│  Express Server - Port 3000         │
│  Briques 1-6 (Auth, Sessions, JWT)  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  PostgreSQL (Docker)                │
│  Port 5432                          │
│  Database: molam                    │
└─────────────────────────────────────┘
```

---

## 🔧 Dépannage

### Problème: Port 3000 déjà utilisé

**Solution**: Vérifiez qu'aucun autre processus n'utilise le port 3000:
```powershell
netstat -ano | findstr :3000
```

Si un processus est trouvé, notez le PID (dernière colonne) et tuez-le:
```powershell
# Remplacez XXXX par le PID trouvé
Stop-Process -Id XXXX -Force
```

### Problème: Port 5173 déjà utilisé

**Solution**: Arrêtez tous les processus Vite:
```powershell
Get-Process | Where-Object {$_.Path -like "*vite*"} | Stop-Process -Force
```

### Problème: "Cannot find module"

**Solution**: Réinstallez les dépendances:

Pour le backend:
```powershell
cd C:\Users\lomao\Desktop\Molam\Molam-id
npm install
```

Pour le Web UI:
```powershell
cd C:\Users\lomao\Desktop\Molam\Molam-id\brique-36-ui-id\web
npm install
```

### Problème: PostgreSQL non démarré

**Solution**: Vérifiez que Docker est lancé et que le container PostgreSQL tourne:
```powershell
docker ps | findstr postgres
```

Si le container n'est pas là:
```powershell
docker start molam-postgres
```

Si le container n'existe pas:
```powershell
docker run -d --name molam-postgres -e POSTGRES_USER=molam -e POSTGRES_PASSWORD=molam_pass -e POSTGRES_DB=molam -p 5432:5432 postgres:16
```

### Problème: Erreur de connexion à la base de données

**Solution**: Vérifiez que le fichier `.env` contient les bonnes informations:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=molam
DB_PASSWORD=molam_pass
DB_NAME=molam
```

---

## 📝 Commandes Utiles

### Vérifier l'état de PostgreSQL
```powershell
docker exec molam-postgres psql -U molam -d molam -c "SELECT version();"
```

### Voir les logs du backend en temps réel
Les logs s'affichent directement dans le terminal où vous avez lancé `npm start`.

### Arrêter proprement les services

**Backend**: Dans le terminal 1, appuyez sur `Ctrl + C`

**Web UI**: Dans le terminal 2, appuyez sur `Ctrl + C`

**PostgreSQL** (si besoin):
```powershell
docker stop molam-postgres
```

---

## 🎯 Checklist de Démarrage

- [ ] Tous les processus Node arrêtés
- [ ] Fichier `.env` configuré avec `PORT=3000`
- [ ] PostgreSQL Docker container en cours d'exécution
- [ ] Terminal 1: Backend démarré sur port 3000
- [ ] Terminal 2: Web UI démarré sur port 5173
- [ ] Test: http://localhost:3000/healthz retourne `{"status":"healthy"}`
- [ ] Test: http://localhost:5173 affiche l'interface Web
- [ ] Test: Signup fonctionne (via curl ou Web UI)
- [ ] Test: Login fonctionne (via curl ou Web UI)

---

## 🌟 Une Fois Que Tout Fonctionne

Vous aurez accès à:

1. **Backend API** - http://localhost:3000
   - 26 endpoints d'authentification et d'autorisation
   - Documentation: http://localhost:3000/ (page d'accueil)

2. **Web UI** - http://localhost:5173
   - Création de compte
   - Connexion
   - Gestion du profil
   - Visualisation des sessions actives
   - Mode sombre/clair
   - Fonctionnalités d'accessibilité

3. **Base de données** - localhost:5432
   - Toutes les données utilisateurs
   - Sessions
   - Logs d'audit

---

## 📞 Support

Si vous rencontrez des problèmes:

1. Consultez le fichier [BRIQUES_VERIFICATION.md](BRIQUES_VERIFICATION.md) pour les détails techniques
2. Vérifiez le fichier [SYSTEM_OPERATIONAL.md](SYSTEM_OPERATIONAL.md) pour plus d'informations
3. Consultez les logs dans les terminaux pour voir les erreurs exactes

---

**Dernière mise à jour**: 2025-10-31
**Version**: 1.0.0
**Status**: ✅ Prêt pour démarrage
