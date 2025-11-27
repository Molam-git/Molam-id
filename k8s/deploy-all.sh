#!/bin/bash
set -e

echo "🚀 Déploiement de Molam ID sur Kubernetes"
echo ""

cd "$(dirname "$0")"

kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f postgres-pvc.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-service.yaml

echo "⏳ Attente de PostgreSQL..."
kubectl wait --for=condition=ready pod -l app=postgres -n molam-id --timeout=120s

kubectl apply -f api-deployment.yaml
kubectl apply -f api-service.yaml
kubectl apply -f web-deployment.yaml
kubectl apply -f web-service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f api-hpa.yaml

echo ""
echo "✅ Déploiement terminé !"
echo ""
kubectl get pods -n molam-id
