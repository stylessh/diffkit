#!/usr/bin/env node
// Captures one screenshot per user-facing area from demo mode, in both themes.
// Needs `pnpm dev:demo` running. Run from the repo root:
//   node docs/experiments/product-map/pipeline/capture-screens.mjs
// DASHBOARD_URL overrides the default http://localhost:3000.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const require = createRequire(path.join(root, "apps/e2e/package.json"));
const { chromium } = require("@playwright/test");

const base = process.env.DASHBOARD_URL ?? "http://localhost:3000";
const outDir = path.join(root, "apps/dashboard/public/product-map");
const areas = JSON.parse(readFileSync(path.join(here, "areas.json"), "utf8")).areas.filter(
  (area) => area.screen
);

async function signIn(page) {
  await page.goto(`${base}/login`);
  const start = page.getByRole("button", { name: "Continue with GitHub" });
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await start.click().catch(() => {});
    const left = await page
      .waitForURL(/\/login\/oauth\//, { timeout: 2000 })
      .then(() => true, () => false);
    if (left) break;
  }
  await page.getByRole("button", { name: /nova\b/ }).click();
  await page.waitForURL((url) => url.origin === base && !/^\/(login|api)/.test(url.pathname));
}

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: theme,
  });
  await context.addInitScript((value) => {
    localStorage.setItem("theme", value);
    localStorage.setItem("diffkit-alpha-notice-dismissed", "1");
    localStorage.setItem("diffkit-extension-prompt-dismissed-at", String(Date.now()));
  }, theme);
  await context.route(/unpkg\.com\/react-scan/, (route) => route.abort());
  const page = await context.newPage();

  for (const area of areas.filter((entry) => entry.id === "sign-in")) {
    await page.goto(base + area.screen.path);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outDir}/${area.id}-${theme}.jpg`, type: "jpeg", quality: 72 });
  }

  await signIn(page);
  for (const area of areas.filter((entry) => entry.id !== "sign-in")) {
    const palette = area.screen.path.endsWith("?palette");
    await page.goto(base + area.screen.path.replace("?palette", ""));
    await page.waitForTimeout(3500);
    if (palette) {
      await page.keyboard.press("ControlOrMeta+k");
      await page.waitForTimeout(900);
    }
    await page.evaluate(() => {
      for (const element of document.querySelectorAll(
        '[data-agentation-root], [class*="tsqd"], [aria-label*="TanStack"]'
      ))
        element.remove();
    });
    await page.screenshot({ path: `${outDir}/${area.id}-${theme}.jpg`, type: "jpeg", quality: 72 });
    console.log(theme, area.id);
  }
  await context.close();
}
await browser.close();
