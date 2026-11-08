import type { JobSpec, StepSpec } from "../types.ts";

type Outcome = "success" | "failure" | "skipped" | "cancelled" | null;

function setupSteps(extra: StepSpec[]): StepSpec[] {
	return [
		{
			name: "Set up job",
			seconds: 2,
			log: [
				"Current runner version: '2.321.0'",
				"Operating System",
				"  Ubuntu 24.04.1 LTS",
				"Runner Image: ubuntu-24.04",
				"Secret source: Actions",
				"Prepare workflow directory",
				"Prepare all required actions",
				"Getting action download info",
				"Download action repository 'actions/checkout@v4'",
				"Download action repository 'pnpm/action-setup@v4'",
				"Complete job name: setup",
			],
		},
		{
			name: "Run actions/checkout@v4",
			seconds: 1,
			log: [
				"Syncing repository",
				"Getting Git version info",
				"Fetching the repository",
				"[command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin",
				"Checking out the ref",
			],
		},
		{
			name: "Run pnpm install --frozen-lockfile",
			seconds: 9,
			log: [
				"Lockfile is up to date, resolution step is skipped",
				"Progress: resolved 214, reused 214, downloaded 0, added 214, done",
				"",
				"devDependencies:",
				"+ @biomejs/biome 2.4.5",
				"+ tsup 8.5.0",
				"+ typescript 5.9.3",
				"+ vitest 3.2.4",
				"",
				"Done in 4.1s using pnpm v10.15.0",
			],
		},
		...extra,
		{ name: "Complete job", seconds: 1, log: ["Cleaning up orphan processes"] },
	];
}

export function lintJob(outcome: Outcome = "success"): JobSpec {
	return {
		name: "lint",
		conclusion: outcome,
		steps: setupSteps([
			{
				name: "Run pnpm lint",
				conclusion: outcome,
				seconds: 3,
				log:
					outcome === "failure"
						? [
								"> biome check .",
								"src/client.ts:42:7 lint/style/useConst ━━━━━━━━━━━━━━━━━━━━━━━━",
								"  ✖ This let declares a variable that is only assigned once.",
								"Checked 14 files in 38ms. No fixes applied.",
								"Found 1 error.",
								"Error: Process completed with exit code 1.",
							]
						: [
								"> biome check .",
								"Checked 14 files in 36ms. No fixes applied.",
							],
			},
		]),
	};
}

export function testJob(node: number, outcome: Outcome = "success"): JobSpec {
	const passing = [
		"> vitest run",
		"",
		" RUN  v3.2.4 /home/runner/work/beacon/beacon",
		"",
		" ✓ src/__tests__/backoff.test.ts (3 tests) 4ms",
		" ✓ src/__tests__/client.test.ts (6 tests) 31ms",
		"",
		" Test Files  2 passed (2)",
		"      Tests  9 passed (9)",
		"   Duration  612ms",
	];
	const failing = [
		"> vitest run",
		"",
		" RUN  v3.2.4 /home/runner/work/beacon/beacon",
		"",
		" ✓ src/__tests__/backoff.test.ts (3 tests) 5ms",
		" ❯ src/__tests__/client.test.ts (6 tests | 1 failed) 1042ms",
		"   × reconnects after the socket closes 1003ms",
		"",
		"⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
		"",
		" FAIL  src/__tests__/client.test.ts > createClient > reconnects after the socket closes",
		"Error: Test timed out in 1000ms.",
		" ❯ src/__tests__/client.test.ts:58:3",
		"",
		" Test Files  1 failed | 1 passed (2)",
		"      Tests  1 failed | 8 passed (9)",
		"Error: Process completed with exit code 1.",
	];
	return {
		name: `test (${node})`,
		conclusion: outcome,
		steps: setupSteps([
			{
				name: `Run actions/setup-node@v4 (node ${node})`,
				seconds: 2,
				log: [
					`Attempting to download ${node}.x...`,
					`Acquiring ${node}.18.0 - x64`,
					"Adding to the cache ...",
				],
			},
			{
				name: "Run pnpm test",
				conclusion: outcome,
				seconds: outcome === "failure" ? 14 : 6,
				log: outcome === "failure" ? failing : passing,
			},
		]),
	};
}

export function buildJob(outcome: Outcome = "success"): JobSpec {
	return {
		name: "build",
		conclusion: outcome,
		steps:
			outcome === "skipped"
				? []
				: setupSteps([
						{
							name: "Run pnpm build",
							conclusion: outcome,
							seconds: 5,
							log: [
								"> tsup src/index.ts --format esm --dts",
								"CLI Building entry: src/index.ts",
								"CLI Using tsconfig: tsconfig.json",
								"ESM Build start",
								"ESM dist/index.js 4.21 KB",
								"ESM ⚡️ Build success in 18ms",
								"DTS Build start",
								"DTS ⚡️ Build success in 612ms",
								"DTS dist/index.d.ts 1.38 KB",
							],
						},
					]),
	};
}

export function ciJobs(opts: {
	lint?: Outcome;
	nodes?: number[];
	failNode?: number;
	build?: Outcome;
}): JobSpec[] {
	const nodes = opts.nodes ?? [18, 20, 22];
	const tests = nodes.map((node) =>
		testJob(node, opts.failNode === node ? "failure" : "success"),
	);
	const failed = opts.lint === "failure" || opts.failNode !== undefined;
	return [
		lintJob(opts.lint ?? "success"),
		...tests,
		buildJob(opts.build ?? (failed ? "skipped" : "success")),
	];
}

export function inProgressJobs(): JobSpec[] {
	return [
		lintJob("success"),
		{ ...testJob(20), conclusion: null },
		{ ...testJob(22), conclusion: null },
		{ name: "build", conclusion: null, steps: [] },
	];
}

export function publishJob(): JobSpec {
	return {
		name: "publish",
		conclusion: "success",
		steps: setupSteps([
			{
				name: "Run pnpm build",
				seconds: 5,
				log: [
					"> tsup src/index.ts --format esm --dts",
					"ESM ⚡️ Build success in 17ms",
				],
			},
			{
				name: "Run pnpm publish --provenance --no-git-checks",
				seconds: 7,
				log: [
					"npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access",
					"npm notice package: @lumen/beacon@1.3.0",
					"npm notice Signed provenance statement with source and build information from GitHub Actions",
					"+ @lumen/beacon@1.3.0",
				],
			},
		]),
	};
}
