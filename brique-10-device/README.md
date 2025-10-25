# Brique 10 - Device Fingerprint & Session Binding

## 🎯 Objectif

Établir un **device_id fiable et privacy-first** pour lier les sessions Molam à un appareil et durcir les opérations sensibles.

## 🏗️ Architecture

### Tables PostgreSQL

1. **molam_devices** - Stockage des empreintes d'appareils (hachées)
2. **molam_device_bindings** - Liaison utilisateur ↔ appareil
3. **molam_device_attestations** - Preuves d'intégrité (Play Integrity, DeviceCheck, WebAuthn)
4. **molam_device_events** - Audit immuable des événements

### Service API

**Port**: 8083
**Base URL**: `/v1/device`

#### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Enregistrer un nouvel appareil | No |
| POST | `/bind` | Lier l'appareil à l'utilisateur | JWT |
| POST | `/verify` | Vérifier et step-up trust | JWT |
| GET | `/list` | Lister les appareils de l'utilisateur | JWT |
| POST | `/revoke` | Révoquer la liaison | JWT |

## 🔐 Sécurité & Privacy

- **Aucun identifiant brut stocké** (IMEI, IDFV, Android ID) - seulement hash salé
- **Attestations côté serveur** (Google/Apple/WebAuthn)
- **Trust levels**: unknown → low → medium → high → blocked
- **Audit immuable** de tous les événements

## 📦 Installation

```bash
cd brique-10-device
npm install
```

## 🗄️ Configuration Base de Données

```bash
# Appliquer le schéma
psql -U molam -d molam -f sql/010_device.sql
```

## 🚀 Démarrage

```bash
# Production
npm start

# Développement
npm run dev
```

**Variables d'environnement requises**:

```env
DATABASE_URL=postgres://molam:molam_pass@localhost:5432/molam
DEVICE_HASH_PEPPER=<secret-pepper-from-hsm>
JWT_SECRET=<jwt-secret-key>
PORT=8083
CORS_ORIGIN=https://molam.com
```

## 🧪 Tests

```bash
# Test E2E simple
node test_brique10.js

# Tests Jest
npm test
```

## 📱 Intégrations Client

### Web (JavaScript)

```javascript
// 1. Collecter l'empreinte
const fp = {
  platform: 'web',
  web_uid: localStorage.getItem('molam_web_uid') || crypto.randomUUID(),
  screen: `${screen.width}x${screen.height}`,
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale: navigator.language
};

// 2. Enregistrer l'appareil
const { device_pk } = await fetch('/v1/device/register', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ fingerprint: fp, platform: 'web', model: 'Chrome', os_name: 'Web' })
}).then(r => r.json());

// 3. Lier à l'utilisateur (après login)
await fetch('/v1/device/bind', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userJWT}`
  },
  body: JSON.stringify({ device_pk })
});
```

### Android (Kotlin - avec Play Integrity)

```kotlin
// 1. Collecter empreinte
val fp = mapOf(
  "platform" to "android",
  "model" to Build.MODEL,
  "os_name" to "Android",
  "os_version" to Build.VERSION.RELEASE,
  "android_adid" to getAdvertisingId(),
  "screen" to "${metrics.widthPixels}x${metrics.heightPixels}"
)

// 2. Enregistrer
val devicePk = registerDevice(fp)

// 3. Obtenir Play Integrity token
val nonce = UUID.randomUUID().toString()
val token = requestPlayIntegrityToken(nonce)

// 4. Lier avec attestation
bindDevice(devicePk, token, nonce)
```

### iOS (Swift - avec DeviceCheck)

```swift
// 1. Collecter empreinte
let fp = [
  "platform": "ios",
  "model": UIDevice.current.model,
  "os_name": "iOS",
  "os_version": UIDevice.current.systemVersion,
  "idfv": UIDevice.current.identifierForVendor?.uuidString
]

// 2. Enregistrer & lier avec DeviceCheck
let devicePk = await registerDevice(fp)
let token = await generateDeviceCheckToken()
await bindDevice(devicePk, token: token)
```

## 🔗 Intégrations avec autres briques

### Brique 3 - AuthZ
Injecter `device_pk`, `device_trust` dans le contexte d'autorisation:

```javascript
// Exemple de politique
if (action === 'transfer' && amount > 50000 && device_trust < 'medium') {
  return { decision: 'deny', reason: 'device_trust_insufficient' };
}
```

### Brique 5 - Sessions
Lier `refresh_token` ↔ `device_pk`:

```sql
ALTER TABLE molam_sessions ADD COLUMN device_pk UUID REFERENCES molam_devices(device_pk);
```

### Brique 11 - 2FA (future)
Step-up MFA conditionnel si nouveau device:

```javascript
if (isNewDevice(device_pk, user_id)) {
  return { require_2fa: true };
}
```

## 📊 Métriques (Prometheus)

```
device_register_total{platform="web|android|ios|feature"}
device_bind_total{trust="unknown|low|medium|high"}
device_attest_pass_total{vendor="play_integrity|devicecheck|webauthn"}
device_attest_fail_total{vendor}
device_revoke_total
```

## 🛡️ Conformité RGPD

- **Minimisation**: Seul le hash de l'empreinte est stocké
- **Finalité**: Sécurité, prévention fraude
- **Conservation**: 90 jours après révocation
- **Export**: API `/v1/device/list` retourne la liste des appareils sans IDs bruts
- **Suppression**: Révocation via `/v1/device/revoke`

## 📈 Roadmap

- [ ] Intégration Play Integrity API réelle
- [ ] Intégration DeviceCheck API réelle
- [ ] WebAuthn verification complète
- [ ] Détection root/jailbreak
- [ ] Anomaly detection (géolocalisation, vitesse impossible)
- [ ] Device risk scoring

## 📝 License

MIT
