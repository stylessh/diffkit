# @diffkit/search

Self-hosted search control/data-plane service for DiffKit, intended to run on your VPS.

It exposes the endpoints expected by the Cloudflare Worker:

- `GET /healthz`
- `GET /api/v1/search`
- `POST /internal/repos/sync`
- `POST /internal/index/build`

## Architecture role

- Worker (`apps/dashboard`) stays the product-facing API/auth/control plane.
- `apps/search` runs privately and handles:
  - mirror sync (`git clone --mirror` + fetch),
  - index build orchestration placeholder + manifest writes,
  - forwarding search queries to Livegrep.

## Requirements

- Node.js 22+
- Git available on host/container
- Livegrep endpoint reachable from this service

## Local run

```bash
pnpm install
cp apps/search/.env.example apps/search/.env
pnpm --filter @diffkit/search dev
```

## Environment variables

See `.env.example`.

Important:

- `SEARCH_CONTROL_TOKEN`  
  Bearer token required by `/internal/repos/sync` and `/internal/index/build`.
- `LIVEGREP_UPSTREAM_BASE_URL`  
  Base URL for your Livegrep service.
- `LIVEGREP_SEARCH_PATH`  
  Search path on Livegrep (`/api/v1/search` by default).
- `SEARCH_STORAGE_ROOT`  
  Local root for mirrors/builds/manifests/state.
- `MAX_REPO_SIZE_MB`  
  Repo size cap (RFC default: 10000).

## Docker

Build:

```bash
docker build -f apps/search/Dockerfile -t diffkit-search:latest .
```

Run:

```bash
docker run --rm -p 8910:8910 \
  -e SEARCH_CONTROL_TOKEN=change-me \
  -e LIVEGREP_UPSTREAM_BASE_URL=http://livegrep:8911 \
  -e SEARCH_STORAGE_ROOT=/var/lib/diffkit-search \
  -v diffkit-search-data:/var/lib/diffkit-search \
  diffkit-search:latest
```

## Notes

- Current index build writes manifest metadata and returns payload expected by Worker.
- Replace placeholder index step in `src/index-build.ts` with your real Livegrep build/swap commands.
- Keep this service private (firewall / private network / Cloudflare Access).
