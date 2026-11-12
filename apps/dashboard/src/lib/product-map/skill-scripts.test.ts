import { execFileSync, spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const scripts = path.resolve(
	import.meta.dirname,
	"../../../../../skills/product-map/scripts",
);

let repo: string;

function run(script: string, args: string[] = []) {
	const result = spawnSync(
		process.execPath,
		[path.join(scripts, script), ...args],
		{
			cwd: repo,
			encoding: "utf8",
			env: { ...process.env, GITHUB_ACTIONS: "" },
		},
	);
	return {
		code: result.status,
		output: `${result.stdout}${result.stderr}`,
	};
}

/** Setup must not go on with a map that was never written. */
function scaffold(args: string[]) {
	const { code, output } = run("scaffold.mjs", args);
	if (code !== 0) throw new Error(output);
}

function git(...args: string[]) {
	execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

function write(file: string, text: string) {
	mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
	writeFileSync(path.join(repo, file), text);
}

const areaFile = (id: string) =>
	path.join(repo, ".diffkit/areas", `${id}.json`);
const readArea = (id: string) =>
	JSON.parse(readFileSync(areaFile(id), "utf8")) as Record<string, unknown>;

/**
 * The scripts run in other people's repositories, driven by an agent. These
 * walk the same path an agent takes, on a throwaway repository.
 */
describe("the product-map skill's scripts", () => {
	beforeAll(() => {
		repo = mkdtempSync(path.join(tmpdir(), "product-map-skill-"));
		git("init", "-q", "-b", "main");
		git("config", "user.email", "test@example.com");
		git("config", "user.name", "Test");
		write("src/auth/session.ts", "export const getSession = () => null;\n");
		write("src/billing/invoice.ts", "export const invoice = 1;\n");
		write("pnpm-lock.yaml", "lock\n");

		scaffold(["init", "--pitch", "A shop for bikes."]);
		for (const [id, name, paths] of [
			["sign-in", "Sign-in", "src/auth/**"],
			["billing", "Billing", "src/billing/**"],
		])
			scaffold([
				"area",
				id,
				"--name",
				name,
				"--tagline",
				"A few words",
				"--summary",
				"What it does for a user.",
				"--paths",
				paths,
				"--band",
				"screens",
				"--band-name",
				"What people use",
				"--group",
				"account",
				"--group-name",
				"Your account",
			]);
		git("add", "-A");
		git("commit", "-q", "-m", "Add a product map");
	});

	afterAll(() => rmSync(repo, { recursive: true, force: true }));

	it("scaffolds a map the checker accepts, and lists what no area covers", () => {
		const { code, output } = run("check.mjs");
		expect(code).toBe(0);
		expect(output).toContain("Product map OK: 2 areas, 2 files placed.");
		expect(output).toContain("pnpm-lock.yaml");
		expect(run("check.mjs", ["--fail-on-unmapped"]).code).toBe(1);
	});

	it("refuses to scaffold an area the format would reject", () => {
		const { code, output } = run("scaffold.mjs", [
			"area",
			"search",
			"--name",
			"Search",
			"--tagline",
			"Find things",
			"--summary",
			"Finds things.",
			"--paths",
			"src/{search",
			"--band",
			"screens",
			"--group",
			"account",
			"--icon",
			"rocket",
		]);
		expect(code).toBe(1);
		expect(output).toContain("Nothing written");
		expect(output).toContain('"icon" must be one of');
		expect(output).toContain("unmatched {");
		expect(run("check.mjs").output).toContain("2 areas");
	});

	it("rejects a field the format does not have", () => {
		const area = readArea("billing");
		writeFileSync(
			areaFile("billing"),
			JSON.stringify({ ...area, owners: ["nova"] }),
		);
		const { code, output } = run("check.mjs");
		expect(code).toBe(1);
		expect(output).toContain('areas/billing.json: unknown field "owners"');
		writeFileSync(areaFile("billing"), JSON.stringify(area, null, 2));
	});

	it("puts keys in the format's order with --fix, once", () => {
		const { name, paths, ...rest } = readArea("sign-in");
		writeFileSync(
			areaFile("sign-in"),
			JSON.stringify({ paths, ...rest, name }, null, 2),
		);
		expect(run("check.mjs", ["--fix"]).output).toContain(
			"Rewrote in canonical order: .diffkit/areas/sign-in.json",
		);
		expect(Object.keys(readArea("sign-in")).slice(0, 4)).toEqual([
			"name",
			"tagline",
			"summary",
			"paths",
		]);
		expect(run("check.mjs", ["--fix"]).output).not.toContain("Rewrote");
	});

	it("says what a change asks of the map, area by area", () => {
		const signIn = readArea("sign-in");
		writeFileSync(
			areaFile("sign-in"),
			JSON.stringify(
				{
					...signIn,
					entryPoints: [{ path: "src/auth/session.ts", role: "Sessions" }],
				},
				null,
				2,
			),
		);
		git("add", "-A");
		git("commit", "-q", "-m", "Describe sign-in");

		expect(run("changed.mjs", ["--base", "HEAD"]).output).toContain(
			"No update needed.",
		);

		git("mv", "src/auth/session.ts", "src/auth/sessions.ts");
		write("src/billing/refund.ts", "export const refund = 1;\n");
		write("src/search/index.ts", "export const search = 1;\n");
		const { output } = run("changed.mjs", ["--base", "HEAD"]);
		expect(output).toContain(
			"areas/sign-in.json, entryPoints: src/auth/session.ts no longer exists",
		);
		expect(output).toContain("### billing (1 file)");
		expect(output).toContain("A src/billing/refund.ts");
		expect(output).toContain("## New files no area covers (1)");
		expect(output).toContain("src/search/index.ts");
	});

	it("moves a code link back onto its symbol when the file grew above it", () => {
		writeFileSync(
			areaFile("sign-in"),
			JSON.stringify(
				{
					...readArea("sign-in"),
					entryPoints: [{ path: "src/auth/sessions.ts", role: "Sessions" }],
				},
				null,
				2,
			),
		);
		const billing = readArea("billing");
		writeFileSync(
			areaFile("billing"),
			JSON.stringify(
				{
					...billing,
					entryPoints: [
						{
							path: "src/billing/invoice.ts",
							line: 1,
							symbol: "invoice",
							role: "Invoices",
						},
					],
				},
				null,
				2,
			),
		);
		write(
			"src/billing/invoice.ts",
			"// Totals are in cents.\n\nexport const invoice = 1;\n",
		);
		expect(run("check.mjs").output).toContain(
			"src/billing/invoice.ts:1 (invoice) is now line 3",
		);
		expect(run("check.mjs", ["--fix"]).output).toContain(
			"Moved 1 code link(s) back onto their symbol",
		);
		expect(readArea("billing").entryPoints).toEqual([
			{
				path: "src/billing/invoice.ts",
				line: 3,
				symbol: "invoice",
				role: "Invoices",
			},
		]);
	});

	it("surveys a repository in a bounded number of lines", () => {
		const { code, output } = run("survey.mjs");
		expect(code).toBe(0);
		expect(output).toContain("## The map today");
		expect(output.split("\n").length).toBeLessThan(200);
	});
});
