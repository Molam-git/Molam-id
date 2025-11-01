# Molam ID Desktop App

Application desktop Electron pour la gestion de l'identité Molam ID.

## Description

Cette application desktop encapsule l'interface web Molam ID dans une application Electron native, offrant une expérience desktop complète avec:

- Interface native pour Windows, macOS et Linux
- Mises à jour automatiques
- Intégration système (notifications, icône dans la barre des tâches)
- Gestion sécurisée des sessions
- Mode hors ligne (cache local)

## Plateformes supportées

- Windows 10/11 (64-bit)
- macOS 10.13+ (Intel & Apple Silicon)
- Linux (Ubuntu 20.04+, Fedora 34+, Debian 11+)

## Installation

```bash
npm install
```

## Configuration

Créer un fichier `.env` :

```env
WEB_APP_URL=http://localhost:5173
NODE_ENV=development
```

Pour la production:
```env
NODE_ENV=production
```

## Développement

```bash
npm start
```

## Build

### Windows

```bash
npm run build:win
```

Génère un installateur NSIS dans `dist/`.

### macOS

```bash
npm run build:mac
```

Génère un fichier DMG dans `dist/`.

### Linux

```bash
npm run build:linux
```

Génère AppImage et DEB dans `dist/`.

## Structure

```
desktop/
├── main.js          # Processus principal Electron
├── preload.js       # Script de préchargement
├── package.json     # Configuration npm et electron-builder
├── icon.png         # Icône Linux
├── icon.icns        # Icône macOS
└── icon.ico         # Icône Windows
```

## Fonctionnalités

- ✅ Encapsulation de l'app web
- ✅ Menu natif multilingue
- ✅ Mises à jour automatiques
- ✅ Gestion des liens externes
- ✅ Intégration système
- ✅ Zoom et plein écran
- ✅ DevTools en développement
- ✅ Support multi-plateforme

## Sécurité

- Context isolation activé
- Node integration désactivé
- Web security activé
- CSP (Content Security Policy) respecté
- Preload script pour communication sécurisée

## Distribution

Les builds de production sont signés et notarisés:

- **Windows**: Signature Authenticode
- **macOS**: Signature Apple Developer + Notarization
- **Linux**: Signature GPG optionnelle

## Mises à jour

Les mises à jour automatiques utilisent `electron-updater` avec les serveurs suivants:

- Production: `https://updates.molam.sn`
- Staging: `https://updates-staging.molam.sn`

## License

MIT © Molam
