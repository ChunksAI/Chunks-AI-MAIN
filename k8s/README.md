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
                                       redis-sentinel:26379  ← 3-pod Deployment
                                                │  (discovers & monitors master)
                                        ┌───────┴────────┐
                                  redis-master:6379    redis-replica:6379 ×2
                                  (StatefulSet, 1)     (StatefulSet, 2)
                                        │
                                   worker (RQ, HPA 1–10 pods)
```

All pods in the `chunks` namespace.  The `api` and `worker` deployments share
the same container image (`chunks-api`); the worker runs `python worker.py`
which connects via the Sentinel-aware `build_redis_client()` factory.

### Redis Sentinel HA

`redis.yaml` deploys a Sentinel cluster instead of a single Redis instance:

| Component | Pods | Role |
|-----------|------|------|
| `redis-master` | 1 | Accepts all writes; AOF persistence |
| `redis-replica` | 2 | Read replicas; promoted to master on failover |
| `redis-sentinel` | 3 | Monitors master, orchestrates automatic failover |

**Failover behaviour:**  If the master pod becomes unreachable for 5 seconds,
2 of the 3 sentinels agree to promote a replica.  The sentinels notify all
connected clients (api + worker pods) to reconnect to the new master.  The
`redis-py` `SentinelConnectionPool` handles this transparently — no restarts
needed.

**Environment variables** used by api and worker pods:
```
REDIS_SENTINEL_HOSTS = redis-sentinel:26379
REDIS_MASTER_NAME    = mymaster
```

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

# 3. Redis HA (master → replicas → sentinels — order matters)
kubectl apply -f k8s/redis.yaml
# Wait for master to be ready before replicas start replicating.
kubectl rollout status statefulset/redis-master -n chunks
kubectl rollout status statefulset/redis-replica -n chunks
kubectl rollout status deployment/redis-sentinel -n chunks

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

The `slowapi` rate limiter (`backend/routes/limiter.py`) uses the Sentinel
cluster as its counter store (`redis+sentinel://redis-sentinel:26379/mymaster`).
This ensures all API replicas share the same counters.  On master failover the
`limits` library reconnects to the new master and counter state is preserved
(the replica already has the same data via replication).

## Monitoring Redis Sentinel

```bash
# Check which node is the current master
kubectl exec -n chunks deploy/redis-sentinel -- \
  redis-cli -p 26379 sentinel get-master-addr-by-name mymaster

# List all sentinels (expect 3)
kubectl exec -n chunks deploy/redis-sentinel -- \
  redis-cli -p 26379 sentinel sentinels mymaster

# Check replication status on master
kubectl exec -n chunks statefulset/redis-master -- \
  redis-cli info replication

# Watch for failover events
kubectl logs -n chunks -l app=redis-sentinel --follow
```

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
    - type: redis-sentinel
      metadata:
        sentinelAddress: redis-sentinel.chunks.svc.cluster.local:26379
        masterName: mymaster
        listName: rq:queue:default
        listLength: "5"   # 1 worker per 5 queued jobs
```
