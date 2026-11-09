# Self-hosting DiffKit

DiffKit runs as one Cloudflare Worker with a D1 database, a KV namespace and an
R2 bucket. [Void](https://void.cloud) builds it and deploys it into your own
Cloudflare account: the first `void deploy` creates the Worker and all three
resources, applies the database migrations and schedules the maintenance cron.
Nothing is hosted by Void.

You need a Cloudflare account, a GitHub account
to own the OAuth App and GitHub App, Node 24.22+ and pnpm 10.

## 1. Get the code

```sh
git clone https://github.com/<you>/diffkit.git   # your fork
cd diffkit
pnpm install
cd apps/dashboard
```

Run every command below from `apps/dashboard`.

## 2. Pick the URL

The Worker is called `diffkit`, so it serves on
`https://diffkit.<your-subdomain>.workers.dev`. Your workers.dev subdomain is on
the Workers overview page of the Cloudflare dashboard. To use your own domain
instead, it must be a zone in the same Cloudflare account; set
`DIFFKIT_DOMAIN=dash.example.com` in the shell for every deploy (step 6) and use
`https://dash.example.com` below.

Call that URL `$URL`.

## 3. Create the GitHub apps

Follow [README steps 2–4](../README.md#2-create-a-github-oauth-app) with `$URL`
in place of `http://localhost:3000`:

- OAuth App callback: `$URL/api/auth/callback/github`
- GitHub App callback: `$URL/api/github/app/callback`, setup URL `$URL/setup`
- GitHub App webhook URL: `$URL/api/webhooks/github`, with a webhook secret

## 4. Write the production values

Put them in a file **outside the repository**, for example
`~/diffkit-production.env`. `env.ts` lists every key; `env.example` explains
each one.

```ini
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_SLUG=...
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_WEBHOOK_SECRET=...
BETTER_AUTH_SECRET=...   # openssl rand -base64 32
BETTER_AUTH_URL=$URL
```

## 5. Connect Cloudflare and upload the secrets

```sh
pnpm exec void connect --platform cloudflare     # browser sign-in, picks the account
pnpm exec void secret sync ~/diffkit-production.env
```

Secrets can be uploaded before the Worker exists. `void deploy` refuses to run
while a required one is missing.

## 6. Deploy

```sh
pnpm run deploy        # void deploy --platform cloudflare
```

It creates `diffkit-db`, `diffkit-kv` and `diffkit-storage` (names prefixed with
the Worker name), saves a D1 restore point, applies the migrations, uploads the
Worker, waits until it answers, and prints the URL. Open `$URL`, sign in with
GitHub, then install your GitHub App on the accounts you want to see.

Commit the `void.lock.json` it wrote in your fork: it records the resource IDs
so later deploys, from any machine, reuse them.

## Updating

Pull the new code and run `pnpm run deploy` again. New migrations are applied
first; a deploy whose Worker does not answer is not activated.

```sh
pnpm exec void project status        # what is serving
pnpm exec void project rollback <version-id>
pnpm exec void project logs          # live tail
```

## Existing resources

To deploy against a D1 database, KV namespace and R2 bucket that already exist
(for example a Worker you deployed before Void), set all four on every deploy:

```sh
export DIFFKIT_D1_DATABASE_NAME=my-db
export DIFFKIT_D1_DATABASE_ID=<uuid>
export DIFFKIT_KV_ID=<namespace id>
export DIFFKIT_R2_BUCKET=my-bucket
```

`void.config.ts` binds exactly those, so nothing is created. Setting only some
of them is an error: a deploy that leaves R2 out would bind a new, empty bucket.

An existing Worker last deployed with another tool must also have its routes
declared, or Void stops before uploading: set `DIFFKIT_DOMAIN` if it serves a
custom domain. Its secrets are kept.

## Deploying from GitHub Actions

`.github/workflows/dashboard-deploy-production.yml` deploys on every push to
`main`. It needs:

- secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs
  Account → Workers Scripts, D1, Workers KV Storage and Workers R2 Storage:
  Edit; with a custom domain, also Zone → Zone: Read and Zone → Workers Routes:
  Edit on that zone;
- repository variables `DIFFKIT_D1_DATABASE_NAME`, `DIFFKIT_D1_DATABASE_ID`,
  `DIFFKIT_KV_ID`, `DIFFKIT_R2_BUCKET` (copy them from `void.lock.json` after
  your first deploy) and `CLOUDFLARE_WORKERS_SUBDOMAIN`, plus `DIFFKIT_DOMAIN`
  if you serve a custom domain.

The workflow refuses to deploy when a resource variable is missing, then checks
`/login` and `/api/health` on the new version and rolls back if they fail
([runbooks/deploy-rollback.md](runbooks/deploy-rollback.md)).
