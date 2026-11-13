import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  chromePlan,
  pack,
  publishChrome,
  publishFirefox,
} from "./publish-extension.mjs";

// Run with: node --test scripts/publish-extension.test.mjs
//
// The store flows run against a local server that answers the way the Chrome
// Web Store v2 and addons.mozilla.org v5 references describe, and records
// what it was sent.

async function withStore(handler, run) {
  const calls = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const call = {
      method: request.method,
      path: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks),
    };
    calls.push(call);
    const [status, body] = handler(call, calls) ?? [404, { detail: "Not found." }];
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`, calls);
  } finally {
    server.close();
  }
}

function seen(calls) {
  return calls.map((call) => `${call.method} ${call.path}`);
}

const zipPath = path.join(mkdtempSync(path.join(tmpdir(), "ext-")), "x.zip");
writeFileSync(zipPath, "zip bytes");

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
function chromeConfig(api, extra) {
  return {
    version: "0.2.0",
    zipPath,
    publisherId: "pub",
    extensionId: "ext",
    api,
    pollMs: 1,
    serviceAccountKey: {
      client_email: "bot@example.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
      token_uri: `${api}/token`,
    },
    ...extra,
  };
}

const ITEM = "/v2/publishers/pub/items/ext";
const published = (version) => ({
  publishedItemRevisionStatus: {
    state: "PUBLISHED",
    distributionChannels: [{ deployPercentage: 100, crxVersion: version }],
  },
});
const inReview = (version) => ({
  submittedItemRevisionStatus: {
    state: "PENDING_REVIEW",
    distributionChannels: [{ deployPercentage: 100, crxVersion: version }],
  },
});

test("chrome: a version the store does not have is uploaded and submitted", async () => {
  await withStore(
    (call) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`) return [200, published("0.1.3")];
      if (call.path === `/upload${ITEM}:upload`)
        return [200, { uploadState: "SUCCEEDED", crxVersion: "0.2.0" }];
      if (call.path === `${ITEM}:publish`)
        return [200, { state: "PENDING_REVIEW" }];
    },
    async (api, calls) => {
      const result = await publishChrome(chromeConfig(api));
      assert.equal(result.outcome, "submitted");
      assert.deepEqual(seen(calls), [
        "POST /token",
        `GET ${ITEM}:fetchStatus`,
        `POST /upload${ITEM}:upload`,
        `POST ${ITEM}:publish`,
      ]);
      const upload = calls[2];
      assert.equal(upload.headers.authorization, "Bearer tok");
      assert.equal(upload.body.toString(), "zip bytes");
    }
  );
});

test("chrome: a version already published or in review is left alone", async () => {
  for (const status of [published("0.2.0"), inReview("0.2.0")]) {
    await withStore(
      (call) => {
        if (call.path === "/token") return [200, { access_token: "tok" }];
        if (call.path === `${ITEM}:fetchStatus`) return [200, status];
      },
      async (api, calls) => {
        const result = await publishChrome(chromeConfig(api));
        assert.equal(result.outcome, "skipped");
        assert.deepEqual(seen(calls), [
          "POST /token",
          `GET ${ITEM}:fetchStatus`,
        ]);
      }
    );
  }
});

test("chrome: an older version in review makes way for the new one", async () => {
  await withStore(
    (call, calls) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`)
        return [200, { ...published("0.1.2"), ...inReview("0.1.3") }];
      if (call.path === `${ITEM}:cancelSubmission`) return [200, {}];
      if (call.path === `/upload${ITEM}:upload`) {
        const cancelled = calls.some((c) => c.path.endsWith(":cancelSubmission"));
        return cancelled
          ? [200, { uploadState: "SUCCEEDED" }]
          : [
              400,
              {
                error: {
                  status: "FAILED_PRECONDITION",
                  message: "Item is in review.",
                },
              },
            ];
      }
      if (call.path === `${ITEM}:publish`)
        return [200, { state: "PENDING_REVIEW" }];
    },
    async (api, calls) => {
      const result = await publishChrome(chromeConfig(api));
      assert.equal(result.outcome, "submitted");
      assert.deepEqual(seen(calls).slice(2), [
        `POST /upload${ITEM}:upload`,
        `POST ${ITEM}:cancelSubmission`,
        `POST /upload${ITEM}:upload`,
        `POST ${ITEM}:publish`,
      ]);
    }
  );
});

test("chrome: a refused upload with nothing in review cancels nothing", async () => {
  await withStore(
    (call) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`) return [200, published("0.1.3")];
      if (call.path === `/upload${ITEM}:upload`)
        return [400, { error: { message: "Bad package." } }];
    },
    async (api, calls) => {
      await assert.rejects(publishChrome(chromeConfig(api)), /Bad package/);
      assert.ok(!seen(calls).some((line) => line.includes("cancelSubmission")));
    }
  );
});

test("chrome: an outage during upload leaves the version in review alone", async () => {
  await withStore(
    (call) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`)
        return [200, { ...published("0.1.2"), ...inReview("0.1.3") }];
      if (call.path === `/upload${ITEM}:upload`)
        return [503, { error: { status: "UNAVAILABLE" } }];
    },
    async (api, calls) => {
      await assert.rejects(publishChrome(chromeConfig(api)), /HTTP 503/);
      assert.ok(!seen(calls).some((line) => line.includes("cancelSubmission")));
    }
  );
});

test("chrome: a manifest behind the version in review uploads nothing", async () => {
  await withStore(
    (call) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`)
        return [200, { ...published("0.1.3"), ...inReview("0.3.0") }];
    },
    async (api, calls) => {
      await assert.rejects(publishChrome(chromeConfig(api)), /0\.3\.0/);
      assert.deepEqual(seen(calls), ["POST /token", `GET ${ITEM}:fetchStatus`]);
    }
  );
});

test("chrome: an upload still processing is waited for before submitting", async () => {
  let reads = 0;
  await withStore(
    (call) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`) {
        reads += 1;
        return [
          200,
          {
            ...published("0.1.3"),
            lastAsyncUploadState: reads < 3 ? "IN_PROGRESS" : "SUCCEEDED",
          },
        ];
      }
      if (call.path === `/upload${ITEM}:upload`)
        return [200, { uploadState: "IN_PROGRESS" }];
      if (call.path === `${ITEM}:publish`)
        return [200, { state: "PENDING_REVIEW" }];
    },
    async (api, calls) => {
      await publishChrome(chromeConfig(api));
      assert.equal(reads, 3);
      assert.equal(seen(calls).at(-1), `POST ${ITEM}:publish`);
    }
  );
});

test("chrome: check mode reads the store and uploads nothing", async () => {
  await withStore(
    (call) => {
      if (call.path === "/token") return [200, { access_token: "tok" }];
      if (call.path === `${ITEM}:fetchStatus`) return [200, published("0.1.3")];
    },
    async (api, calls) => {
      const result = await publishChrome(chromeConfig(api, { check: true }));
      assert.equal(result.outcome, "checked");
      assert.equal(calls.length, 2);
    }
  );
});

test("chrome plan: a store ahead of the manifest is an error, not an upload", () => {
  assert.equal(chromePlan(published("0.10.0"), "0.9.0").action, "fail");
  assert.equal(chromePlan(published("0.9.0"), "0.10.0").action, "upload");
  assert.equal(chromePlan({}, "0.1.0").action, "upload");
});

const ADDON = "/addons/addon/diffkit-redirect@diff-kit.com/versions";
function firefoxConfig(api, extra) {
  return {
    version: "0.2.0",
    zipPath,
    addonId: "diffkit-redirect@diff-kit.com",
    issuer: "user:1:2",
    secret: "s3cret",
    api,
    pollMs: 1,
    ...extra,
  };
}

test("firefox: a new version is uploaded, validated, then created as listed", async () => {
  let polls = 0;
  await withStore(
    (call) => {
      if (call.path === `${ADDON}/v0.2.0/`) return [404, { detail: "Not found." }];
      if (call.path === "/addons/upload/")
        return [201, { uuid: "u1", processed: false, valid: false }];
      if (call.path === "/addons/upload/u1/") {
        polls += 1;
        return [200, { uuid: "u1", processed: polls > 1, valid: polls > 1 }];
      }
      if (call.path === `${ADDON}/`)
        return [201, { version: "0.2.0", file: { status: "unreviewed" } }];
    },
    async (api, calls) => {
      const result = await publishFirefox(firefoxConfig(api));
      assert.deepEqual(result, {
        store: "Firefox Add-ons",
        outcome: "submitted",
        detail: "0.2.0 is unreviewed",
      });
      const upload = calls.find((call) => call.path === "/addons/upload/");
      assert.match(upload.headers.authorization, /^JWT [\w-]+\.[\w-]+\.[\w-]+$/);
      assert.match(upload.body.toString(), /name="channel"\r\n\r\nlisted/);
      assert.match(upload.body.toString(), /zip bytes/);
      assert.deepEqual(JSON.parse(calls.at(-1).body), { upload: "u1" });
    }
  );
});

test("firefox: a version the store already has is left alone", async () => {
  await withStore(
    (call) => {
      if (call.path === `${ADDON}/v0.2.0/`)
        return [200, { version: "0.2.0", file: { status: "public" } }];
    },
    async (api, calls) => {
      const result = await publishFirefox(firefoxConfig(api));
      assert.equal(result.outcome, "skipped");
      assert.equal(calls.length, 1);
    }
  );
});

test("firefox: a failed validation stops before a version is created", async () => {
  await withStore(
    (call) => {
      if (call.path === `${ADDON}/v0.2.0/`) return [404, {}];
      if (call.path === "/addons/upload/")
        return [
          201,
          {
            uuid: "u1",
            processed: true,
            valid: false,
            validation: {
              messages: [
                { type: "warning", message: "Unused." },
                { type: "error", file: "manifest.json", message: "Bad key." },
              ],
            },
          },
        ];
    },
    async (api, calls) => {
      await assert.rejects(
        publishFirefox(firefoxConfig(api)),
        /manifest\.json: Bad key\./
      );
      assert.ok(!seen(calls).includes(`POST ${ADDON}/`));
    }
  );
});

test("firefox: bad credentials are an error, not a missing version", async () => {
  await withStore(
    () => [401, { detail: "Signature has expired." }],
    async (api, calls) => {
      await assert.rejects(
        publishFirefox(firefoxConfig(api)),
        /HTTP 401.*Signature has expired/
      );
      assert.equal(calls.length, 1);
    }
  );
});

test("pack: the zip has manifest.json at its root and leaves the README out", () => {
  const outDir = mkdtempSync(path.join(tmpdir(), "ext-out-"));
  const { zipPath: packed, version } = pack({ outDir });
  const listing = spawnSync("unzip", ["-Z1", packed], { encoding: "utf8" });
  const files = listing.stdout.trim().split("\n");
  assert.match(path.basename(packed), new RegExp(`${version}\\.zip$`));
  assert.ok(files.includes("manifest.json"));
  assert.ok(files.includes("popup.html"));
  assert.ok(!files.includes("README.md"));
});

test("pack: a manifest pointing at a missing file is refused", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ext-src-"));
  mkdirSync(path.join(dir, "icons"));
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({
      version: "1.0.0",
      action: { default_popup: "popup.html" },
      content_scripts: [{ js: ["content.js"] }],
    })
  );
  writeFileSync(path.join(dir, "popup.html"), "");
  assert.throws(() => pack({ dir, outDir: dir }), /missing files: content\.js/);
});
