# Kubernetes - Molam ID

Manifests Kubernetes pour déployer Molam ID.

## Déploiement rapide

```bash
# Option 1: Script automatique
./deploy-all.sh

# Option 2: Manuel
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f postgres-pvc.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-service.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n molam-id --timeout=120s
kubectl apply -f api-deployment.yaml
kubectl apply -f api-service.yaml
kubectl apply -f web-deployment.yaml
kubectl apply -f web-service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f api-hpa.yaml
```

## Fichiers

- `namespace.yaml` - Namespace molam-id
- `configmap.yaml` - Variables d'environnement
- `secrets.yaml` - Secrets (DB password, JWT, etc.)
- `postgres-pvc.yaml` - Stockage PostgreSQL (10Gi)
- `postgres-deployment.yaml` - Deployment PostgreSQL
- `postgres-service.yaml` - Service PostgreSQL
- `api-deployment.yaml` - Deployment API (2-10 replicas HPA)
- `api-service.yaml` - Service API
- `web-deployment.yaml` - Deployment Web UI (2-10 replicas HPA)
- `web-service.yaml` - Service Web UI
- `ingress.yaml` - Ingress (id.molam.io, api-id.molam.io)
- `api-hpa.yaml` - Autoscaling API

## Commandes utiles

```bash
# Status
kubectl get pods -n molam-id
kubectl get svc -n molam-id
kubectl get ingress -n molam-id
kubectl get hpa -n molam-id

# Logs
kubectl logs -f deployment/molam-id-api -n molam-id
kubectl logs -f deployment/molam-id-web -n molam-id

# Port-forward (test local)
kubectl port-forward svc/molam-id-api-service 3000:3000 -n molam-id
kubectl port-forward svc/molam-id-web-service 8080:80 -n molam-id

# Supprimer
kubectl delete namespace molam-id
```

## Avant de déployer

1. **Modifier les secrets** dans `secrets.yaml`
2. **Mettre à jour les images** dans `api-deployment.yaml` et `web-deployment.yaml`
3. **Configurer les domaines** dans `ingress.yaml`
4. **Ajuster les ConfigMaps** dans `configmap.yaml`

Voir le guide complet: [KUBERNETES_DEPLOYMENT_GUIDE.md](../../KUBERNETES_DEPLOYMENT_GUIDE.md)
