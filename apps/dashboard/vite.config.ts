import { existsSync, readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import {
	getSharedWranglerStatePath,
	isWorktreeCheckout,
} from "../../scripts/shared-worktree-paths.mjs";

const dashboardRoot = new URL(".", import.meta.url);
const worktreePersistState = isWorktreeCheckout(dashboardRoot)
	? { persistState: { path: getSharedWranglerStatePath(dashboardRoot) } }
	: {};

function getDevVarFromFile(key: string) {
	const devVarsPath = new URL("./.dev.vars", dashboardRoot);
	if (!existsSync(devVarsPath)) {
		return null;
	}

	const lines = readFileSync(devVarsPath, "utf8").split(/\r?\n/u);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}

		const parsedKey = trimmed.slice(0, separatorIndex).trim();
		if (parsedKey !== key) {
			continue;
		}

		const rawValue = trimmed.slice(separatorIndex + 1).trim();
		return rawValue.replace(/^['"]|['"]$/gu, "");
	}

	return null;
}

function getDevTunnelUrl() {
	return process.env.DEV_TUNNEL_URL ?? getDevVarFromFile("DEV_TUNNEL_URL");
}

function getTunnelServerConfig(): import("vite").UserConfig["server"] {
	const tunnelUrl = getDevTunnelUrl();
	if (!tunnelUrl) {
		return undefined;
	}

	let parsedTunnelUrl: URL;
	try {
		parsedTunnelUrl = new URL(tunnelUrl);
	} catch {
		throw new Error(
			`Invalid DEV_TUNNEL_URL: ${JSON.stringify(tunnelUrl)}. Expected a full URL like https://example.ngrok-free.app.`,
		);
	}

	const isSecure = parsedTunnelUrl.protocol === "https:";
	const port =
		parsedTunnelUrl.port.length > 0
			? Number.parseInt(parsedTunnelUrl.port, 10)
			: isSecure
				? 443
				: 80;

	return {
		allowedHosts: [parsedTunnelUrl.hostname],
		hmr: {
			host: parsedTunnelUrl.hostname,
			protocol: isSecure ? "wss" : "ws",
			clientPort: port,
		},
	};
}

// Stub out shiki in the SSR (Cloudflare Worker) environment to prevent all
// language grammars (~1.5 MB) from being bundled. Shiki is only used
// client-side so the server never needs the real implementation.
function shikiSSRStub(): import("vite").Plugin {
	const SHIKI_RE = /^(shiki|@shikijs\/)/;
	const STUB = `
export const bundledLanguages = {};
export const bundledThemes = {};
export const createHighlighter = () => Promise.resolve({});
export const createJavaScriptRegexEngine = () => ({});
export const createOnigurumaEngine = () => Promise.resolve({});
export const createCssVariablesTheme = () => ({});
export const codeToHtml = () => "";
export const normalizeTheme = (t) => t;
export const getTokenStyleObject = () => ({});
export const stringifyTokenStyle = () => "";
export const transformerStyleToClass = () => ({});
export default {};`;

	return {
		name: "shiki-ssr-stub",
		enforce: "pre",
		resolveId: {
			handler(source) {
				if (this.environment?.name === "ssr" && SHIKI_RE.test(source)) {
					return `\0shiki-stub:${source}`;
				}
			},
		},
		load(id) {
			if (id.startsWith("\0shiki-stub:")) {
				return STUB;
			}
		},
	};
}

// Remote R2/KV/D1 bindings require `wrangler login`; Vitest and PR CI use local Miniflare only.
const useCloudflareRemoteBindings =
	process.env.CI !== "true" && process.env.VITEST !== "true";

const config = defineConfig(({ command }) => ({
	server: command === "serve" ? getTunnelServerConfig() : undefined,
	plugins: [
		devtools(),
		shikiSSRStub(),
		cloudflare({
			viteEnvironment: { name: "ssr" },
			...worktreePersistState,
			remoteBindings: useCloudflareRemoteBindings,
		}),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
}));

export default config;
