# 🚀 React Native Web - Un seul code pour Web + Mobile

Votre app Molam ID utilise maintenant **React Native Web** : un seul code source qui fonctionne sur **mobile ET web**.

## ✅ Ce qui a été fait

### 1. Installation de React Native Web
```bash
✅ react-native-web
✅ react-dom
```

### 2. Storage universel
Créé `src/lib/storage.ts` qui utilise :
- **Mobile** : AsyncStorage
- **Web** : localStorage

### 3. Client d'authentification compatible
`src/lib/MolamIdClient.ts` fonctionne sur mobile ET web.

## 🎯 Structure du projet

```
brique-36-ui-id/mobile/  (maintenant projet principal pour Web + Mobile)
├── src/
│   ├── screens/         # Login, Signup, Profile, etc.
│   ├── contexts/        # AuthContext, ThemeContext
│   ├── lib/
│   │   ├── storage.ts   # ✨ Storage universel (web + mobile)
│   │   └── MolamIdClient.ts  # ✨ Client API compatible web + mobile
│   └── App.tsx
├── app.json             # Configuration Expo
└── package.json
```

## 🚀 Comment lancer

### Option 1 : Lancer sur le WEB (navigateur) 🌐
```bash
cd brique-36-ui-id/mobile
npm run web
```
Ou :
```bash
npm run start:web
```

➡️ Ouvre automatiquement dans votre navigateur sur `http://localhost:8081`

### Option 2 : Lancer sur MOBILE (téléphone) 📱
```bash
cd brique-36-ui-id/mobile
npm start
```
Ou :
```bash
npm run start:mobile
```

➡️ Scannez le QR code avec Expo Go

### Option 3 : Lancer les DEUX en même temps 🔥
**Terminal 1** - Web :
```bash
npm run start:web
```

**Terminal 2** - Mobile :
```bash
npm start
```

## 📊 Comparaison

| Fonctionnalité | Avant | Après |
|----------------|-------|-------|
| **Code source** | Web séparé + Mobile séparé | ✅ Un seul code |
| **Maintenance** | 2x plus de travail | ✅ Une seule codebase |
| **Design** | Risque d'incohérence | ✅ Design identique garanti |
| **Compilation web** | ❌ Pas supporté | ✅ `npm run web` |
| **Compilation mobile** | ✅ Expo | ✅ Expo |

## 🎨 Design

Le design est identique sur web et mobile :
- ✅ Carte blanche avec ombre
- ✅ Couleurs Molam (#0066cc)
- ✅ Labels au-dessus des champs
- ✅ Bordures arrondies
- ✅ Responsive automatique

## 🔥 Avantages

### Pour le développement
- **Un seul fichier à modifier** pour changer le login/signup
- **Pas de duplication** de code
- **Tests plus faciles** (un seul test suite)

### Pour les utilisateurs
- **Expérience cohérente** entre web et mobile
- **Même design** partout
- **Moins de bugs** (un seul code = moins d'erreurs)

## 📝 Scripts disponibles

```bash
npm start          # Mobile (avec QR code)
npm run web        # Web (navigateur)
npm run android    # Android (émulateur ou câble)
npm run ios        # iOS (Mac uniquement)
npm run tunnel     # Mobile (mode tunnel, fonctionne partout)
```

## 🌐 Configuration de l'API

Le fichier `src/config/api.ts` détecte automatiquement la plateforme :
- **Mobile** : Utilise votre IP locale (192.168.1.22:3000)
- **Web** : Peut utiliser localhost ou votre API de production

## ✨ Fonctionnalités

### Écrans disponibles
- ✅ Login (Connexion)
- ✅ Signup (Inscription)
- ✅ Profile
- ✅ Sessions
- ✅ Legal

### Authentification
- ✅ Login avec téléphone/email + mot de passe
- ✅ Signup avec validation
- ✅ Tokens JWT stockés (AsyncStorage mobile / localStorage web)
- ✅ Navigation automatique après connexion

## 🔧 Dépannage

### Le web ne démarre pas
```bash
# Vérifier que le port n'est pas utilisé
netstat -ano | findstr :8081

# Ou lancer sur un autre port
npx expo start --web --port 8082
```

### Erreur "Metro bundler"
```bash
# Nettoyer le cache
npx expo start --clear
```

### Le mobile ne se connecte pas au backend
Vérifiez `src/config/api.ts` ligne 13 :
```typescript
const DEV_API_URL = 'http://192.168.1.22:3000';  // Votre IP locale
```

## 📚 Documentation

- [React Native Web](https://necolas.github.io/react-native-web/)
- [Expo Web](https://docs.expo.dev/workflow/web/)
- [React Native](https://reactnative.dev/)

## 🎉 Résultat

Vous avez maintenant **une seule app** qui fonctionne sur :
- ✅ Web (Chrome, Firefox, Safari)
- ✅ iOS (iPhone, iPad)
- ✅ Android (téléphones, tablettes)

**Un seul code source, trois plateformes !** 🚀
