# 🎨 Interface Web Admin - Guide de Démarrage

Une interface web moderne et intuitive pour gérer Molam ID !

## 🚀 Démarrage Rapide (3 étapes)

### Étape 1 : Démarrer le serveur

Ouvrez un terminal et exécutez :

```bash
cd C:\Users\lomao\Desktop\Molam\Molam-id
npm start
```

Attendez de voir :
```
================================================================================
🚀 MOLAM-ID CORE SERVER
================================================================================
📡 Server listening on port 3000
```

### Étape 2 : Ouvrir l'interface dans votre navigateur

Ouvrez votre navigateur préféré (Chrome, Firefox, Edge) et allez sur :

```
http://localhost:3000/admin
```

### Étape 3 : Se connecter

Utilisez les identifiants du super admin :

| Champ | Valeur |
|-------|--------|
| **Email** | `admin@molam.sn` |
| **Mot de passe** | `SuperSecure123!` |

Cliquez sur **"Se connecter"** et c'est parti ! 🎉

## 📸 Aperçu de l'interface

### 🔐 Écran de Connexion
- Design moderne avec gradient violet
- Logo emoji 🔐
- Formulaire simple et sécurisé
- Messages d'erreur clairs

### 📊 Dashboard (Page d'accueil)
**4 statistiques en un coup d'œil :**
- 👥 Total des utilisateurs
- ✅ Utilisateurs actifs
- ⏳ Utilisateurs en attente
- 🆕 Nouveaux cette semaine

**Tableau des utilisateurs récents** avec :
- Email
- Rôles
- Statut (badge coloré)
- Date de création

### 👥 Page Utilisateurs

**Barre d'actions :**
- 🔍 Recherche en temps réel (email, téléphone, Molam ID)
- ➕ Bouton "Nouvel utilisateur"

**Tableau détaillé avec :**
- Molam ID (code)
- Email
- Téléphone
- Rôles (liste)
- Statut (badge coloré : vert=actif, orange=en attente, rouge=suspendu)
- KYC Status (badges)
- Actions rapides :
  - 👁️ Voir les détails
  - ⏸️ Suspendre / ▶️ Activer

**Pagination :**
- Boutons Précédent/Suivant
- Indicateur de page (ex: "Page 1 sur 5")

### 🎭 Page Rôles

**Grille de cartes élégantes** montrant :
- Nom du rôle (titre)
- Module (badge)
- Description
- Badge "Système" pour les rôles protégés
- 🗑️ Bouton supprimer (rôles personnalisés uniquement)

**Bouton "➕ Nouveau rôle"** pour créer des rôles personnalisés

### 📜 Page Audit
- Bientôt disponible !
- Historique complet des actions

## ✨ Fonctionnalités Principales

### Créer un Utilisateur

1. Cliquez sur **"Utilisateurs"** dans le menu
2. Cliquez sur **"➕ Nouvel utilisateur"**
3. Formulaire modal s'ouvre avec :
   - Email * (requis)
   - Téléphone (optionnel, format : +221...)
   - Mot de passe * (minimum 8 caractères)
   - Rôle (liste déroulante : client, merchant, agent)
   - Statut (actif, en attente, suspendu)
4. Cliquez sur **"Créer"**
5. **Toast de confirmation** apparaît ✅
6. L'utilisateur apparaît dans la liste

### Gérer les Utilisateurs

**Voir les détails :**
- Cliquez sur 👁️ pour voir les infos complètes
- Popup avec : Molam ID, Email, Statut, KYC, Date de création

**Suspendre un utilisateur :**
- Cliquez sur ⏸️ (bouton pause jaune)
- Confirmation demandée
- Badge passe en rouge "Suspendu"

**Réactiver un utilisateur :**
- Cliquez sur ▶️ (bouton play vert)
- Badge repasse en vert "Actif"

**Rechercher :**
- Tapez dans la barre de recherche
- Résultats filtrés en temps réel
- Recherche dans : email, téléphone, Molam ID

### Créer un Rôle Personnalisé

1. Cliquez sur **"Rôles"** dans le menu
2. Cliquez sur **"➕ Nouveau rôle"**
3. Remplissez le formulaire :
   - Nom du rôle (ex: `pay_manager`)
   - Nom d'affichage (ex: `Gestionnaire Pay`)
   - Module : Global, Pay, Eats, Shop
   - Description (optionnel)
4. Cliquez sur **"Créer"**
5. Le rôle apparaît dans la grille

### Supprimer un Rôle

1. Dans la page Rôles
2. Trouvez le rôle (personnalisé uniquement)
3. Cliquez sur **"🗑️ Supprimer"**
4. Confirmez
5. Le rôle est supprimé

**Note :** Les rôles système ne peuvent pas être supprimés (badge "Système").

## 🎨 Design et UX

### Thème

- **Couleurs principales :** Violet/Mauve (#667eea, #764ba2)
- **Sidebar :** Fond sombre (#1f2937)
- **Contenu :** Fond clair (#f9fafb)
- **Cartes :** Blanc avec ombres douces

### Navigation

**Sidebar (menu latéral) :**
- 📊 Dashboard
- 👥 Utilisateurs
- 🎭 Rôles
- 📜 Audit

**Zone utilisateur en bas :**
- Avatar (👤)
- Nom et email de l'admin connecté
- Bouton "Déconnexion"

### Notifications

**Toast (notifications en bas à droite) :**
- ✅ Vert pour succès
- ❌ Rouge pour erreur
- Disparaît automatiquement après 3 secondes

### Badges de Statut

**Statuts utilisateurs :**
- 🟢 Actif (vert)
- 🟡 En attente (orange)
- 🔴 Suspendu (rouge)
- ⚫ Fermé (gris foncé)

**Statuts KYC :**
- 🟢 Vérifié (vert)
- 🟡 En cours (orange)
- 🔴 Rejeté (rouge)
- 🔵 Non vérifié (bleu)

## 🔒 Sécurité

### Protection Automatique

- ✅ **Authentification obligatoire** - Redirection vers login si non connecté
- ✅ **Token JWT** - Stocké localement, expire après 15 minutes
- ✅ **Déconnexion auto** - Si le token expire ou est invalide
- ✅ **Rôle requis** - Seuls les `super_admin` peuvent accéder à l'interface

### Auto-Protection Admin

Vous **ne pouvez pas** :
- ❌ Supprimer votre propre compte
- ❌ Révoquer votre propre rôle super_admin
- ❌ Supprimer les rôles système

### Audit Trail

Toutes les actions sont enregistrées :
- Création d'utilisateurs
- Modification de statut
- Attribution/révocation de rôles
- Suspension/activation

## 📱 Responsive Design

L'interface s'adapte à tous les écrans :

**Desktop (>768px) :**
- Sidebar complète avec texte
- Grille multi-colonnes
- Tous les détails visibles

**Mobile et Tablette (<768px) :**
- Sidebar réduite (icônes uniquement)
- Grille simple colonne
- Navigation tactile optimisée

## ⌨️ Raccourcis et Astuces

### Recherche Rapide
- Tapez directement dans la barre de recherche
- Pas besoin d'appuyer sur "Entrée"
- Résultats instantanés

### Fermer les Modals
- Cliquez en dehors du modal
- Cliquez sur le bouton ✕
- Ou utilisez "Annuler"

### Rafraîchir les Données
- Cliquez sur 🔄 dans la barre d'actions
- Ou changez de page et revenez

## 🆘 Problèmes Courants

### "Connection refused" ou page ne charge pas

**Solution :**
```bash
# Vérifier que le serveur tourne
npm start

# Vérifier l'URL (port 3000, pas 3001)
http://localhost:3000/admin
```

### "Invalid credentials" au login

**Solution :**
```bash
# Créer/Vérifier le super admin
node scripts/create-super-admin-simple.js

# Identifiants corrects :
Email: admin@molam.sn
Password: SuperSecure123!
```

### "Session expirée"

**Solution :**
- Normal après 15 minutes d'inactivité
- Reconnectez-vous simplement
- Vos données sont sauvegardées

### Les statistiques affichent "-" ou "0"

**Solutions :**
1. Vérifier que le serveur répond :
   ```bash
   curl http://localhost:3000/api/admin/users/stats \
     -H "Authorization: Bearer VOTRE_TOKEN"
   ```

2. Créer des utilisateurs de test pour avoir des données

3. Vérifier les logs du serveur (console)

### Erreur "Forbidden" (403)

**Cause :** Votre compte n'a pas le rôle `super_admin`

**Solution :**
```bash
# Vérifier les rôles de votre compte dans la BDD
psql -U postgres -d molam -c "SELECT email, role_profile FROM molam_users WHERE email='admin@molam.sn';"

# Le role_profile doit contenir 'super_admin'
```

## 🎯 Prochaines Étapes

Après avoir exploré l'interface :

1. **Créez des utilisateurs de test** pour voir les fonctionnalités
2. **Testez la recherche** et la pagination
3. **Créez un rôle personnalisé** pour votre projet
4. **Explorez les statistiques** du dashboard

## 📚 Documentation Complémentaire

- [README Interface](public/admin/README.md) - Documentation technique de l'interface
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Guide API complet
- [QUICK_START_ADMIN.md](QUICK_START_ADMIN.md) - Guide démarrage rapide CLI

## 🎉 C'est Parti !

Vous êtes maintenant prêt à utiliser l'interface admin de Molam ID !

**URL à retenir :** http://localhost:3000/admin

**Identifiants par défaut :**
- Email: `admin@molam.sn`
- Password: `SuperSecure123!`

Bonne administration ! 🚀
