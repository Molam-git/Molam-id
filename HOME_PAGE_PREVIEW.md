# Page d'accueil Molam-ID - Aperçu

## 🌐 URL: http://localhost:3000/

## 🎨 Design

La page d'accueil affiche maintenant une **interface visuelle élégante** au lieu du JSON brut:

### Caractéristiques visuelles:

1. **Background gradient** violet/bleu (moderne)
2. **Carte blanche centrée** avec ombre portée
3. **Logo rocket** 🚀 en haut
4. **Titre** "Molam-ID Core" avec badge de version
5. **Indicateur de statut** vert avec animation pulsante
6. **Sections d'information**:
   - Environnement (development)
   - Timestamp en temps réel
   - Badges des 6 briques avec gradient
7. **Liens vers la documentation** (Health Check, Healthz, Metrics)

### Responsive Design

- ✅ Mobile-friendly
- ✅ Tablette-friendly
- ✅ Desktop-optimized

### Informations affichées:

```
🚀 Molam-ID Core v1.0.0

● Service opérationnel

ENVIRONNEMENT
development

TIMESTAMP
2025-10-31T21:21:46.017Z

BRIQUES INTÉGRÉES (6)
[1-Auth] [2-Sessions] [3-JWT] [4-Onboarding] [5-LoginV2] [6-AuthZ]

API Documentation
Health Check → | Healthz → | Metrics →
```

## 📱 API Mode

Si vous appelez l'endpoint via curl ou en API (avec header `Accept: application/json`), vous recevrez toujours le JSON:

```bash
curl -H "Accept: application/json" http://localhost:3000/
```

Résultat:
```json
{
  "service": "Molam-ID Core",
  "version": "1.0.0",
  "status": "running",
  "briques": [
    "1-Auth",
    "2-Sessions",
    "3-JWT",
    "4-Onboarding",
    "5-LoginV2",
    "6-AuthZ"
  ],
  "timestamp": "2025-10-31T21:21:46.017Z",
  "environment": "development"
}
```

## 🎯 Fonctionnalités

### Détection automatique du type de client

Le serveur détecte automatiquement:
- **Navigateur web** → Affiche la page HTML élégante
- **API client** (curl, Postman, SDK) → Retourne le JSON

### Informations en temps réel

- Timestamp mis à jour à chaque requête
- Statut du service en direct
- Liste des briques disponibles

### Navigation rapide

Liens directs vers:
- `/api/health` - Health check legacy
- `/healthz` - Kubernetes health check
- `/metrics` - Métriques Prometheus

## 🖼️ Couleurs utilisées

- **Primary**: `#667eea` (violet)
- **Secondary**: `#764ba2` (violet foncé)
- **Success**: `#22c55e` (vert)
- **Background**: Gradient `#667eea → #764ba2`
- **Text**: `#111827` (noir doux)
- **Muted**: `#6b7280` (gris)

## 🚀 Pour tester

1. Ouvrez votre navigateur
2. Allez sur: **http://localhost:3000/**
3. Vous verrez la belle page d'accueil!

## 📸 Aperçu du code HTML

La page génère dynamiquement:
- Badges colorés pour chaque brique
- Timestamp en temps réel
- Animation du point de statut (pulse)
- Design responsive pour tous les écrans

---

**La page est maintenant production-ready et visually appealing!** 🎨
