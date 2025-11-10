# 🚀 Guide de Déploiement Backend sur Render.com

## Étape 1 : Créer un compte Render

1. Allez sur [https://render.com](https://render.com)
2. Cliquez sur **"Get Started"**
3. Inscrivez-vous avec GitHub (recommandé)

## Étape 2 : Connecter votre repository GitHub

1. Assurez-vous que votre code est sur GitHub
2. Si ce n'est pas déjà fait :
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push
   ```

## Étape 3 : Créer une base de données PostgreSQL

1. Sur le dashboard Render, cliquez **"New +"** → **"PostgreSQL"**
2. Configurez :
   - **Name** : `molam-id-db`
   - **Database** : `molam`
   - **User** : (auto-généré)
   - **Region** : Frankfurt (ou le plus proche de vous)
   - **PostgreSQL Version** : 15
   - **Plan** : **Free**

3. Cliquez **"Create Database"**

4. **Attendez 2-3 minutes** que la database soit créée

5. Une fois créée, notez les informations de connexion :
   - **Internal Database URL** (utilisé par le backend)
   - **External Database URL** (pour initialiser les tables)

## Étape 4 : Initialiser les tables de la base de données

Depuis votre machine locale :

```bash
# Copier l'External Database URL depuis Render
# Format: postgresql://user:password@host:port/database

# Option 1: Avec psql
psql "postgresql://user:password@host:port/molam" < sql/000_unified_schema.sql
psql "postgresql://user:password@host:port/molam" < sql/010_device_fingerprinting.sql
psql "postgresql://user:password@host:port/molam" < sql/011_mfa.sql
psql "postgresql://user:password@host:port/molam" < sql/013_blacklist.sql

# Option 2: Avec le script init-database.js (modifié temporairement)
# Éditez init-database.js et remplacez les credentials par ceux de Render
node init-database.js
```

## Étape 5 : Créer le Web Service (Backend)

1. Sur le dashboard Render, cliquez **"New +"** → **"Web Service"**
2. Sélectionnez votre repository GitHub `Molam-id`
3. Configurez :

   **Général :**
   - **Name** : `molam-id-api`
   - **Region** : Frankfurt (même que la database)
   - **Branch** : `main`
   - **Root Directory** : `.` (laisser vide)
   - **Runtime** : Node

   **Build & Deploy :**
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`

   **Plan :**
   - **Instance Type** : Free

4. **Variables d'environnement** (cliquez "Advanced" → "Add Environment Variable") :

   ```
   NODE_ENV=production
   PORT=10000

   # Database (copiez depuis votre PostgreSQL database Render)
   DB_HOST=<internal-host-from-render>
   DB_PORT=5432
   DB_USER=<user-from-render>
   DB_PASSWORD=<password-from-render>
   DB_NAME=molam

   # Secrets (générez des valeurs aléatoires sécurisées)
   JWT_SECRET=<générez-une-valeur-aléatoire-longue>
   JWT_REFRESH_SECRET=<générez-une-autre-valeur-aléatoire>
   PASSWORD_PEPPER=<encore-une-valeur-aléatoire>

   # CORS
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://molam-id-sbr1.vercel.app
   ```

   **Pour générer des secrets sécurisés :**
   ```bash
   # Sur votre machine locale
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

5. Cliquez **"Create Web Service"**

## Étape 6 : Attendre le déploiement

1. Render va :
   - ✅ Cloner votre repo
   - ✅ Installer les dépendances (`npm install`)
   - ✅ Démarrer le serveur (`npm start`)
   - ✅ Assigner une URL HTTPS

2. **Attendez 3-5 minutes** que le déploiement se termine

3. Votre API sera accessible sur : `https://molam-id-api.onrender.com`

## Étape 7 : Tester le backend

```bash
# Test depuis votre navigateur ou terminal
curl https://molam-id-api.onrender.com/api/health
```

Vous devriez voir :
```json
{
  "status": "ok",
  "service": "molam-id-core",
  "timestamp": "..."
}
```

## Étape 8 : Mettre à jour Vercel avec la nouvelle URL

1. Éditez `vercel.json` :
   ```json
   {
     "env": {
       "VITE_API_URL": "https://molam-id-api.onrender.com"
     }
   }
   ```

2. Committez et poussez :
   ```bash
   git add vercel.json
   git commit -m "Update API URL to Render backend"
   git push
   ```

3. Vercel redéploiera automatiquement le frontend

## ✅ Résultat Final

- **Frontend** : `https://molam-id-sbr1.vercel.app`
- **Backend** : `https://molam-id-api.onrender.com`
- **Database** : PostgreSQL sur Render (interne)
- **HTTPS** : Certificat SSL automatique
- **Gratuit** : Plan free sur les deux services

## 🔧 Maintenance

### Redéployer le backend

Render redéploie automatiquement à chaque push sur GitHub :

```bash
git add .
git commit -m "Update backend"
git push
```

### Voir les logs

1. Dashboard Render → Votre service
2. Onglet **"Logs"**

### Limitation du plan Free

⚠️ **IMPORTANT** : Le plan Free de Render met le service en veille après **15 minutes d'inactivité**.

- Le premier appel après inactivité prendra **30-60 secondes** (démarrage à froid)
- Pour une vraie production, passez au plan **Starter** (7$/mois) qui reste actif 24/7

## 🐛 Dépannage

### "Application failed to respond"

- Vérifiez que `PORT=10000` dans les variables d'environnement
- Vérifiez les logs Render pour voir les erreurs

### "Database connection failed"

- Vérifiez que les variables DB_* correspondent à votre database Render
- Utilisez l'**Internal Database URL** (pas External)

### CORS errors depuis Vercel

- Ajoutez l'URL Vercel dans `ALLOWED_ORIGINS`
- Redéployez le backend

---

**Bon déploiement ! 🚀**
