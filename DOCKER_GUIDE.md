# Guide de démarrage Docker - MOLAM-ID

Ce guide explique comment builder et exécuter MOLAM-ID dans des conteneurs Docker.

## Prérequis

- Docker installé ([Docker Desktop](https://www.docker.com/products/docker-desktop/) pour Windows/Mac)
- Docker Compose (inclus avec Docker Desktop)

## Démarrage rapide

### Windows

Double-cliquez sur le fichier :
```
run-molam-docker.bat
```

Ou en ligne de commande :
```bash
cd Molam-id
.\run-molam-docker.bat
```

### Linux/Mac

Rendez le script exécutable et lancez-le :
```bash
cd Molam-id
chmod +x run-molam-docker.sh
./run-molam-docker.sh
```

## Ce qui est démarré

Le script `run-molam-docker` démarre automatiquement **3 services** :

1. **PostgreSQL** (Base de données)
   - Port : `5433` (externe) → `5432` (interne)
   - User : `molam`
   - Password : `molam_pass`
   - Database : `molam`
   - Note: Port 5433 utilisé pour éviter conflit avec PostgreSQL local

2. **Backend API** (Node.js/Express)
   - Port : `3000`
   - URL : http://localhost:3000

3. **Web UI** (React/Vite)
   - Port : `5173`
   - URL : http://localhost:5173

## Commandes Docker manuelles

### 1. Build des images

```bash
cd Molam-id
docker-compose -f docker-compose.full.yml build
```

### 2. Démarrer tous les services

```bash
docker-compose -f docker-compose.full.yml up -d
```

L'option `-d` permet de lancer les conteneurs en arrière-plan (detached mode).

### 3. Voir les logs

Tous les services :
```bash
docker-compose -f docker-compose.full.yml logs -f
```

Un service spécifique :
```bash
docker-compose -f docker-compose.full.yml logs -f api
docker-compose -f docker-compose.full.yml logs -f web
docker-compose -f docker-compose.full.yml logs -f db
```

### 4. Arrêter les services

```bash
docker-compose -f docker-compose.full.yml down
```

### 5. Arrêter et supprimer les volumes (réinitialisation complète)

```bash
docker-compose -f docker-compose.full.yml down -v
```

⚠️ **Attention** : Cette commande supprime la base de données !

### 6. Rebuild après modification du code

Si vous modifiez le code, vous devez rebuilder les images :

```bash
docker-compose -f docker-compose.full.yml down
docker-compose -f docker-compose.full.yml build
docker-compose -f docker-compose.full.yml up -d
```

Ou en une seule commande :
```bash
docker-compose -f docker-compose.full.yml up -d --build
```

## Vérifier que tout fonctionne

### 1. Vérifier les conteneurs actifs

```bash
docker ps
```

Vous devriez voir 3 conteneurs :
- `molam_db` (postgres:15)
- `molam_api` (molam-id_api)
- `molam_web` (molam-id_web)

### 2. Tester l'API

```bash
curl http://localhost:3000/health
```

### 3. Tester le Web UI

Ouvrez votre navigateur : http://localhost:5173

## Variables d'environnement

Pour personnaliser les secrets JWT, créez un fichier `.env` dans `Molam-id/` :

```env
JWT_SECRET=votre_secret_personnalise
JWT_REFRESH_SECRET=votre_refresh_secret_personnalise
```

Puis redémarrez les services :
```bash
docker-compose -f docker-compose.full.yml down
docker-compose -f docker-compose.full.yml up -d
```

## Dépannage

### Port déjà utilisé

Si vous avez l'erreur "port already allocated" :

1. Arrêtez les processus qui utilisent les ports 3000, 5173 ou 5433
2. Ou modifiez les ports dans `docker-compose.full.yml`

### Problème de build

Si le build échoue :

1. Nettoyez Docker :
```bash
docker system prune -a
```

2. Retentez le build :
```bash
docker-compose -f docker-compose.full.yml build --no-cache
```

### La base de données ne démarre pas

Vérifiez les logs :
```bash
docker-compose -f docker-compose.full.yml logs db
```

### Accéder à la base de données

Depuis votre machine :
```bash
psql -h localhost -p 5433 -U molam -d molam
```

Ou avec Docker :
```bash
docker exec -it molam_db psql -U molam -d molam
```

## Différences avec START_ALL.bat

| Aspect | START_ALL.bat | Docker |
|--------|---------------|--------|
| Installation Node.js | Requise | Non requise |
| Installation dépendances | npm install manuel | Automatique dans l'image |
| Base de données | Installation externe | Conteneur PostgreSQL |
| Isolation | Non | Oui (conteneurs isolés) |
| Portabilité | Windows uniquement | Multi-plateforme |
| Production-ready | Non | Oui |

## Arrêt complet

Pour tout arrêter et nettoyer :

```bash
docker-compose -f docker-compose.full.yml down -v
docker system prune -f
```

## Support

Pour plus d'informations :
- Docker : https://docs.docker.com/
- Docker Compose : https://docs.docker.com/compose/
