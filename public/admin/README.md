# 🎨 Interface Admin Molam ID

Interface web moderne et intuitive pour gérer les utilisateurs et les rôles de Molam ID.

## 🚀 Accès à l'interface

### 1. Démarrer le serveur

```bash
npm start
```

### 2. Ouvrir l'interface

Ouvrez votre navigateur et accédez à :

```
http://localhost:3000/admin
```

### 3. Se connecter

Utilisez les identifiants du super admin :

- **Email :** `admin@molam.sn`
- **Mot de passe :** `SuperSecure123!`

## ✨ Fonctionnalités

### 📊 Dashboard
- Vue d'ensemble des statistiques
- Total des utilisateurs
- Utilisateurs actifs/en attente
- Nouveaux utilisateurs de la semaine
- Liste des utilisateurs récents

### 👥 Gestion des Utilisateurs
- **Liste complète** avec pagination
- **Recherche** par email, téléphone ou Molam ID
- **Créer** de nouveaux utilisateurs
- **Voir** les détails d'un utilisateur
- **Suspendre** ou **Activer** des comptes
- **Filtres** par statut et rôle

### 🎭 Gestion des Rôles
- **Liste** de tous les rôles disponibles
- **Créer** des rôles personnalisés
- **Supprimer** des rôles (hors rôles système)
- Voir les détails de chaque rôle (module, description)

### 📜 Audit (Bientôt)
- Journal complet des actions admin
- Traçabilité de toutes les opérations

## 🎯 Utilisation

### Créer un utilisateur

1. Cliquez sur **"Utilisateurs"** dans la sidebar
2. Cliquez sur **"➕ Nouvel utilisateur"**
3. Remplissez le formulaire :
   - Email (requis)
   - Téléphone (optionnel)
   - Mot de passe (minimum 8 caractères)
   - Rôle (client, merchant, agent)
   - Statut (actif, en attente, suspendu)
4. Cliquez sur **"Créer"**

### Suspendre un utilisateur

1. Dans la liste des utilisateurs
2. Cliquez sur le bouton **"⏸️"** (Pause)
3. Confirmez l'action

### Activer un utilisateur suspendu

1. Dans la liste des utilisateurs
2. Cliquez sur le bouton **"▶️"** (Play)
3. L'utilisateur sera réactivé

### Créer un rôle personnalisé

1. Cliquez sur **"Rôles"** dans la sidebar
2. Cliquez sur **"➕ Nouveau rôle"**
3. Remplissez :
   - Nom du rôle (ex: `pay_manager`)
   - Nom d'affichage (ex: `Gestionnaire Pay`)
   - Module (pay, eats, shop, ou global)
   - Description
4. Cliquez sur **"Créer"**

## 🔐 Sécurité

- ✅ **Authentification obligatoire** - Tous les accès nécessitent une connexion
- ✅ **Token JWT** - Sécurisé avec expiration automatique (15min)
- ✅ **Rôle super_admin requis** - Seuls les super admins peuvent accéder
- ✅ **Auto-protection** - Impossible de se supprimer ou de révoquer son propre rôle
- ✅ **Audit trail** - Toutes les actions sont loggées

## 💾 Stockage Local

L'interface utilise le localStorage pour :
- Token d'authentification (expire après 15 minutes)
- Informations utilisateur (nom, email)

**⚠️ Déconnexion automatique** si le token expire ou est invalide.

## 🎨 Design

- Interface moderne et responsive
- Thème sombre pour la sidebar
- Animations fluides
- Compatible mobile et desktop
- Icons émoji pour simplicité

## 🔧 Développement

### Structure des fichiers

```
public/admin/
├── index.html     # Structure HTML
├── styles.css     # Styles CSS
├── app.js         # Logique JavaScript
└── README.md      # Ce fichier
```

### Modification

Les fichiers sont en HTML/CSS/JavaScript vanilla (sans framework) pour :
- ✅ Légèreté (pas de dépendances)
- ✅ Rapidité de chargement
- ✅ Facilité de modification
- ✅ Pas de build nécessaire

## 📱 Screenshots

### Page de Login
- Formulaire centré avec gradient
- Champs email et mot de passe
- Logo et titre

### Dashboard
- 4 cartes de statistiques
- Tableau des utilisateurs récents
- Navigation latérale

### Gestion des utilisateurs
- Tableau avec colonnes : Molam ID, Email, Téléphone, Rôles, Statut, KYC
- Boutons d'action : Voir, Suspendre/Activer
- Pagination
- Recherche en temps réel

### Gestion des rôles
- Grille de cartes
- Chaque carte montre : Nom, Module, Description
- Badge "Système" pour les rôles protégés
- Bouton supprimer pour les rôles personnalisés

## 🆘 Dépannage

### L'interface ne charge pas
```bash
# Vérifier que le serveur est démarré
npm start

# Vérifier l'URL
http://localhost:3000/admin  (pas 3001 !)
```

### Erreur "Session expirée"
```
- Le token expire après 15 minutes
- Reconnectez-vous simplement
```

### Impossible de se connecter
```bash
# Vérifier que le super admin existe
node scripts/create-super-admin-simple.js

# Vérifier les identifiants
Email: admin@molam.sn
Password: SuperSecure123!
```

### Les données ne se chargent pas
```
- Ouvrez la console du navigateur (F12)
- Vérifiez s'il y a des erreurs
- Vérifiez que le serveur répond aux appels API
```

## 🚀 Prochaines améliorations possibles

- [ ] Export des données (CSV, PDF)
- [ ] Graphiques et analytics
- [ ] Filtres avancés
- [ ] Gestion en masse (sélection multiple)
- [ ] Notifications push
- [ ] Mode sombre/clair
- [ ] Multi-langue (i18n)
- [ ] Historique d'audit détaillé
- [ ] Gestion des permissions granulaires

## 📞 Support

Pour toute question ou problème :
- Documentation API : [ADMIN_GUIDE.md](../../ADMIN_GUIDE.md)
- Guide démarrage rapide : [QUICK_START_ADMIN.md](../../QUICK_START_ADMIN.md)
