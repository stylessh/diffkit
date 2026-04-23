# @diffkit/search

Self-hosted search control/data-plane service for DiffKit.

This app is meant to run privately (VPS/container host) and is called by the Cloudflare Worker.

Endpoints:

- `GET /healthz`
- `GET /api/v1/search`
- `POST /internal/repos/sync`
- `POST /internal/index/build`

## What runs where

- `apps/dashboard` (Cloudflare Worker): public API, auth, orchestration.
- `apps/search` (your VPS): sync/index control and Livegrep query bridge.
- Livegrep (your VPS): actual code search backend/frontend.

## Livegrep Docker images (official)

Livegrep publishes images to GHCR:

- `ghcr.io/livegrep/livegrep/indexer`
- `ghcr.io/livegrep/livegrep/base`

The stack here uses those images directly.

## VPS deployment (copy/paste)

### 1) Prepare directories

```bash
mkdir -p /opt/diffkit-search
cd /opt/diffkit-search
mkdir -p livegrep-data search-data
```

### 2) Build a Livegrep index (example: this repo)

```bash
docker run --rm \
  -v "/opt/diffkit-search/livegrep-data:/data" \
  ghcr.io/livegrep/livegrep/indexer \
  /livegrep/bin/livegrep-github-reindex \
  -repo stylessh/diffkit \
  -http \
  -dir /data
```

This creates `/opt/diffkit-search/livegrep-data/livegrep.idx`.

### 3) Start Livegrep backend + frontend

```bash
docker network create diffkit-search || true

docker run -d --rm \
  --name livegrep-backend \
  --network diffkit-search \
  -v "/opt/diffkit-search/livegrep-data:/data" \
  ghcr.io/livegrep/livegrep/base \
  /livegrep/bin/codesearch -load_index /data/livegrep.idx -grpc 0.0.0.0:9999

docker run -d --rm \
  --name livegrep-frontend \
  --network diffkit-search \
  -p 8911:8911 \
  ghcr.io/livegrep/livegrep/base \
  /livegrep/bin/livegrep -docroot /livegrep/web -listen 0.0.0.0:8911 --connect livegrep-backend:9999
```

### 4) Build and run `apps/search`

From repo root:

```bash
docker build -f apps/search/Dockerfile -t diffkit-search:latest .
```

Run:

```bash
docker run -d --rm \
  --name diffkit-search \
  --network diffkit-search \
  -p 8910:8910 \
  -e SEARCH_CONTROL_TOKEN=change-me \
  -e LIVEGREP_UPSTREAM_BASE_URL=http://livegrep-frontend:8911 \
  -e LIVEGREP_SEARCH_PATH=/api/v1/search \
  -e SEARCH_STORAGE_ROOT=/var/lib/diffkit-search \
  -v "/opt/diffkit-search/search-data:/var/lib/diffkit-search" \
  diffkit-search:latest
```

### 5) Point Worker to this service

Set these Worker vars to your VPS private/public URL:

- `LIVEGREP_BASE_URL=https://<your-search-host>:8910`
- `SEARCH_CONTROL_BASE_URL=https://<your-search-host>:8910`
- `SEARCH_CONTROL_TOKEN=change-me`

## Local testing

### Fast local stack

You can use `apps/search/docker-compose.livegrep.yml`:

1. Build initial index:
```bash
./apps/search/scripts/bootstrap-livegrep-index.sh stylessh/diffkit
```
2. Start services:
```bash
docker compose -f apps/search/docker-compose.livegrep.yml up --build -d
```

This starts:

- `apps/search` at `http://localhost:8910`
- Livegrep frontend at `http://localhost:8911`

### Smoke tests

Health:

```bash
curl -s http://localhost:8910/healthz | jq
```

Search via `apps/search`:

```bash
curl -sG http://localhost:8910/api/v1/search \
  --data-urlencode "q=createServer" \
  --data-urlencode "repo=stylessh/diffkit" | jq
```

Internal sync (token required):

```bash
curl -sX POST http://localhost:8910/internal/repos/sync \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id":"stylessh/diffkit",
    "provider":"github",
    "owner":"stylessh",
    "name":"diffkit",
    "default_branch":"main"
  }' | jq
```

Internal index build:

```bash
curl -sX POST http://localhost:8910/internal/index/build \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_id":"stylessh/diffkit",
    "owner":"stylessh",
    "name":"diffkit",
    "default_branch":"main"
  }' | jq
```

## Notes

- The index build in `src/index-build.ts` is intentionally an MVP placeholder.
- Replace placeholder steps with your production Livegrep index publish/swap flow.
- Keep this service private behind firewall / private networking / Cloudflare Access.
