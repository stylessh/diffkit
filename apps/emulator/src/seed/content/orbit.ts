import type { RepoSpec } from "../types.ts";
import { ciJobs } from "./ci.ts";

const rootPackage = (turbo: string, ts: string) => `{
	"name": "orbit",
	"private": true,
	"packageManager": "pnpm@10.15.0",
	"scripts": {
		"build": "turbo run build",
		"dev": "turbo run dev",
		"lint": "turbo run lint",
		"test": "turbo run test"
	},
	"devDependencies": {
		"turbo": "${turbo}",
		"typescript": "${ts}"
	}
}
`;

const workspace = `packages:
  - "apps/*"
  - "packages/*"
`;

const turboJson = `{
	"$schema": "https://turborepo.com/schema.json",
	"tasks": {
		"build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
		"dev": { "cache": false, "persistent": true },
		"lint": {},
		"test": { "dependsOn": ["^build"] }
	}
}
`;

const readme = `# Orbit

Lumen Labs' design system and the apps that use it.

| Path              | What                              |
| ----------------- | --------------------------------- |
| \`packages/ui\`     | React components (\`@orbit/ui\`)    |
| \`packages/tokens\` | Colors, spacing and type tokens   |
| \`apps/docs\`       | Component docs site               |

\`\`\`sh
pnpm install
pnpm dev --filter docs
\`\`\`
`;

const tokensColors = `export const colors = {
	gray: {
		50: "#f8fafc",
		100: "#f1f5f9",
		500: "#64748b",
		900: "#0f172a",
	},
	accent: {
		400: "#2dd4bf",
		500: "#14b8a6",
		600: "#0d9488",
	},
	danger: {
		500: "#ef4444",
		600: "#dc2626",
	},
} as const;

export type ColorScale = keyof typeof colors;
`;

const tokensSpacing = `/** 4px grid. */
export const space = {
	0: "0px",
	1: "4px",
	2: "8px",
	3: "12px",
	4: "16px",
	6: "24px",
	8: "32px",
} as const;
`;

const tokensIndex = `export { colors, type ColorScale } from "./colors";
export { space } from "./spacing";
`;

const pkg = (name: string, deps = "") => `{
	"name": "${name}",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"main": "./src/index.ts"${deps}
}
`;

const buttonV1 = `import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "ghost";
	size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
				size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4",
				variant === "primary" && "bg-accent-600 text-white hover:bg-accent-500",
				variant === "secondary" && "bg-gray-100 text-gray-900 hover:bg-gray-50",
				variant === "ghost" && "text-gray-900 hover:bg-gray-100",
				className,
			)}
			{...props}
		/>
	);
}
`;

const buttonLoading = buttonV1
	.replace(
		'import { cn } from "./cn";',
		'import { cn } from "./cn";\nimport { Spinner } from "./spinner";',
	)
	.replace(
		'\tsize?: "sm" | "md";\n};',
		'\tsize?: "sm" | "md";\n\t/** Shows a spinner and disables the button. */\n\tloading?: boolean;\n};',
	)
	.replace(
		'export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {',
		'export function Button({\n\tvariant = "primary",\n\tsize = "md",\n\tloading = false,\n\tdisabled,\n\tclassName,\n\tchildren,\n\t...props\n}: ButtonProps) {',
	)
	.replace(
		"\t\t\t{...props}\n\t\t/>\n",
		'\t\t\tdisabled={disabled || loading}\n\t\t\taria-busy={loading || undefined}\n\t\t\t{...props}\n\t\t>\n\t\t\t{loading ? <Spinner className="size-4" /> : null}\n\t\t\t{children}\n\t\t</button>\n',
	);

const focusRing = buttonV1.replace(
	'"inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",',
	'"inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",\n\t\t\t\t"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2",',
);

const spinner = `import { cn } from "./cn";

export function Spinner({ className }: { className?: string }) {
	return (
		<svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
			<path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" />
		</svg>
	);
}
`;

const cnFile = `export function cn(...values: Array<string | false | null | undefined>) {
	return values.filter(Boolean).join(" ");
}
`;

const uiIndex = `export { Button } from "./button";
export { cn } from "./cn";
`;

const docsPage = `import { Button } from "@orbit/ui";

export default function Page() {
	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-6 p-10">
			<h1 className="text-3xl font-semibold">Orbit</h1>
			<p className="text-gray-500">Components for Lumen Labs products.</p>
			<div className="flex gap-3">
				<Button>Primary</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="ghost">Ghost</Button>
			</div>
		</main>
	);
}
`;

const ci = `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
`;

export const orbit: RepoSpec = {
	owner: "lumen-labs",
	name: "orbit",
	description: "Lumen Labs' design system: tokens, React components and docs.",
	language: "TypeScript",
	languages: { TypeScript: 31_877, CSS: 4_210, JavaScript: 902 },
	topics: ["design-system", "react", "monorepo", "turborepo"],
	license: {
		key: "apache-2.0",
		name: "Apache License 2.0",
		spdx_id: "Apache-2.0",
	},
	stars: 342,
	forks: 19,
	watchers: 17,
	labels: [
		{ name: "bug", color: "d73a4a" },
		{ name: "a11y", color: "0e8a16", description: "Accessibility" },
		{ name: "component", color: "1d76db" },
		{ name: "dependencies", color: "0366d6" },
		{ name: "docs", color: "0075ca" },
	],
	milestones: [
		{ title: "Orbit 1.0", description: "Stable component API", dueIn: 35 },
	],
	commits: [
		{
			message: "Scaffold pnpm + turbo monorepo",
			author: "priya-rao",
			at: { d: 58, h: 4 },
			files: {
				"package.json": rootPackage("2.4.4", "5.7.2"),
				"pnpm-workspace.yaml": workspace,
				"turbo.json": turboJson,
				"README.md": readme,
			},
		},
		{
			message: "Add color and spacing tokens",
			author: "priya-rao",
			at: { d: 55, h: 6 },
			files: {
				"packages/tokens/package.json": pkg("@orbit/tokens"),
				"packages/tokens/src/colors.ts": tokensColors,
				"packages/tokens/src/spacing.ts": tokensSpacing,
				"packages/tokens/src/index.ts": tokensIndex,
			},
		},
		{
			message: "Add Button component",
			author: "priya-rao",
			at: { d: 49, h: 3 },
			files: {
				"packages/ui/package.json": pkg(
					"@orbit/ui",
					',\n\t"peerDependencies": {\n\t\t"react": "^19.0.0"\n\t}',
				),
				"packages/ui/src/button.tsx": buttonV1,
				"packages/ui/src/cn.ts": cnFile,
				"packages/ui/src/index.ts": uiIndex,
			},
		},
		{
			message: "Add docs app",
			author: "nova",
			at: { d: 44, h: 7 },
			files: {
				"apps/docs/package.json": pkg(
					"docs",
					',\n\t"dependencies": {\n\t\t"@orbit/ui": "workspace:*",\n\t\t"next": "15.5.2"\n\t}',
				),
				"apps/docs/app/page.tsx": docsPage,
			},
		},
		{
			message: "Add CI",
			author: "sam-okafor",
			at: { d: 40, h: 2 },
			files: { ".github/workflows/ci.yml": ci },
		},
		{
			message: "Add danger color scale",
			author: "priya-rao",
			at: { d: 19, h: 5 },
			files: { "packages/tokens/src/colors.ts": tokensColors },
		},
	],
	branches: [
		{
			name: "chore/typescript-5.9",
			commits: [
				{
					message: "Upgrade TypeScript to 5.9 and turbo to 2.9",
					author: "sam-okafor",
					at: { d: 12, h: 4 },
					files: { "package.json": rootPackage("2.9.4", "5.9.3") },
				},
			],
		},
		{
			name: "fix/focus-ring",
			commits: [
				{
					message: "Add a visible focus ring to Button",
					author: "priya-rao",
					at: { d: 3, h: 6 },
					files: { "packages/ui/src/button.tsx": focusRing },
				},
			],
		},
		{
			name: "feat/button-loading",
			commits: [
				{
					message: "Add Spinner",
					author: "priya-rao",
					at: { d: 2, h: 5 },
					files: { "packages/ui/src/spinner.tsx": spinner },
				},
				{
					message: "Add loading state to Button",
					author: "priya-rao",
					at: { d: 1, h: 9 },
					files: { "packages/ui/src/button.tsx": buttonLoading },
				},
			],
		},
	],
	issues: [
		{
			key: "contrast",
			title: "Ghost button text fails contrast on gray-100",
			author: "priya-rao",
			at: { d: 16, h: 2 },
			labels: ["bug", "a11y", "component"],
			milestone: "Orbit 1.0",
			assignees: ["priya-rao"],
			body: "`text-gray-900` on hover background `gray-100` is fine, but disabled ghost buttons drop to 2.8:1.",
		},
		{
			key: "loading",
			title: "Button needs a loading state",
			author: "nova",
			at: { d: 7, h: 4 },
			labels: ["component"],
			milestone: "Orbit 1.0",
			assignees: ["priya-rao"],
			body: "Forms in the dashboard double-submit. A `loading` prop that disables the button and shows a spinner would cover most cases.",
			reactions: { THUMBS_UP: ["jun-park", "sam-okafor", "lena-fischer"] },
		},
		{
			key: "docs-search",
			title: "Docs site: add search",
			author: "lena-fischer",
			at: { d: 6, h: 1 },
			labels: ["docs"],
			body: "With 20+ components it's getting hard to find things. Pagefind would work with the static export.",
		},
		{
			key: "beacon-leak",
			title: "Docs site memory grows on every navigation",
			author: "priya-rao",
			at: { d: 3, h: 5 },
			labels: ["bug"],
			assignees: ["nova"],
			body: "Probably lumen-labs/beacon#{issue:memory-leak@beacon} — the status badge subscribes on every route change.",
		},
	],
	pulls: [
		{
			head: "chore/typescript-5.9",
			title: "Upgrade TypeScript to 5.9 and turbo to 2.9",
			author: "sam-okafor",
			at: { d: 12, h: 3 },
			state: "merged",
			closedAt: { d: 10, h: 6 },
			mergedBy: "priya-rao",
			labels: ["dependencies"],
			body: "Routine bump. No code changes needed.",
			reviews: [
				{ author: "priya-rao", state: "APPROVED", at: { d: 10, h: 7 } },
			],
		},
		{
			head: "fix/focus-ring",
			title: "Add a visible focus ring to Button",
			author: "priya-rao",
			at: { d: 3, h: 5 },
			labels: ["a11y", "component"],
			milestone: "Orbit 1.0",
			body: "Keyboard users had no focus indicator. Uses `focus-visible` so mouse clicks don't show the ring.",
			reviews: [
				{
					author: "nova",
					state: "APPROVED",
					at: { d: 2, h: 8 },
					body: "Much better. Ship it.",
				},
			],
		},
		{
			head: "feat/button-loading",
			title: "Add a loading state to Button",
			author: "priya-rao",
			at: { d: 1, h: 8 },
			labels: ["component"],
			milestone: "Orbit 1.0",
			assignees: ["nova"],
			reviewers: ["nova"],
			body: "Closes #{issue:loading}\n\n- Adds `loading` prop (disables + `aria-busy`)\n- New `Spinner` component\n\n@nova assigned you since you filed the issue.",
		},
	],
	workflows: [{ name: "CI", path: ".github/workflows/ci.yml" }],
	runs: [
		{
			workflow: "CI",
			branch: "chore/typescript-5.9",
			event: "pull_request",
			at: { d: 12, h: 3 },
			actor: "sam-okafor",
			jobs: ciJobs({ nodes: [20, 22] }),
		},
		{
			workflow: "CI",
			branch: "fix/focus-ring",
			event: "pull_request",
			at: { d: 3, h: 5 },
			actor: "priya-rao",
			jobs: ciJobs({ nodes: [20, 22] }),
		},
		{
			workflow: "CI",
			branch: "feat/button-loading",
			event: "pull_request",
			at: { d: 1, h: 8 },
			actor: "priya-rao",
			jobs: ciJobs({ nodes: [20, 22] }),
		},
	],
};
