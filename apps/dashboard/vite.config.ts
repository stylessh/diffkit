import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveWranglerConfigPath } from "../../scripts/resolve-wrangler-config-path.mts";
import {
	getSharedWranglerStatePath,
	isWorktreeCheckout,
} from "../../scripts/shared-worktree-paths.mjs";

const dashboardRoot = new URL(".", import.meta.url);
const dashboardRootDir = fileURLToPath(dashboardRoot);

// Local demo mode (`pnpm dev:demo`): CLOUDFLARE_ENV=demo selects the `demo`
// environment in wrangler.demo.jsonc and makes Wrangler read `.dev.vars.demo`.
// Its D1/KV/R2 state lives apart from your normal dev state.
const isDemoMode = process.env.CLOUDFLARE_ENV === "demo";
const DEMO_WRANGLER_CONFIG = "wrangler.demo.jsonc";
const DEMO_STATE_PATH = fileURLToPath(
	new URL("./.wrangler/demo-state", dashboardRoot),
);

const worktreePersistState = isDemoMode
	? { persistState: { path: DEMO_STATE_PATH } }
	: isWorktreeCheckout(dashboardRoot)
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
	if (isDemoMode) {
		return null;
	}
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
	const DEFAULT_STUB = `
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

	// "shiki/core" re-exports "@shikijs/core" (fine-grained / createHighlighterCore).
	// "@shikijs/rehype" imports isSpecialLang from "shiki/core" during SSR analysis.
	const CORE_STUB = `
const mockHighlighter = {};
export async function createHighlighterCore() {
	return mockHighlighter;
}
export function createHighlighterCoreSync() {
	return mockHighlighter;
}
export const getSingletonHighlighterCore = createHighlighterCore;
export const createCssVariablesTheme = () => ({});
export const normalizeTheme = (theme) => theme;
export function makeSingletonHighlighterCore(fn) {
	return (opts) => fn(opts);
}
export function isPlainLang(lang) {
	return !lang || ["plaintext", "txt", "text", "plain"].includes(lang);
}
export function isSpecialLang(lang) {
	return lang === "ansi" || isPlainLang(lang);
}
export function isNoneTheme(theme) {
	return theme === "none";
}
export function isSpecialTheme(theme) {
	return isNoneTheme(theme);
}`;

	const TEXTMATE_STUB = `
export const INITIAL = {};
export const EncodedTokenMetadata = {};`;

	const LANG_STUB = "export default [];";
	const THEME_STUB = "export default Object.freeze({});";

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
			if (!id.startsWith("\0shiki-stub:")) {
				return;
			}
			const source = id.slice("\0shiki-stub:".length);
			if (
				source === "shiki/core" ||
				source === "@shikijs/core" ||
				source.startsWith("@shikijs/core/")
			) {
				return CORE_STUB;
			}
			if (source === "shiki/textmate") {
				return TEXTMATE_STUB;
			}
			if (source.startsWith("@shikijs/langs/")) {
				return LANG_STUB;
			}
			if (source.startsWith("@shikijs/themes/")) {
				return THEME_STUB;
			}
			return DEFAULT_STUB;
		},
	};
}

// @pierre/diffs resolves Shiki grammars through `shiki/langs`, which maps every
// grammar Shiki ships. Shiki is only the fallback highlighter (no WebAssembly),
// so point it at the trimmed bundle the markdown renderer already uses.
function shikiTrimmedLanguages(): import("vite").Plugin {
	const trimmed = fileURLToPath(
		new URL("./src/lib/diffs/shiki-langs.ts", dashboardRoot),
	);
	return {
		name: "shiki-trimmed-languages",
		enforce: "pre",
		resolveId(source) {
			if (source === "shiki/langs" && this.environment?.name === "client") {
				return trimmed;
			}
		},
	};
}

// better-auth statically imports @better-auth/kysely-adapter, which in turn
// dynamic-imports three dialects (bun-sqlite, node-sqlite, d1-sqlite). On
// Cloudflare we only use the drizzle adapter — but the bun/node dialect
// dynamic imports still get bundled. Stub the two we never hit.
function betterAuthDialectStub(): import("vite").Plugin {
	// Matches the resolved absolute path of bun/node sqlite dialect files inside
	// @better-auth/kysely-adapter/dist/. The filenames include build hashes so
	// we match on the dialect prefix.
	const UNUSED_DIALECT_RE =
		/@better-auth[\\/]kysely-adapter[\\/]dist[\\/](bun-sqlite|node-sqlite)-dialect/;
	const STUB = `export const BunSqliteDialect = null;
export const NodeSqliteDialect = null;
export default {};`;
	return {
		name: "better-auth-dialect-stub",
		enforce: "pre",
		load(id) {
			if (this.environment?.name === "ssr" && UNUSED_DIALECT_RE.test(id)) {
				return STUB;
			}
		},
	};
}

// Root cause of the dev-server OOM on the first request: `@hugeicons/react`'s
// barrel re-exports ~3,900 icon modules, and Vite pre-bundles them into a single
// 39.7 MB SSR module. The Cloudflare module runner evaluates each module with
// one synchronous `eval` inside workerd, whose isolate heap is capped at ~1.4 GB;
// compiling that one module exhausts it (with or without source maps). Rewriting
// named imports to per-icon modules keeps the barrel out of the dependency
// optimizer. Dev only: production builds tree-shake the barrel.
function hugeiconsDeepImports(): import("vite").Plugin {
	const iconsPackage = path.dirname(
		createRequire(
			new URL("../../packages/icons/package.json", import.meta.url),
		).resolve("@hugeicons/react/package.json"),
	);
	let iconFiles: Map<string, string> | null = null;
	const loadIconFiles = () => {
		if (iconFiles) return iconFiles;
		const index = readFileSync(
			path.join(iconsPackage, "dist/esm/icons/index.js"),
			"utf8",
		);
		const localToFile = new Map<string, string>();
		for (const match of index.matchAll(
			/import\{default as ([\w$]+)\}from"\.\/([^"]+)"/gu,
		)) {
			localToFile.set(match[1], match[2]);
		}
		iconFiles = new Map();
		const exportList = index.slice(index.lastIndexOf("export{"));
		for (const match of exportList.matchAll(/([\w$]+) as (\w+)/gu)) {
			const file = localToFile.get(match[1]);
			if (file) iconFiles.set(match[2], file);
		}
		if (iconFiles.size === 0) {
			throw new Error(
				"hugeicons-deep-imports: found no icons in @hugeicons/react/dist/esm/icons/index.js. Its build format changed; update the parser, or the barrel is pre-bundled again and workerd runs out of memory.",
			);
		}
		return iconFiles;
	};
	const IMPORT_RE =
		/(import|export)\s*\{([^}]*)\}\s*from\s*["']@hugeicons\/react["'];?/gu;

	return {
		name: "hugeicons-deep-imports",
		apply: "serve",
		enforce: "pre",
		config: () => ({
			optimizeDeps: { exclude: ["@hugeicons/react"] },
			ssr: { optimizeDeps: { exclude: ["@hugeicons/react"] } },
		}),
		transform(code, id) {
			if (!code.includes("@hugeicons/react") || id.includes("node_modules")) {
				return;
			}
			const files = loadIconFiles();
			let changed = false;
			const next = code.replace(
				IMPORT_RE,
				(statement, keyword: string, specifiers: string) => {
					const deep: string[] = [];
					const rest: string[] = [];
					for (const raw of specifiers.split(",")) {
						const specifier = raw.trim();
						if (!specifier) continue;
						const [imported, local = imported] = specifier
							.split(/\s+as\s+/u)
							.map((part) => part.trim());
						const file = files.get(imported);
						if (file) {
							const source = `"@hugeicons/react/dist/esm/icons/${file}"`;
							deep.push(
								keyword === "export"
									? `export { default as ${local} } from ${source};`
									: `import ${local} from ${source};`,
							);
						} else {
							rest.push(specifier);
						}
					}
					if (deep.length === 0) return statement;
					changed = true;
					return [
						...deep,
						...(rest.length > 0
							? [`${keyword} { ${rest.join(", ")} } from "@hugeicons/react";`]
							: []),
					].join("\n");
				},
			);
			return changed ? { code: next, map: null } : undefined;
		},
	};
}

// Remote R2/KV/D1 bindings require `wrangler login`; Vitest and PR CI use local Miniflare only.
const useCloudflareRemoteBindings =
	process.env.CI !== "true" && process.env.VITEST !== "true" && !isDemoMode;

const config = defineConfig(({ command, mode }) => {
	const wranglerConfigPath = isDemoMode
		? DEMO_WRANGLER_CONFIG
		: resolveWranglerConfigPath({
				command,
				mode,
				rootDir: dashboardRootDir,
			});
	return {
		server: command === "serve" ? getTunnelServerConfig() : undefined,
		plugins: [
			devtools(),
			hugeiconsDeepImports(),
			shikiSSRStub(),
			shikiTrimmedLanguages(),
			betterAuthDialectStub(),
			cloudflare({
				viteEnvironment: { name: "ssr" },
				...worktreePersistState,
				remoteBindings: useCloudflareRemoteBindings,
				...(wranglerConfigPath ? { configPath: wranglerConfigPath } : {}),
			}),
			tsconfigPaths({ projects: ["./tsconfig.json"] }),
			tailwindcss(),
			tanstackStart(),
			viteReact(),
		],
	};
});

export default config;
