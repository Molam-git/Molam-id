# 🔗 Configuration de l'API Mobile

## ⚠️ IMPORTANT - À faire AVANT de lancer l'app

Pour que votre téléphone puisse communiquer avec le backend sur votre PC, vous devez configurer l'URL de l'API.

## 📝 Étapes

### 1. Trouver votre IP locale

Ouvrez un terminal et tapez :

```bash
ipconfig
```

Cherchez **"IPv4 Address"** dans la section de votre connexion WiFi/Ethernet.

Exemple : `192.168.1.100`

### 2. Modifier le fichier .env

Ouvrez le fichier `brique-36-ui-id/mobile/.env` et remplacez l'IP :

```env
EXPO_PUBLIC_API_URL=http://VOTRE_IP:3000
```

**Exemple :**
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### 3. Alternative : Modifier directement le fichier de config

Si le fichier `.env` ne marche pas, modifiez directement :

**Fichier:** `brique-36-ui-id/mobile/src/config/api.ts`

```typescript
// Ligne 17 - Remplacez par VOTRE IP
return 'http://192.168.1.100:3000';
```

## ✅ Vérification

1. Démarrez le backend :
   ```bash
   npm start
   ```

2. Depuis votre téléphone, ouvrez le navigateur et allez sur :
   ```
   http://VOTRE_IP:3000
   ```

3. Vous devriez voir la page d'accueil Molam-ID ✨

4. Si ça marche, lancez l'app mobile :
   ```bash
   cd brique-36-ui-id/mobile
   npx expo start
   ```

## 🔥 Pare-feu Windows

Si votre téléphone ne peut pas accéder au backend, autorisez Node.js dans le pare-feu :

1. Ouvrez **Pare-feu Windows Defender**
2. Cliquez sur **Autoriser une application**
3. Cherchez **Node.js**
4. Cochez les cases **Privé** et **Public**

## 📱 Résumé

```
PC (Backend)          →   http://192.168.1.100:3000
     ↓
Même WiFi
     ↓
Téléphone (App)       →   Appelle http://192.168.1.100:3000
```

**Les deux doivent être sur le même réseau WiFi !**

---

💡 **Astuce :** Si vous changez de réseau WiFi, vous devrez peut-être mettre à jour l'IP dans le fichier `.env`.
