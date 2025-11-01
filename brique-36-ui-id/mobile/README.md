# Molam ID Mobile App

Application mobile React Native pour la gestion de l'identité Molam ID.

## Plateformes supportées

- iOS (12.4+)
- Android (6.0+, API 23+)
- HarmonyOS (via React Native)

## Installation

```bash
npm install
```

## Configuration

Créer un fichier `.env` :

```env
API_URL=http://localhost:3000
```

## Développement

### iOS

```bash
cd ios && pod install && cd ..
npm run ios
```

### Android

```bash
npm run android
```

## Build de production

### iOS

```bash
cd ios
xcodebuild -workspace MolamID.xcworkspace -scheme MolamID -configuration Release archive
```

### Android

```bash
cd android
./gradlew assembleRelease
```

## Fonctionnalités

- ✅ Authentification (login/signup)
- ✅ Gestion du profil
- ✅ Gestion des sessions
- ✅ Documents légaux
- ✅ Support multilingue (FR, EN, WO, AR, ES, PT)
- ✅ Mode sombre
- ✅ Navigation native
- ✅ Gestion sécurisée des tokens (Keychain/KeyStore)

## Architecture

```
mobile/
├── src/
│   ├── contexts/       # Contexts (Auth, Theme)
│   ├── screens/        # Écrans principaux
│   ├── components/     # Composants réutilisables
│   └── utils/          # Utilitaires
├── ios/               # Code iOS natif
├── android/           # Code Android natif
└── App.tsx            # Point d'entrée
```

## License

MIT © Molam
