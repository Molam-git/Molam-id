# 🚀 Guide de Déploiement Molam ID

Ce guide vous explique comment déployer Molam ID en production avec des liens accessibles publiquement.

## 📦 Architecture de déploiement

```
Frontend (React Native Web)  →  Vercel      →  https://molam-id.vercel.app
Backend (Node.js API)        →  Render.com  →  https://molam-id-api.onrender.com
Database (PostgreSQL)        →  Render.com  →  (interne)
```

---

## 🎯 Partie 1 : Déployer le Backend sur Render

### Étape 1 : Créer un compte Render

1. Allez sur [https://render.com](https://render.com)
2. Cliquez sur **"Get Started"**
3. Inscrivez-vous avec GitHub (recommandé)

### Étape 2 : Pousser le code sur GitHub

```bash
cd C:\Users\lomao\Desktop\Molam\Molam-id

# Initialiser Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit - Molam ID"

# Créer un repo sur GitHub
# Puis:
git remote add origin https://github.com/VOTRE_USERNAME/molam-id.git
git branch -M main
git push -u origin main
```

### Étape 3 : Créer le service Web sur Render

1. Sur Render Dashboard, cliquez **"New +"** → **"Web Service"**
2. Connectez votre repo GitHub `molam-id`
3. Configurez :
   - **Name**: `molam-id-api`
   - **Region**: Frankfurt (ou le plus proche)
   - **Branch**: `main`
   - **Root Directory**: `.` (racine)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Variables d'environnement** (cliquez "Advanced") :
   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=(auto-généré ou créez un secret)
   JWT_REFRESH_SECRET=(auto-généré ou créez un secret)
   ```

5. Cliquez **"Create Web Service"**

### Étape 4 : Créer la base de données PostgreSQL

1. Sur Render Dashboard, cliquez **"New +"** → **"PostgreSQL"**
2. Configurez :
   - **Name**: `molam-id-db`
   - **Database**: `molam`
   - **User**: (auto-généré)
   - **Region**: Même que le backend
   - **Plan**: Free

3. Cliquez **"Create Database"**

### Étape 5 : Connecter le backend à la database

1. Retournez sur votre Web Service `molam-id-api`
2. Allez dans **Environment**
3. Ajoutez ces variables (copiées depuis la page de votre database) :
   ```
   DB_HOST=<internal-host-from-render>
   DB_PORT=5432
   DB_USER=<user-from-render>
   DB_PASSWORD=<password-from-render>
   DB_NAME=molam
   ```

4. Le service va redéployer automatiquement

### Étape 6 : Initialiser la base de données

```bash
# Depuis votre machine locale, connectez-vous à la database Render
# Copiez l'External Database URL depuis Render

psql <EXTERNAL_DATABASE_URL>

# Puis exécutez le script d'initialisation
\i sql/000_unified_schema.sql
\i sql/010_device_fingerprinting.sql
\i sql/011_mfa.sql
\i sql/013_blacklist.sql
```

Ou utilisez le script :
```bash
node init-database.js
```
(Modifiez `init-database.js` pour utiliser l'URL Render temporairement)

### ✅ Backend déployé !

Votre API est maintenant accessible sur : `https://molam-id-api.onrender.com`

Testez : `https://molam-id-api.onrender.com/health`

---

## 🌐 Partie 2 : Déployer le Frontend sur Vercel

### Étape 1 : Créer un compte Vercel

1. Allez sur [https://vercel.com](https://vercel.com)
2. Cliquez **"Sign Up"**
3. Inscrivez-vous avec GitHub

### Étape 2 : Importer le projet

1. Sur Vercel Dashboard, cliquez **"Add New..."** → **"Project"**
2. Sélectionnez votre repo `molam-id`
3. Configurez :
   - **Framework Preset**: Other
   - **Root Directory**: `brique-36-ui-id/mobile`
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Étape 3 : Configurer les variables d'environnement

1. Dans **Environment Variables**, ajoutez :
   ```
   EXPO_PUBLIC_API_URL=https://molam-id-api.onrender.com
   ```

2. Cliquez **"Deploy"**

### Étape 4 : Attendre le build

Vercel va :
1. ✅ Installer les dépendances
2. ✅ Builder l'app React Native Web
3. ✅ Déployer sur CDN global
4. ✅ Fournir un domaine HTTPS

### ✅ Frontend déployé !

Votre app est maintenant accessible sur : `https://molam-id-XXXX.vercel.app`

Vercel vous donnera l'URL exacte.

---

## 🎉 Résultat Final

Vous avez maintenant :

- ✅ **Frontend Web** : `https://molam-id.vercel.app`
- ✅ **Backend API** : `https://molam-id-api.onrender.com`
- ✅ **Base de données** : PostgreSQL hébergé sur Render
- ✅ **HTTPS** : Certificat SSL automatique
- ✅ **Gratuit** : Plan free sur les deux services

---

## 🔧 Déploiements futurs

### Mettre à jour le backend

```bash
git add .
git commit -m "Update backend"
git push
```

➡️ Render redéploie automatiquement

### Mettre à jour le frontend

```bash
git add .
git commit -m "Update frontend"
git push
```

➡️ Vercel redéploie automatiquement

---

## 📱 Application Mobile

Pour l'app mobile (iOS/Android), vous devrez :

1. **Build avec Expo EAS** :
   ```bash
   cd brique-36-ui-id/mobile
   npm install -g eas-cli
   eas build --platform all
   ```

2. **Publier** :
   - iOS : App Store Connect
   - Android : Google Play Console

---

## 🐛 Dépannage

### Le backend ne démarre pas

- Vérifiez les logs sur Render Dashboard
- Vérifiez que toutes les variables d'environnement sont définies
- Vérifiez que la database est connectée

### Le frontend ne se connecte pas au backend

- Vérifiez que `EXPO_PUBLIC_API_URL` pointe vers votre backend Render
- Vérifiez que le backend accepte les requêtes CORS
- Testez l'API directement : `https://molam-id-api.onrender.com/health`

### "Error: Cannot find module"

- Supprimez `node_modules` et relancez `npm install`
- Vérifiez que toutes les dépendances sont dans `package.json`

---

## 🎯 Prochaines étapes

1. ✅ **Domaine personnalisé** : Configurez `molam.id` sur Vercel/Render
2. ✅ **Email** : Ajoutez SendGrid ou AWS SES pour les emails
3. ✅ **Monitoring** : Ajoutez Sentry pour le monitoring d'erreurs
4. ✅ **Analytics** : Ajoutez Google Analytics ou Plausible
5. ✅ **CDN** : Déjà inclus avec Vercel !

---

## 💰 Coûts

### Plan Free (Actuel)
- **Vercel** : Gratuit jusqu'à 100 GB de bande passante/mois
- **Render** : Gratuit mais le service "dort" après 15 min d'inactivité
- **Total** : 0€/mois

### Plan Recommandé (Production)
- **Vercel Pro** : 20$/mois (bande passante illimitée)
- **Render Starter** : 7$/mois (service toujours actif)
- **Total** : 27$/mois (~25€/mois)

---

## 📞 Support

- **Vercel** : [https://vercel.com/support](https://vercel.com/support)
- **Render** : [https://render.com/docs](https://render.com/docs)
- **Expo** : [https://docs.expo.dev](https://docs.expo.dev)

---

**Bon déploiement ! 🚀**
