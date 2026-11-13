import { spawnSync } from "node:child_process";
import { createHmac, createSign, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Packs the browser extension and sends it to the Chrome Web Store and Firefox
// Add-ons. The version in manifest.json is the release switch: each store is
// asked what it already has, and a version it has is left alone, so the script
// can run on every push and be re-run after a failure.
//
//   node scripts/publish-extension.mjs pack
//   node scripts/publish-extension.mjs chrome [--check]
//   node scripts/publish-extension.mjs firefox [--check]
//
// --check stops after reading the store, which is enough to prove credentials.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = path.join(ROOT, "extensions/diffkit-redirect");
const OUT_DIR = path.join(ROOT, "dist");
const NOT_SHIPPED = ["README.md", "*.DS_Store"];

const CHROME_API = "https://chromewebstore.googleapis.com";
const CHROME_SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const AMO_API = "https://addons.mozilla.org/api/v5";

// A submitted revision in one of these states is on its way out already.
const CHROME_WAITING = new Set(["PENDING_REVIEW", "STAGED"]);

function log(line) {
  console.log(`[extension] ${line}`);
}

function report(line) {
  log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n\n`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Package -------------------------------------------------------------------

export function readManifest(dir = EXTENSION_DIR) {
  return JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
}

// Every file manifest.json points at. A missing one makes both stores reject
// the upload, so it is cheaper to catch here.
export function manifestFiles(manifest) {
  const scripts = (manifest.content_scripts ?? []).flatMap((entry) => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]);
  const files = [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    manifest.action?.default_popup,
    manifest.options_page,
    ...scripts,
  ];
  return [...new Set(files.filter(Boolean))];
}

export function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }
  return 0;
}

export function pack({ dir = EXTENSION_DIR, outDir = OUT_DIR } = {}) {
  const manifest = readManifest(dir);
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version ?? "")) {
    throw new Error(
      `manifest.json version "${manifest.version}" must be one to four numbers separated by dots`
    );
  }
  const missing = manifestFiles(manifest).filter(
    (file) => !existsSync(path.join(dir, file))
  );
  if (missing.length > 0) {
    throw new Error(
      `manifest.json points at missing files: ${missing.join(", ")}`
    );
  }

  const zipPath = path.join(
    outDir,
    `diffkit-extension-${manifest.version}.zip`
  );
  mkdirSync(outDir, { recursive: true });
  rmSync(zipPath, { force: true });
  // Zipped from inside the folder: both stores want manifest.json at the root.
  const zip = spawnSync(
    "zip",
    ["-r", "-X", "-q", zipPath, ".", "-x", ...NOT_SHIPPED],
    { cwd: dir, encoding: "utf8" }
  );
  if (zip.status !== 0) {
    throw new Error(`zip failed: ${zip.stderr || zip.error?.message}`);
  }
  return { manifest, version: manifest.version, zipPath };
}

// HTTP ----------------------------------------------------------------------

async function request(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // Not JSON: keep the text, it is all there is to show.
  }
  return { ok: response.ok, status: response.status, body };
}

function expectOk(what, response) {
  if (!response.ok) {
    throw new Error(
      `${what} failed (HTTP ${response.status}): ${JSON.stringify(response.body)}`
    );
  }
  return response.body;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function unsignedJwt(algorithm, claims) {
  const header = base64url(JSON.stringify({ alg: algorithm, typ: "JWT" }));
  return `${header}.${base64url(JSON.stringify(claims))}`;
}

// Chrome Web Store (API v2) -------------------------------------------------

async function googleAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = unsignedJwt("RS256", {
    iss: key.client_email,
    scope: CHROME_SCOPE,
    aud: key.token_uri,
    iat: now,
    exp: now + 600,
  });
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key.private_key, "base64url");
  const token = expectOk(
    "Google sign-in",
    await request(key.token_uri, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }),
    })
  );
  return token.access_token;
}

function revisionVersions(revision) {
  return (revision?.distributionChannels ?? [])
    .map((channel) => channel.crxVersion)
    .filter(Boolean);
}

// What to do with `version`, given the store's fetchStatus answer.
export function chromePlan(status, version) {
  const published = revisionVersions(status.publishedItemRevisionStatus);
  const submitted = status.submittedItemRevisionStatus;
  const waiting = CHROME_WAITING.has(submitted?.state)
    ? revisionVersions(submitted)
    : [];

  if (published.includes(version)) {
    return { action: "skip", reason: `${version} is already published` };
  }
  if (waiting.includes(version)) {
    return {
      action: "skip",
      reason: `${version} is already submitted (${submitted.state})`,
    };
  }
  const newer = published.find((other) => compareVersions(other, version) > 0);
  if (newer) {
    return {
      action: "fail",
      reason: `the store has ${newer}, which is newer than ${version}; bump the version in manifest.json`,
    };
  }
  return {
    action: "upload",
    inReview: submitted?.state === "PENDING_REVIEW" ? waiting[0] : undefined,
  };
}

export async function publishChrome({
  version,
  zipPath,
  serviceAccountKey,
  publisherId,
  extensionId,
  check = false,
  api = CHROME_API,
  pollMs = 5000,
  pollLimit = 36,
}) {
  const token = await googleAccessToken(serviceAccountKey);
  const item = `publishers/${publisherId}/items/${extensionId}`;
  const headers = { authorization: `Bearer ${token}` };
  const call = (method, action, init = {}) =>
    request(`${api}/v2/${item}:${action}`, { method, headers, ...init });
  const fetchStatus = async () =>
    expectOk("Reading the Chrome listing", await call("GET", "fetchStatus"));
  const upload = () =>
    request(`${api}/upload/v2/${item}:upload`, {
      method: "POST",
      headers,
      body: readFileSync(zipPath),
    });

  const plan = chromePlan(await fetchStatus(), version);
  if (plan.action === "fail") {
    throw new Error(`Chrome Web Store: ${plan.reason}`);
  }
  if (plan.action === "skip") {
    return { store: "Chrome Web Store", outcome: "skipped", detail: plan.reason };
  }
  if (check) {
    return {
      store: "Chrome Web Store",
      outcome: "checked",
      detail: `${version} is not in the store yet`,
    };
  }

  let uploaded = await upload();
  if (!uploaded.ok && plan.inReview) {
    // The store keeps one submission at a time, so the older one makes way.
    log(
      `Chrome refused the upload while ${plan.inReview} is in review (HTTP ${uploaded.status}). Cancelling that review and trying again.`
    );
    expectOk(
      `Cancelling the review of ${plan.inReview}`,
      await call("POST", "cancelSubmission")
    );
    uploaded = await upload();
  }
  let { uploadState } = expectOk("Uploading to Chrome", uploaded);
  for (let i = 0; uploadState === "IN_PROGRESS" && i < pollLimit; i += 1) {
    await sleep(pollMs);
    uploadState = (await fetchStatus()).lastAsyncUploadState;
  }
  if (uploadState !== "SUCCEEDED") {
    throw new Error(`Chrome upload ended as ${uploadState}`);
  }

  const submission = expectOk(
    "Submitting to Chrome for review",
    await call("POST", "publish", {
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    })
  );
  for (const warning of submission.warningInfo?.warnings ?? []) {
    log(`Chrome warning: ${warning.reason} ${warning.description}`);
  }
  return {
    store: "Chrome Web Store",
    outcome: "submitted",
    detail: `${version} is ${submission.state}`,
  };
}

// Firefox Add-ons (AMO API v5) ----------------------------------------------

// AMO takes a short-lived token per request; they may not outlive five minutes.
function amoAuthorization({ issuer, secret }) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = unsignedJwt("HS256", {
    iss: issuer,
    jti: randomUUID(),
    iat: now,
    exp: now + 60,
  });
  const signature = createHmac("sha256", secret)
    .update(unsigned)
    .digest("base64url");
  return `JWT ${unsigned}.${signature}`;
}

function amoErrors(upload) {
  const errors = (upload.validation?.messages ?? [])
    .filter((message) => message.type === "error")
    .map((message) =>
      [message.file, message.message].filter(Boolean).join(": ")
    );
  return errors.length > 0 ? errors.join("\n") : JSON.stringify(upload);
}

export async function publishFirefox({
  version,
  zipPath,
  addonId,
  issuer,
  secret,
  check = false,
  api = AMO_API,
  pollMs = 5000,
  pollLimit = 120,
}) {
  const call = (pathname, init = {}) =>
    request(`${api}${pathname}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: amoAuthorization({ issuer, secret }),
      },
    });

  // The `v` prefix makes AMO read the segment as a version number, not an id.
  const existing = await call(
    `/addons/addon/${addonId}/versions/v${version}/`
  );
  if (existing.ok) {
    return {
      store: "Firefox Add-ons",
      outcome: "skipped",
      detail: `${version} is already there (${existing.body.file?.status})`,
    };
  }
  if (existing.status !== 404) {
    expectOk("Reading the Firefox listing", existing);
  }
  if (check) {
    return {
      store: "Firefox Add-ons",
      outcome: "checked",
      detail: `${version} is not in the store yet`,
    };
  }

  const form = new FormData();
  form.set(
    "upload",
    new File([readFileSync(zipPath)], path.basename(zipPath), {
      type: "application/zip",
    })
  );
  form.set("channel", "listed");
  let upload = expectOk(
    "Uploading to Firefox",
    await call("/addons/upload/", { method: "POST", body: form })
  );
  for (let i = 0; !upload.processed && i < pollLimit; i += 1) {
    await sleep(pollMs);
    upload = expectOk(
      "Reading the Firefox validation",
      await call(`/addons/upload/${upload.uuid}/`)
    );
  }
  if (!upload.processed) {
    throw new Error("Firefox did not finish validating the upload in time");
  }
  if (!upload.valid) {
    throw new Error(`Firefox rejected the upload:\n${amoErrors(upload)}`);
  }

  const created = expectOk(
    "Creating the Firefox version",
    await call(`/addons/addon/${addonId}/versions/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload: upload.uuid }),
    })
  );
  return {
    store: "Firefox Add-ons",
    outcome: "submitted",
    detail: `${created.version} is ${created.file?.status}`,
  };
}

// Command line --------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const TARGETS = {
  chrome: (packed, check) => {
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(requireEnv("CHROME_SERVICE_ACCOUNT_KEY"));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          "CHROME_SERVICE_ACCOUNT_KEY must be the service account's JSON key file"
        );
      }
      throw error;
    }
    return publishChrome({
      ...packed,
      check,
      serviceAccountKey,
      publisherId: requireEnv("CHROME_PUBLISHER_ID"),
      extensionId: requireEnv("CHROME_EXTENSION_ID"),
    });
  },
  firefox: (packed, check) =>
    publishFirefox({
      ...packed,
      check,
      addonId: packed.manifest.browser_specific_settings.gecko.id,
      issuer: requireEnv("AMO_JWT_ISSUER"),
      secret: requireEnv("AMO_JWT_SECRET"),
    }),
};

async function main([command, ...flags]) {
  if (command !== "pack" && !TARGETS[command]) {
    throw new Error(
      "Usage: publish-extension.mjs pack | chrome [--check] | firefox [--check]"
    );
  }
  const packed = pack();
  log(`Packed ${packed.version} into ${path.relative(ROOT, packed.zipPath)}`);
  if (command === "pack") {
    return;
  }
  const result = await TARGETS[command](packed, flags.includes("--check"));
  report(`**${result.store}**: ${result.outcome}. ${result.detail}`);
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `[extension] ${error instanceof Error ? error.message : error}`
    );
    process.exitCode = 1;
  }
}
