import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `@hugeicons/react@0.3` declares a CJS `main` that is not shipped, so Vite's SSR
// resolver cannot find an entry. Point it at the ESM build for tests only.
const hugeiconsEsm = fileURLToPath(
	new URL(
		"../icons/node_modules/@hugeicons/react/dist/esm/hugeicons-react.js",
		import.meta.url,
	),
);

export default defineConfig({
	resolve: {
		alias: { "@hugeicons/react": hugeiconsEsm },
	},
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
