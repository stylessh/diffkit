import { defineConfig, devices } from "@playwright/test";
import {
	dashboardUrl,
	emulatorUrl,
	novaAuthFile,
} from "./support/endpoints.ts";

const inCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: "./tests",
	globalSetup: "./support/global-setup.ts",
	forbidOnly: inCI,
	retries: inCI ? 1 : 0,
	workers: inCI ? 2 : undefined,
	reporter: inCI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: dashboardUrl,
		locale: "en-US",
		timezoneId: "UTC",
		trace: "retain-on-failure",
		...devices["Desktop Chrome"],
	},
	projects: [
		{
			name: "concurrent",
			testDir: "./tests/concurrent",
			fullyParallel: true,
			use: { storageState: novaAuthFile },
		},
		{
			name: "isolated",
			testDir: "./tests/isolated",
			dependencies: ["concurrent"],
			fullyParallel: false,
			workers: 1,
			use: { storageState: novaAuthFile },
		},
	],
	webServer: [
		{
			command:
				"node --experimental-strip-types --disable-warning=ExperimentalWarning src/e2e.ts",
			cwd: "../emulator",
			env: {
				EMULATOR_PORT: new URL(emulatorUrl).port,
				DASHBOARD_URL: dashboardUrl,
			},
			url: `${emulatorUrl}/_diffkit/health`,
			wait: { stdout: /E2E_EMULATOR_READY/ },
			reuseExistingServer: false,
			gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
		},
		{
			command: [
				"rm -rf .wrangler/demo-state",
				"pnpm exec wrangler d1 migrations apply DB --local -c wrangler.demo.jsonc --env demo --persist-to .wrangler/demo-state",
				`pnpm exec vite dev --port ${new URL(dashboardUrl).port} --strictPort`,
			].join(" && "),
			cwd: "../dashboard",
			env: { CLOUDFLARE_ENV: "demo", CI: "true" },
			url: `${dashboardUrl}/login`,
			timeout: 240_000,
			reuseExistingServer: false,
			gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
		},
	],
});
