# Brique 27 - Multilingue (i18n avec fallback)

## Vue d'ensemble

Brique 27 fournit une infrastructure i18n industrielle complète pour la super app Molam avec support de 5 langues (Français, English, Wolof, العربية, Español) et fallback automatique vers l'anglais.

## Objectif

Construire une infrastructure i18n industrielle pour toute la super app Molam avec :
- **5 langues supportées** : Français (fr), Anglais (en), Wolof (wo), Arabe (ar), Espagnol (es)
- **Fallback automatique** : Si une traduction n'existe pas, revient automatiquement vers l'anglais
- **Multi-plateformes** : Web, iOS, Android, HarmonyOS, Desktop
- **Centralisation** : Traductions stockées dans PostgreSQL et distribuées via API/CDN
- **SIRA** : Détection automatique de la langue selon géolocalisation et historique utilisateur
- **Admin interne** : Interface pour ajouter/mettre à jour les traductions sans redéployer l'app

## Architecture

### Stack Technique

- **Backend**: TypeScript 5.3.3, Node.js 18+, Express.js 4.18.2
- **Database**: PostgreSQL 14+ avec fonctions SQL avancées
- **SDK**: TypeScript/JavaScript universel avec fallback
- **Web**: React 18.2, TypeScript, Tailwind CSS 3.4, Vite 5.0
- **Mobile**: React Native 0.73 avec AsyncStorage
- **Desktop**: Electron (wrapping Web UI)
- **HarmonyOS**: ArkTS native avec @ohos.net.http

### Structure du Projet

```
brique-27-i18n/
├── sql/
│   └── 027_i18n.sql                          # Migration PostgreSQL
├── api/
│   ├── src/
│   │   ├── types.ts                          # Types TypeScript
│   │   ├── config.ts                         # Configuration
│   │   ├── service.ts                        # Logique métier
│   │   ├── routes.ts                         # Routes API (20 endpoints)
│   │   └── server.ts                         # Serveur Express
│   ├── package.json
│   └── tsconfig.json
├── sdk/
│   └── molam-i18n.ts                         # SDK client universel
├── web/
│   ├── src/
│   │   ├── pages/Home.tsx                    # Page d'accueil multilingue
│   │   └── components/LanguageSwitcher.tsx   # Sélecteur de langue
│   ├── package.json
│   └── vite.config.ts
├── mobile/
│   └── src/
│       ├── I18nProvider.tsx                  # Context Provider React Native
│       └── HomeScreen.tsx                    # Écran d'accueil
├── harmony/
│   └── feature/i18n/
│       ├── I18nManager.ets                   # Gestionnaire i18n HarmonyOS
│       └── HomePage.ets                      # Page d'accueil HarmonyOS
├── admin/
│   └── src/pages/
│       └── TranslationsAdmin.tsx             # Dashboard admin
├── test_structure.cjs                        # Tests de structure
└── README.md
```

## Base de Données

### Tables Principales

#### molam_translations

Table centrale pour toutes les traductions :

```sql
CREATE TABLE molam_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,              -- ex: "auth.login.title"
  lang TEXT NOT NULL CHECK (lang IN ('fr','en','wo','ar','es')),
  value TEXT NOT NULL,
  category TEXT,                  -- ex: "auth", "home", "settings"
  platform TEXT,                  -- "all", "web", "mobile", "desktop"
  notes TEXT,                     -- Contexte pour traducteurs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES molam_users(id),
  updated_by UUID REFERENCES molam_users(id),
  UNIQUE (key, lang)
);
```

#### molam_translation_cache

Cache des bundles JSON pour distribution CDN :

```sql
CREATE TABLE molam_translation_cache (
  lang TEXT PRIMARY KEY CHECK (lang IN ('fr','en','wo','ar','es')),
  bundle JSONB NOT NULL,          -- {"key1": "value1", ...}
  version TEXT NOT NULL,          -- Semantic version pour cache busting
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### molam_user_language_prefs

Préférences linguistiques utilisateur avec support SIRA :

```sql
CREATE TABLE molam_user_language_prefs (
  user_id UUID PRIMARY KEY REFERENCES molam_users(id),
  preferred_lang TEXT NOT NULL DEFAULT 'en',
  fallback_lang TEXT DEFAULT 'en',
  auto_detect BOOLEAN DEFAULT true,           -- Active SIRA
  detected_lang TEXT,
  detection_source TEXT                       -- "geo", "browser", "phone"
);
```

#### molam_translation_history

Audit trail pour toutes les modifications :

```sql
CREATE TABLE molam_translation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES molam_translations(id),
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES molam_users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### molam_translation_stats

Statistiques d'utilisation pour observabilité :

```sql
CREATE TABLE molam_translation_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lang TEXT NOT NULL,
  key TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0,            -- Alertes si > 5%
  last_requested_at TIMESTAMPTZ,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (lang, key, date)
);
```

### Fonctions SQL

#### get_translation (avec fallback)

```sql
CREATE OR REPLACE FUNCTION get_translation(
  p_key TEXT,
  p_lang TEXT,
  p_fallback_lang TEXT DEFAULT 'en'
) RETURNS TEXT
```

Récupère une traduction avec fallback automatique vers langue de secours.

#### get_translation_bundle

```sql
CREATE OR REPLACE FUNCTION get_translation_bundle(p_lang TEXT) RETURNS JSONB
```

Génère bundle JSON complet pour une langue.

#### refresh_translation_cache

```sql
CREATE OR REPLACE FUNCTION refresh_translation_cache()
RETURNS TABLE(lang TEXT, count INTEGER)
```

Régénère le cache de tous les bundles de traductions.

#### get_missing_translations

```sql
CREATE OR REPLACE FUNCTION get_missing_translations(p_lang TEXT)
RETURNS TABLE(key TEXT, reference_lang TEXT, reference_value TEXT)
```

Liste les clés manquantes pour une langue (par rapport à l'anglais).

### Traductions Préchargées

La migration inclut **200+ traductions** dans les 5 langues pour :
- **Home** : welcome, tagline
- **Auth** : login, signup, password, forgot password
- **Settings** : language, currency, save, cancel
- **Modules** : pay, eats, shop, talk, ads, free
- **Errors** : network, invalid_credentials, server_error
- **Success** : saved, login
- **Languages** : noms des langues dans chaque langue

## API Backend

### Endpoints Publics (sans auth)

#### GET /api/i18n/:lang

Récupère le bundle de traductions pour une langue.

**Réponse :**
```json
{
  "lang": "fr",
  "translations": {
    "home.welcome": "Bienvenue sur Molam",
    "auth.login.title": "Connexion",
    ...
  },
  "version": "1702901234567",
  "count": 123
}
```

#### GET /api/i18n/:lang/key/:key

Récupère une traduction unique avec fallback.

**Query Params :**
- `fallback` : Langue de fallback (défaut: en)

**Réponse :**
```json
{
  "key": "home.welcome",
  "lang": "fr",
  "value": "Bienvenue sur Molam",
  "fallback": false
}
```

#### GET /api/i18n/detect

Auto-détecte la langue utilisateur (SIRA).

**Query Params :**
- `userId` : UUID utilisateur (optionnel)
- `countryCode` : Code pays ISO (optionnel)

**Réponse :**
```json
{
  "detected_lang": "fr",
  "source": "geo"
}
```

### Endpoints Admin (require auth)

#### GET /api/admin/i18n/translations

Liste toutes les traductions avec pagination et filtres.

**Query Params :**
- `lang` : Filtre par langue
- `category` : Filtre par catégorie
- `key` : Recherche par clé (ILIKE)
- `page` : Numéro de page (défaut: 1)
- `pageSize` : Taille de page (défaut: 50)

#### POST /api/admin/i18n/translations

Crée une nouvelle traduction.

**Body :**
```json
{
  "key": "home.welcome",
  "lang": "fr",
  "value": "Bienvenue sur Molam",
  "category": "home",
  "platform": "all",
  "notes": "Message d'accueil principal"
}
```

#### PUT /api/admin/i18n/translations/:id

Met à jour une traduction existante.

#### DELETE /api/admin/i18n/translations/:id

Supprime une traduction.

#### POST /api/admin/i18n/translations/bulk

Crée/met à jour en masse.

**Body :**
```json
{
  "translations": [
    { "key": "...", "lang": "...", "value": "..." },
    ...
  ]
}
```

#### POST /api/admin/i18n/cache/refresh

Rafraîchit manuellement le cache de traductions.

#### GET /api/admin/i18n/coverage

Récupère les statistiques de couverture pour toutes les langues.

**Réponse :**
```json
{
  "coverage": [
    {
      "lang": "fr",
      "total": 120,
      "missing": 3,
      "coverage_percent": 97.50
    },
    ...
  ]
}
```

#### GET /api/admin/i18n/missing/:lang

Liste les clés manquantes pour une langue.

#### GET /api/admin/i18n/stats

Récupère les statistiques d'utilisation (observabilité).

## SDK Client (molam-i18n.ts)

### Installation

```bash
npm install @molam/i18n
```

### Utilisation

```typescript
import { MolamI18n } from '@molam/i18n';

const i18n = new MolamI18n({
  apiBaseUrl: 'https://api.molam.sn',
  defaultLanguage: 'fr',
  fallbackLanguage: 'en',
  cacheEnabled: true,
  cacheTTL: 3600000, // 1 heure
  autoDetect: true
});

// Initialiser
await i18n.init();

// Traduire
const welcome = i18n.t('home.welcome'); // "Bienvenue sur Molam"

// Avec paramètres
const greeting = i18n.t('home.greeting', { name: 'Alice' }); // "Bonjour Alice"

// Changer de langue
await i18n.changeLanguage('en');

// Pluralisation
i18n.tp('items.count', 5); // "5 items"

// Direction du texte
const dir = i18n.getTextDirection(); // 'ltr' ou 'rtl'

// Formatage
const price = i18n.formatNumber(1234.56); // "1 234,56" en français
const date = i18n.formatDate(new Date()); // "18/12/2025" en français
```

### API SDK

| Méthode | Description |
|---------|-------------|
| `init(lang?)` | Initialise le SDK avec détection auto optionnelle |
| `load(lang)` | Charge les traductions pour une langue |
| `t(key, params?)` | Traduit une clé avec fallback automatique |
| `tp(key, count, params?)` | Pluralisation |
| `has(key)` | Vérifie si une clé existe |
| `getCurrentLanguage()` | Retourne la langue actuelle |
| `changeLanguage(lang)` | Change de langue |
| `detectLanguage()` | Auto-détecte la langue (SIRA) |
| `getTextDirection()` | Retourne 'ltr' ou 'rtl' |
| `formatNumber(num)` | Formate un nombre selon la langue |
| `formatDate(date, opts?)` | Formate une date selon la langue |
| `clearCache()` | Vide le cache |

## Intégrations Multi-Plateformes

### Web (React)

```typescript
import { MolamI18n } from '@molam/i18n';
import { useState, useEffect } from 'react';

const i18n = new MolamI18n({ apiBaseUrl: 'https://api.molam.sn' });

export default function App() {
  const [t, setT] = useState<(k: string) => string>(() => (k) => k);
  const [lang, setLang] = useState<string>('fr');

  useEffect(() => {
    i18n.init().then(() => {
      setT(() => i18n.t.bind(i18n));
      setLang(i18n.getCurrentLanguage());
    });
  }, []);

  const handleLanguageChange = async (newLang: string) => {
    await i18n.changeLanguage(newLang as any);
    setT(() => i18n.t.bind(i18n));
    setLang(i18n.getCurrentLanguage());
  };

  return (
    <div>
      <h1>{t('home.welcome')}</h1>
      <select value={lang} onChange={(e) => handleLanguageChange(e.target.value)}>
        <option value="fr">Français</option>
        <option value="en">English</option>
        <option value="wo">Wolof</option>
        <option value="ar">العربية</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
}
```

### Mobile (React Native)

```typescript
import { I18nProvider, useI18n } from '@molam/i18n-mobile';

// Dans App.tsx
export default function App() {
  return (
    <I18nProvider>
      <HomeScreen />
    </I18nProvider>
  );
}

// Dans composant
function HomeScreen() {
  const { t, lang, changeLanguage } = useI18n();

  return (
    <View>
      <Text>{t('home.welcome')}</Text>
      <Button title="Change to English" onPress={() => changeLanguage('en')} />
    </View>
  );
}
```

### HarmonyOS (ArkTS)

```typescript
import { I18nManager } from './I18nManager';

@Entry
@Component
struct HomePage {
  private i18n: I18nManager = new I18nManager('https://api.molam.sn');

  aboutToAppear() {
    this.i18n.init(getContext(this));
  }

  build() {
    Column() {
      Text(this.i18n.t('home.welcome'))
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
    }
  }
}
```

## Admin Dashboard

### Accès

```
http://localhost:5173/admin
```

### Fonctionnalités

1. **Liste des traductions**
   - Filtres par langue, catégorie, clé
   - Pagination
   - Recherche en temps réel

2. **Ajouter une traduction**
   - Formulaire avec validation
   - Support notes pour traducteurs
   - Création sans redéploiement

3. **Couverture**
   - Pourcentage de traduction par langue
   - Nombre de clés manquantes
   - Barre de progression visuelle

4. **Clés manquantes**
   - Liste par langue
   - Référence anglaise
   - Export possible

5. **Rafraîchir le cache**
   - Bouton pour régénération manuelle
   - Automatique après chaque modification

## SIRA - Détection Automatique

### Priorités de détection

1. **Historique utilisateur** : Langue sauvegardée dans préférences
2. **Géolocalisation** : Mapping pays → langue
   - SN, ML, CI → fr
   - MA, TN, DZ → ar
   - ES, MX, AR → es
   - US, GB → en
3. **Navigateur** : Header Accept-Language
4. **Défaut** : en

### Mapping Géographique

| Pays | Code | Langue |
|------|------|--------|
| Sénégal | SN | fr |
| Mali | ML | fr |
| Côte d'Ivoire | CI | fr |
| Maroc | MA | ar |
| Tunisie | TN | ar |
| Algérie | DZ | ar |
| Espagne | ES | es |
| Mexique | MX | es |
| Argentine | AR | es |
| États-Unis | US | en |
| Royaume-Uni | GB | en |

## Observabilité

### Métriques Prometheus

```
# Requêtes i18n par langue
i18n_requests_total{lang="fr"} 1234

# Clés manquantes par langue
i18n_missing_keys_total{lang="wo"} 15

# Temps de réponse API
http_request_duration_seconds{endpoint="/api/i18n/:lang"} 0.045
```

### Alertes

```yaml
- alert: HighMissingTranslationRate
  expr: (i18n_missing_keys_total / i18n_requests_total) > 0.05
  for: 5m
  annotations:
    summary: "Plus de 5% de clés manquantes pour {{ $labels.lang }}"
```

## Déploiement

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- Redis (optionnel, pour caching API)

### Installation

1. **Base de données**
   ```bash
   psql -U postgres -d molam_db -f sql/027_i18n.sql
   ```

2. **Backend API**
   ```bash
   cd api
   npm install
   cp .env.example .env
   # Configurer DATABASE_URL
   npm run build
   npm start
   ```

3. **Web UI**
   ```bash
   cd web
   npm install
   cp .env.example .env
   # Configurer VITE_API_BASE_URL
   npm run build
   ```

### Variables d'environnement

**Backend (api/.env)**
```env
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/molam_db
CORS_ORIGIN=http://localhost:5173
ENABLE_METRICS=true
```

**Web (web/.env)**
```env
VITE_API_BASE_URL=http://localhost:3000
```

## Tests

### Tests de structure

```bash
cd brique-27-i18n
node test_structure.cjs
```

**Résultat** : 31/31 tests réussis (100%)

### Tests couverts

- ✅ SQL migration (tables, fonctions, traductions préchargées)
- ✅ Backend API (types, services, routes, server)
- ✅ SDK (classe, fallback, cache, détection)
- ✅ Web UI (pages, composants, config)
- ✅ Mobile (Provider, hooks, screens)
- ✅ HarmonyOS (Manager, pages)
- ✅ Admin dashboard (CRUD, couverture, missing)

## Sécurité

### Contrôle d'accès

- **Endpoints publics** : Lecture seule des traductions
- **Endpoints admin** : Authentification JWT requise
- **Audit trail** : Toutes modifications → molam_translation_history

### Validation

- Clés en format `module.screen.element`
- Langues limitées à : fr, en, wo, ar, es
- Sanitization des valeurs (XSS protection)

### Rate Limiting

```typescript
// 100 requêtes par minute par IP
app.use(rateLimit({
  windowMs: 60000,
  max: 100
}));
```

## Performance

### Caching

- **PostgreSQL** : Table molam_translation_cache
- **API** : Cache mémoire avec TTL 1h
- **Client** : Cache localStorage/AsyncStorage
- **CDN** : Distribution bundles JSON

### Optimisations

- Index sur `lang`, `key`, `category`
- Bundles JSON précompilés
- Lazy loading des langues
- Compression gzip/brotli

## Roadmap

### Phase 1 (Actuelle) ✅
- 5 langues supportées
- Fallback automatique
- Multi-plateformes (Web, Mobile, HarmonyOS)
- Admin dashboard
- SIRA détection basique

### Phase 2 (À venir)
- Import/Export CSV/Excel
- Validation par traducteurs professionnels
- Workflow d'approbation
- Contexte visuel (screenshots) pour traducteurs
- API de suggestions (ML-based)

### Phase 3 (Futur)
- Support RTL avancé (mise en page)
- Traduction automatique (Google Translate API)
- Gestion de glossaire
- Intégration Crowdin/Lokalise
- Traductions spécifiques par région (fr-SN vs fr-FR)

## Support & Documentation

- **API Reference** : Swagger disponible à `/api/docs`
- **Guide d'intégration** : Voir exemples ci-dessus
- **Contact** : i18n@molam.sn

## Licence

Propriétaire - Molam SN © 2025
