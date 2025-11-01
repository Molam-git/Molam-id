# Brique 36 — UI de gestion ID (Multi-platform)

Interface utilisateur multi-plateforme pour la gestion de l'identité Molam ID.

## Composants

### 1. API Backend (Node.js/Express)
Serveur API pour la gestion des documents légaux versionnés.

**Port**: 3036

**Endpoints**:
- `GET /api/legal/:type/:lang` - Document légal le plus récent
- `GET /api/legal/:type/:lang/:version` - Version spécifique
- `GET /api/legal/:type/:lang/versions` - Liste des versions
- `GET /api/legal/types` - Types de documents
- `GET /api/legal/languages` - Langues disponibles
- `GET /health`, `/healthz`, `/livez` - Health checks

### 2. Web UI (React PWA)
Progressive Web App avec React, TypeScript, et Vite.

**Fonctionnalités**:
- 🔐 Authentification (login/signup)
- 👤 Gestion du profil utilisateur
- 🔒 Gestion des sessions actives
- 📄 Consultation des documents légaux
- 🌙 Mode sombre / clair
- 🔊 Synthèse vocale (TTS)
- ♿ Accessibilité complète
- 🌐 Support multilingue (FR, EN, WO, AR, ES, PT)
- 📱 Progressive Web App (installable)
- 🍔 Navigation hamburger responsive

### 3. Mobile UI (React Native)
Application mobile native pour iOS, Android et HarmonyOS.

**Fonctionnalités**:
- Navigation native (Stack + Bottom Tabs)
- Intégration SDK Auth Molam ID
- Gestion sécurisée des tokens
- Interface optimisée mobile
- Support iOS & Android

### 4. Desktop UI (Electron)
Application desktop pour Windows, macOS et Linux.

**Fonctionnalités**:
- Encapsulation de l'app web
- Menu natif multilingue
- Mises à jour automatiques
- Intégration système

## Architecture

```
brique-36-ui-id/
├── api/                    # Backend API
│   ├── src/
│   │   ├── db.ts          # PostgreSQL connection
│   │   ├── routes/
│   │   │   └── legal.routes.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── web/                    # Web PWA
│   ├── src/
│   │   ├── components/    # Navigation, Footer
│   │   ├── contexts/      # Auth, Theme, TTS
│   │   ├── pages/         # Login, Profile, Sessions, Legal
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   └── Dockerfile
├── mobile/                 # React Native
│   ├── src/
│   │   ├── contexts/      # Auth, Theme
│   │   └── screens/       # Login, Profile, Sessions, Legal
│   ├── App.tsx
│   ├── package.json
│   └── tsconfig.json
├── desktop/                # Electron
│   ├── main.js
│   ├── preload.js
│   └── package.json
└── sql/
    └── 036_ui_id.sql      # Schema versionnage docs légaux
```

## Démarrage rapide

### Backend API

```bash
cd api
npm install
npm run dev
# API disponible sur http://localhost:3036
```

### Web UI

```bash
cd web
npm install
npm run dev
# App disponible sur http://localhost:5173
```

### Mobile

```bash
cd mobile
npm install
# iOS
npm run ios
# Android
npm run android
```

### Desktop

```bash
cd desktop
npm install
npm start
```

## Déploiement

### Backend API (Docker)

```bash
cd api
docker build -t molam-ui-id-api .
docker run -p 3036:3036 -e DATABASE_URL=... molam-ui-id-api
```

### Web UI (Docker)

```bash
cd web
docker build -t molam-ui-id-web .
docker run -p 80:80 molam-ui-id-web
```

### Mobile (Stores)

**iOS (App Store)**:
```bash
cd mobile
cd ios && pod install
xcodebuild -workspace MolamID.xcworkspace -scheme MolamID -configuration Release archive
```

**Android (Play Store)**:
```bash
cd mobile/android
./gradlew assembleRelease
```

### Desktop (Distribution)

```bash
cd desktop
npm run build:win   # Windows (NSIS installer)
npm run build:mac   # macOS (DMG)
npm run build:linux # Linux (AppImage, DEB)
```

## Variables d'environnement

### Backend API
```env
PORT=3036
DATABASE_URL=postgresql://user:pass@host:5432/molam
NODE_ENV=production
```

### Web UI
```env
VITE_API_URL=http://localhost:3000
```

### Mobile
```env
API_URL=http://localhost:3000
```

### Desktop
```env
WEB_APP_URL=http://localhost:5173
NODE_ENV=development
```

## Base de données

La table `molam_legal_docs` stocke les documents légaux versionnés:

```sql
CREATE TABLE molam_legal_docs (
  id UUID PRIMARY KEY,
  type TEXT CHECK (type IN ('cgu','privacy','legal','cookies','data_protection')),
  lang TEXT CHECK (lang IN ('fr','en','wo','ar','es','pt')),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (type, lang, version)
);
```

## Intégration avec l'écosystème

Brique 36 s'intègre avec:
- **Brique 1-3** (Core ID): Authentification
- **Brique 34** (Sessions): Monitoring des sessions
- **Brique 35** (SDK Auth): Client SDKs
- **API Gateway**: Routage centralisé

## Sécurité

- JWT (RS256) pour l'authentification
- HTTPS obligatoire en production
- CSP (Content Security Policy)
- CORS configuré
- Rate limiting sur l'API Gateway
- Tokens stockés de manière sécurisée (localStorage/Keychain/KeyStore)

## Accessibilité (WCAG 2.1 Level AA)

- ♿ Navigation au clavier
- 🔊 Synthèse vocale (TTS)
- 🎨 Contraste suffisant
- 📱 Responsive design
- 🌙 Mode sombre
- 🏷️ Labels ARIA

## Support multilingue

- 🇫🇷 Français (FR)
- 🇬🇧 English (EN)
- Wolof (WO)
- 🇸🇦 العربية (AR)
- 🇪🇸 Español (ES)
- 🇵🇹 Português (PT)

## Tests

```bash
# Backend
cd api && npm test

# Web
cd web && npm test

# Mobile
cd mobile && npm test
```

## Métriques

L'API expose des métriques Prometheus sur `/metrics`:
- Requêtes HTTP par endpoint
- Latence des requêtes
- Erreurs
- Taille des réponses

## License

MIT © Molam
