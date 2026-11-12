// Creates the two GitHub apps `pnpm dev` needs and writes apps/dashboard/.env.
// The GitHub App is registered from a manifest, so it takes one click on
// GitHub. OAuth Apps have no such flow: the page links to GitHub's form and
// takes the two values back. Secrets go to .env only, never to the terminal.
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";
import { DASHBOARD_URL, DevSetupError } from "./dev-env.mjs";
import { getPrimaryWorktreeRoot } from "./shared-worktree-paths.mjs";

const WEBHOOK_PATH = "/api/webhooks/github";
// GitHub wants a webhook URL even for an inactive webhook, and rejects localhost.
const INACTIVE_WEBHOOK_URL = `https://example.com${WEBHOOK_PATH}`;

// What the hosted app at github.com/apps/diff-kit asks for, so a local app can
// do everything production can.
const PERMISSIONS = {
  actions: "write",
  administration: "write",
  artifact_metadata: "write",
  blocking: "write",
  checks: "write",
  contents: "write",
  deployments: "write",
  discussions: "write",
  emails: "write",
  environments: "write",
  followers: "write",
  gists: "write",
  interaction_limits: "write",
  issues: "write",
  members: "write",
  merge_queues: "write",
  metadata: "read",
  organization_hooks: "write",
  profile: "write",
  pull_requests: "write",
  repository_hooks: "write",
  secrets: "write",
  starring: "write",
  user_events: "read",
  watching: "write",
  workflows: "write",
};
const EVENTS = [
  "branch_protection_configuration",
  "branch_protection_rule",
  "check_run",
  "check_suite",
  "create",
  "delete",
  "issues",
  "issue_comment",
  "organization",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "push",
  "repository",
  "repository_ruleset",
  "workflow_dispatch",
  "workflow_job",
  "workflow_run",
];

function readOptions() {
  const { values } = parseArgs({
    options: {
      tunnel: { type: "string" },
      name: { type: "string" },
      port: { type: "string", default: "3939" },
    },
  });

  let tunnelOrigin = null;
  if (values.tunnel) {
    try {
      tunnelOrigin = new URL(values.tunnel).origin;
    } catch {
      throw new DevSetupError(
        `--tunnel needs a full URL like https://example.ngrok-free.app, got ${JSON.stringify(values.tunnel)}.`
      );
    }
  }

  // The dashboard's .env lives in the main checkout; `pnpm dev` links it into
  // every worktree.
  const envPath = path.join(getPrimaryWorktreeRoot(), "apps/dashboard/.env");
  if (existsSync(envPath)) {
    throw new DevSetupError(
      `${envPath} already exists. Move it away first if you want new apps.`
    );
  }

  return {
    envPath,
    tunnelOrigin,
    port: Number(values.port),
    // App names are unique across GitHub. The name can still be changed on
    // GitHub's confirmation page.
    name: values.name ?? `DiffKit Local ${randomBytes(2).toString("hex")}`,
  };
}

function buildManifest({ name, tunnelOrigin, selfUrl }) {
  return {
    name,
    description: "Local development instance of DiffKit.",
    url: DASHBOARD_URL,
    hook_attributes: tunnelOrigin
      ? { url: `${tunnelOrigin}${WEBHOOK_PATH}`, active: true }
      : { url: INACTIVE_WEBHOOK_URL, active: false },
    redirect_url: `${selfUrl}/github-app/created`,
    callback_urls: [`${DASHBOARD_URL}/api/github/app/callback`],
    setup_url: `${DASHBOARD_URL}/setup`,
    setup_on_update: true,
    request_oauth_on_install: false,
    public: false,
    default_permissions: PERMISSIONS,
    default_events: EVENTS,
  };
}

async function convertManifestCode(code) {
  const response = await fetch(
    `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "diffkit-local-setup",
      },
    }
  );
  if (response.status !== 201) {
    throw new Error(
      `GitHub answered ${response.status} when exchanging the code. Start step 1 again.`
    );
  }
  return await response.json();
}

function renderEnvFile({ app, oauth, tunnelOrigin }) {
  // .env wants the key on one line with literal \n.
  const privateKey = `${app.pem.trim().split("\n").join("\\n")}\\n`;
  return [
    "# Written by `pnpm setup:github`. Never commit this file.",
    `# GitHub App: ${app.html_url}`,
    `GITHUB_OAUTH_CLIENT_ID=${oauth.clientId}`,
    `GITHUB_OAUTH_CLIENT_SECRET=${oauth.clientSecret}`,
    `GITHUB_APP_ID=${app.id}`,
    `GITHUB_APP_SLUG=${app.slug}`,
    `GITHUB_APP_CLIENT_ID=${app.client_id}`,
    `GITHUB_APP_CLIENT_SECRET=${app.client_secret}`,
    `GITHUB_APP_PRIVATE_KEY="${privateKey}"`,
    `GITHUB_WEBHOOK_SECRET=${app.webhook_secret ?? randomBytes(20).toString("hex")}`,
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`,
    `BETTER_AUTH_URL=${DASHBOARD_URL}`,
    `DEV_TUNNEL_URL=${tunnelOrigin ?? ""}`,
    "",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const PAGE_STYLE = `
  :root { color-scheme: light dark; --fg: #1a1a1a; --muted: #6b6b6b; --line: #e4e4e4; --ok: #1a7f37; --bg: #fff; --btn: #1a1a1a; --btn-fg: #fff; }
  @media (prefers-color-scheme: dark) { :root { --fg: #ededed; --muted: #9a9a9a; --line: #2c2c2c; --ok: #4ac26b; --bg: #111; --btn: #ededed; --btn-fg: #111; } }
  body { font: 15px/1.55 system-ui, sans-serif; color: var(--fg); background: var(--bg); max-width: 560px; margin: 48px auto; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0 0 28px; }
  section { border-top: 1px solid var(--line); padding: 20px 0; }
  h2 { font-size: 15px; margin: 0 0 8px; }
  h2 span { color: var(--muted); font-weight: 400; margin-right: 8px; }
  p { margin: 0 0 12px; }
  code { font-size: 13px; overflow-wrap: anywhere; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 0 0 16px; }
  dt { color: var(--muted); } dd { margin: 0; }
  label { display: block; margin: 0 0 10px; color: var(--muted); }
  input:not([type=hidden]) { display: block; width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px 10px; font: inherit; color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 8px; }
  button, .button { display: inline-block; font: inherit; font-weight: 500; padding: 8px 14px; border: 0; border-radius: 8px; background: var(--btn); color: var(--btn-fg); cursor: pointer; text-decoration: none; }
  .ok { color: var(--ok); } .muted { color: var(--muted); } .error { color: #cf222e; }
`;

function renderPage({ options, manifest, csrf, app, oauth, written, error }) {
  const oauthCallback = `${DASHBOARD_URL}/api/auth/callback/github`;
  const oauthFormUrl = `https://github.com/settings/applications/new?${new URLSearchParams(
    {
      "oauth_application[name]": options.name,
      "oauth_application[url]": DASHBOARD_URL,
      "oauth_application[callback_url]": oauthCallback,
    }
  )}`;

  const webhookNote = options.tunnelOrigin
    ? `Webhooks go to <code>${escapeHtml(manifest.hook_attributes.url)}</code>.`
    : "Webhooks stay off until you add a tunnel URL in the app's settings.";
  const appStep = app
    ? `<p class="ok">Created <a href="${escapeHtml(app.html_url)}">${escapeHtml(app.slug)}</a>.</p>`
    : `<form method="post" action="https://github.com/settings/apps/new?state=${csrf}">
        <input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest))}">
        <p>Same permissions and events as the hosted DiffKit app. ${webhookNote}</p>
        <button>Create the GitHub App</button>
      </form>`;

  const oauthStep = oauth
    ? `<p class="ok">Saved.</p>`
    : `<p><a href="${escapeHtml(oauthFormUrl)}" target="_blank" rel="noreferrer">Open GitHub's new OAuth App form</a>, register it, generate a client secret, then paste both here.</p>
      <dl>
        <dt>Application name</dt><dd><code>${escapeHtml(options.name)}</code></dd>
        <dt>Homepage URL</dt><dd><code>${DASHBOARD_URL}</code></dd>
        <dt>Callback URL</dt><dd><code>${oauthCallback}</code></dd>
      </dl>
      <form method="post" action="/oauth">
        <input type="hidden" name="csrf" value="${csrf}">
        <label>Client ID <input name="client_id" required autocomplete="off"></label>
        <label>Client secret <input name="client_secret" type="password" required autocomplete="off"></label>
        <button>Save</button>
      </form>`;

  const installStep = written
    ? `<p class="ok"><code>.env</code> is written.</p>
      <p>Run <code>pnpm dev</code> first: installing sends you back to ${DASHBOARD_URL}.</p>
      <p><a class="button" href="https://github.com/apps/${escapeHtml(app.slug)}/installations/new">Install the app</a></p>`
    : `<p class="muted">Available once steps 1 and 2 are done.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DiffKit GitHub setup</title><style>${PAGE_STYLE}</style></head><body>
<h1>DiffKit GitHub setup</h1>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
<section><h2><span>1</span>GitHub App</h2>${appStep}</section>
<section><h2><span>2</span>OAuth App</h2>${oauthStep}</section>
<section><h2><span>3</span>Install</h2>${installStep}</section>
</body></html>`;
}

async function readForm(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) {
      throw new Error("Form too large.");
    }
  }
  return new URLSearchParams(body);
}

const WHITESPACE = /\s/;

async function readOauthValues(request, csrf) {
  const form = await readForm(request);
  if (form.get("csrf") !== csrf) {
    throw new Error("Stale form. Reload this page and try again.");
  }
  const clientId = (form.get("client_id") ?? "").trim();
  const clientSecret = (form.get("client_secret") ?? "").trim();
  if (!(clientId && clientSecret) || WHITESPACE.test(clientId + clientSecret)) {
    throw new Error("Both OAuth values are needed, without spaces.");
  }
  return { clientId, clientSecret };
}

function readManifestCode(url, csrf) {
  if (url.searchParams.get("state") !== csrf) {
    throw new Error("State mismatch. Start step 1 again from this page.");
  }
  return url.searchParams.get("code") ?? "";
}

function serve(options) {
  const selfUrl = `http://127.0.0.1:${options.port}`;
  const manifest = buildManifest({ ...options, selfUrl });
  const csrf = randomBytes(24).toString("hex");
  const log = (message) => console.log(`\x1b[35m[setup]\x1b[0m ${message}`);

  let app = null;
  let oauth = null;
  let written = false;
  let error = "";

  const writeEnvWhenComplete = () => {
    if (written || !app || !oauth) {
      return;
    }
    writeFileSync(
      options.envPath,
      renderEnvFile({ app, oauth, tunnelOrigin: options.tunnelOrigin }),
      { flag: "wx", mode: 0o600 }
    );
    written = true;
    log(`wrote ${options.envPath}`);
  };

  const finish = () => {
    log("Next: run `pnpm dev`, then install the app:");
    log(`  https://github.com/apps/${app.slug}/installations/new`);
    if (!options.tunnelOrigin) {
      log(
        "Webhooks are off. To turn them on, see Local webhook testing in the README."
      );
    }
    process.exit(0);
  };

  const sendPage = (response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(
      renderPage({ options, manifest, csrf, app, oauth, written, error })
    );
    error = "";
    if (written) {
      response.once("finish", finish);
    }
  };

  // Each step stores what it received; the caller then redirects to the page.
  const steps = {
    "GET /github-app/created": async (_request, url) => {
      const code = readManifestCode(url, csrf);
      if (!app) {
        app = await convertManifestCode(code);
        log(`GitHub App created: ${app.html_url}`);
      }
    },
    "POST /oauth": async (request) => {
      oauth = await readOauthValues(request, csrf);
      log("OAuth App values received");
    },
  };

  const handle = async (request, response) => {
    // The page holds the form that creates the app, so only this machine's
    // browser, on this exact origin, may talk to it.
    if (request.headers.host !== `127.0.0.1:${options.port}`) {
      response.writeHead(403).end();
      return;
    }
    const url = new URL(request.url, selfUrl);
    const route = `${request.method} ${url.pathname}`;
    if (route === "GET /") {
      sendPage(response);
      return;
    }
    const step = steps[route];
    if (!step) {
      response.writeHead(404).end();
      return;
    }
    await step(request, url);
    writeEnvWhenComplete();
    response.writeHead(303, { location: "/" }).end();
  };

  const server = createServer((request, response) => {
    handle(request, response).catch((cause) => {
      error = cause instanceof Error ? cause.message : String(cause);
      log(`error: ${error}`);
      response.writeHead(303, { location: "/" }).end();
    });
  });

  server.once("error", (cause) => {
    console.error(
      `\x1b[31mCould not listen on :${options.port} (${cause.message}). Pass --port to use another.\x1b[0m`
    );
    process.exit(1);
  });
  server.listen(options.port, "127.0.0.1", () => {
    log(`Open ${selfUrl} in a browser where you are signed in to GitHub.`);
  });
}

try {
  serve(readOptions());
} catch (error) {
  if (!(error instanceof DevSetupError)) {
    throw error;
  }
  console.error(`\x1b[31m${error.message}\x1b[0m`);
  process.exit(1);
}
