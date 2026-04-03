# Chunks AI — Kubernetes Deployment Guide

This directory contains Kubernetes manifests for running Chunks AI on any
Kubernetes cluster (Amazon EKS, Google GKE, Azure AKS, self-hosted k3s, etc.).

## Architecture

```
Browser
  │
  ▼
nginx Ingress (LoadBalancer)
  ├── chunks.online / www.chunks.online  →  frontend  (nginx, HPA 2–10 pods)
  └── api.chunks.online                 →  api        (gunicorn/uvicorn, HPA 2–20 pods)
                                                │
                                        redis:6379 (StatefulSet)
                                                │
                                          worker  (RQ, HPA 1–10 pods)
```

All pods in the `chunks` namespace.  The `api` and `worker` deployments share
the same container image (`chunks-api`); the worker overrides `CMD` to run
`rq worker` instead of gunicorn.

## Prerequisites

| Component | Version | Install |
|-----------|---------|---------|
| Kubernetes | ≥ 1.23 | — |
| kubectl | any | — |
| metrics-server | latest | see below |
| nginx Ingress Controller | latest | see below |
| cert-manager | ≥ 1.12 | see below |

### Install prerequisites

```bash
# metrics-server (required for HPA CPU/memory metrics)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# nginx Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# cert-manager (Let's Encrypt TLS)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

After cert-manager is ready, create the ClusterIssuer (replace the email):

```bash
kubectl apply -f - <<'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

## Build and push images

Replace `YOUR_REGISTRY` with your registry prefix (e.g.
`ghcr.io/chunksai`, `123456789.dkr.ecr.us-east-1.amazonaws.com`):

```bash
REGISTRY=YOUR_REGISTRY

docker build -t $REGISTRY/chunks-api:latest ./backend
docker build -t $REGISTRY/chunks-frontend:latest .
docker push $REGISTRY/chunks-api:latest
docker push $REGISTRY/chunks-frontend:latest

# Update image references in the manifests
sed -i "s|YOUR_REGISTRY|$REGISTRY|g" k8s/api.yaml k8s/worker.yaml k8s/frontend.yaml
```

## Configure secrets

The `k8s/secret.yaml` file contains placeholder values.  **Never commit real
credentials.**  Use one of these methods:

**Option A — from `.env` file (recommended):**
```bash
kubectl create secret generic chunks-api-secret \
  --from-env-file=.env \
  --namespace=chunks \
  --dry-run=client -o yaml | kubectl apply -f -
```

**Option B — external secrets operator** (Vault, AWS Secrets Manager, GCP
Secret Manager):
See https://external-secrets.io for setup instructions.

## Deploy

```bash
# 1. Namespace first
kubectl apply -f k8s/namespace.yaml

# 2. Config and secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml   # or use option A/B above

# 3. Redis
kubectl apply -f k8s/redis.yaml
kubectl rollout status statefulset/redis -n chunks

# 4. API + worker
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/worker.yaml
kubectl rollout status deployment/api -n chunks

# 5. Frontend
kubectl apply -f k8s/frontend.yaml
kubectl rollout status deployment/frontend -n chunks

# 6. Ingress (update DNS first — see k8s/ingress.yaml header)
kubectl apply -f k8s/ingress.yaml
```

Or apply everything at once:
```bash
kubectl apply -f k8s/
```

## Monitor auto-scaling

```bash
# Watch HPA status in real time
kubectl get hpa -n chunks -w

# Current pod counts
kubectl get pods -n chunks

# HPA events (scale-out/in decisions)
kubectl describe hpa api -n chunks
kubectl describe hpa worker -n chunks
kubectl describe hpa frontend -n chunks

# Resource usage per pod
kubectl top pods -n chunks
```

## Scaling behaviour summary

| Service | Min pods | Max pods | Scale-out trigger | Scale-in delay |
|---------|----------|----------|-------------------|----------------|
| api | 2 | 20 | CPU > 60% or MEM > 75% | 5 min |
| worker | 1 | 10 | CPU > 70% | 10 min |
| frontend | 2 | 10 | CPU > 70% | 5 min |

The longer scale-in delays prevent flapping.  Worker scale-in is especially
conservative because RQ workers must finish their current job before exiting
(`terminationGracePeriodSeconds: 300`).

## Rate limiting across replicas

The `slowapi` rate limiter (`backend/routes/limiter.py`) uses Redis as its
counter store when `REDIS_URL` is set.  This ensures all replicas share the
same rate-limit counters; without Redis each pod would have an independent
counter and limits would effectively be multiplied by the pod count.

## Queue-depth scaling for workers (advanced)

For precise worker scaling based on actual RQ queue depth (scale to 0 when
empty, spin up instantly on job arrival), consider KEDA:

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda --namespace keda --create-namespace
```

Then replace `k8s/worker.yaml` HPA with a KEDA `ScaledObject`:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker
  namespace: chunks
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 0   # scale to zero when queue is empty
  maxReplicaCount: 10
  triggers:
    - type: redis
      metadata:
        address: redis.chunks.svc.cluster.local:6379
        listName: rq:queue:default
        listLength: "5"   # 1 worker per 5 queued jobs
```
