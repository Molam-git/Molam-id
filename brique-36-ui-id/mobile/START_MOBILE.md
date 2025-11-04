# 📱 Démarrer l'App Mobile Molam ID

## 🚀 Démarrage rapide avec QR Code

### 1. Installer l'app Expo Go sur votre téléphone

- **Android**: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)

### 2. Lancer le serveur de développement

```bash
cd brique-36-ui-id/mobile
npx expo start
```

### 3. Scanner le QR Code

- Un QR code apparaîtra dans le terminal
- Ouvrez l'app **Expo Go** sur votre téléphone
- Scannez le QR code
- L'app se chargera automatiquement !

## 🌐 Mode Tunnel (si le QR ne marche pas)

Si vous n'êtes pas sur le même réseau WiFi :

```bash
npx expo start --tunnel
```

## 📝 Scripts disponibles

```bash
# Démarrer avec QR code
npm start
# ou
npx expo start

# Ouvrir directement sur Android (émulateur ou câble USB)
npx expo start --android

# Ouvrir directement sur iOS (Mac uniquement)
npx expo start --ios

# Mode tunnel (fonctionne partout)
npx expo start --tunnel
```

## 🔧 Configuration

L'app est configurée dans `app.json` :
- Nom: **Molam ID**
- Slug: molam-id-mobile
- Orientation: Portrait
- Couleur principale: #0066cc

## 🎨 Mobile First

L'app est conçue **mobile-first** avec :
- Navigation bottom tabs (Profil, Sessions, Légal)
- Authentification (Login, Signup)
- Responsive design
- Thème adaptatif (light/dark)

## 📦 Dépendances principales

- **Expo**: Framework React Native
- **React Navigation**: Navigation entre écrans
- **React Query**: Gestion de l'état et cache
- **Molam SDK Auth**: SDK d'authentification

## 🐛 Dépannage

### Le QR code n'apparaît pas

```bash
# Réinstaller les dépendances
npm install

# Nettoyer le cache
npx expo start --clear
```

### "Metro bundler error"

```bash
# Tuer les processus Node
taskkill /F /IM node.exe

# Redémarrer
npx expo start
```

### Problème de connexion

- Vérifiez que votre PC et téléphone sont sur le **même WiFi**
- Utilisez `npx expo start --tunnel` si différents réseaux
- Désactivez temporairement le pare-feu Windows

## 📸 Captures d'écran

L'app contient :
- 📲 Écran de connexion
- ✍️ Écran d'inscription
- 👤 Écran de profil
- 🔒 Gestion des sessions
- 📄 Mentions légales

---

**Prêt à développer !** 🎉
