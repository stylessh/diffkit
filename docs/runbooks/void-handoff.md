# Runbook: first Void deploy of production

One time only. Production (`diffkit` on <https://diff-kit.com>) was deployed
with `wrangler deploy` until the Void migration. The first Void deploy must bind
the existing resources, or Void creates new, empty ones. This was rehearsed on
a copy of production (same deploy path, existing D1/KV/R2, secrets, cron and a
marker row): the same resources stayed bound, no resource was created, the 9
secrets and the data survived, and no migration ran again. Custom domains were
not part of the rehearsal; step 4 checks `diff-kit.com`.

## 1. Before merging

Set these **repository variables** (Settings → Secrets and variables →
Actions → Variables, or `gh variable set NAME --body VALUE`). They are resource
IDs, not secrets. Set on 2026-11-09.

| Variable | Value |
| --- | --- |
| `DIFFKIT_D1_DATABASE_NAME` | `quickhub-db` |
| `DIFFKIT_D1_DATABASE_ID` | `7a94a843-0906-416c-9908-4c9fe5339db7` |
| `DIFFKIT_KV_ID` | `2e46aa8dd4554072a64e1aad955d6adc` |
| `DIFFKIT_R2_BUCKET` | `diffkit-comment-media` |
| `DIFFKIT_DOMAIN` | `diff-kit.com` |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | `adaaanniel` |

They were read from the serving version on 2026-11-09:

```sh
pnpm exec wrangler versions view <serving-version-id> --name diffkit --json
```

The `CLOUDFLARE_API_TOKEN` secret now also manages the `diff-kit.com` custom
domain, which was set in the dashboard before. Besides the account permissions
(Workers Scripts, D1, KV, R2: Edit), it needs two zone permissions on
`diff-kit.com`: **Zone: Read** (Void looks the zone up by name) and **Workers
Routes: Edit** (it attaches the custom domain). Added on 2026-11-09.

## 2. Merge

The deploy workflow runs `void deploy`. Expect, in its log: `D1 migrations up
to date`, `1 cron job scheduled`, and the health gate passing on the new
version.

## 3. If the workflow stops before uploading

Void stops without changing anything when what it would deploy does not match
the account, for example `the existing Worker has dashboard-managed routes or
visibility`. Production keeps serving the previous version. Compare the
variables with the serving version (step 1) and re-run the job.

## 4. Verify

```sh
curl -s https://diff-kit.com/api/health | jq '{status, version, checks}'
pnpm exec wrangler deployments status --name diffkit
pnpm exec wrangler versions view <new-version-id> --name diffkit --json \
  | jq '.resources.bindings[] | select(.type | test("d1|kv|r2")) | {name, id: (.id // .namespace_id // .bucket_name)}'
```

The bindings must show the IDs from step 1. Within 5 minutes,
`/api/health` must report `maintenance.status: "recent"`: the cron now runs
from `apps/dashboard/crons/maintenance.ts` through Void's generated
`scheduled` handler, which the rehearsal registered but did not see fire. In the Cloudflare dashboard,
Workers → `diffkit` → Settings → Domains & Routes must still list
`diff-kit.com`. If it is gone, add it back there (Add → Custom domain →
`diff-kit.com`), then roll back the code as in
[deploy-rollback.md](deploy-rollback.md#rolling-back-by-hand) and open an issue
with the deploy log.

## 5. Clean up

After a verified deploy, delete the secrets the old workflow used:

```sh
for name in WORKER_NAME D1_DATABASE_NAME D1_DATABASE_ID KV_ID R2_BUCKET R2_PREVIEW_BUCKET; do
  gh secret delete "DASHBOARD_PROD_$name"
done
```
