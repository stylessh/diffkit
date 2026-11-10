import { describe, expect, it, vi } from "vitest";
import {
	checkD1Health,
	decodeChangeCursor,
	encodeChangeCursor,
	GITHUB_CHANGE_RETENTION_MS,
	type GitHubChangeAccess,
	readGitHubChanges,
	recordGitHubChanges,
	sweepGitHubChanges,
	toGitHubChangeRows,
} from "./github-change.server";
import { getWebhookChangeEntities } from "./github-change-entities";
import { createTestD1 } from "./testing/d1-sqlite";

const NOW = 1_800_000_000_000;

function setup() {
	return createTestD1([
		"0006_github_change.sql",
		"0008_github_change_latest.sql",
	]);
}

const everything: GitHubChangeAccess = {
	canRead: () => true,
	watched: "all",
};

async function insert(
	db: D1Database,
	rows: Array<
		[repo: string, entityKey: string, isPrivate: boolean, at?: number]
	>,
) {
	await recordGitHubChanges(
		db,
		rows.map(([repo, entityKey, isPrivate, at]) => ({
			repo,
			entityKey,
			isPrivate,
			changedAt: at ?? NOW,
		})),
	);
}

describe("change cursor", () => {
	it("round-trips and rejects garbage", () => {
		const cursor = { version: 12345, at: NOW };
		expect(decodeChangeCursor(encodeChangeCursor(cursor))).toEqual(cursor);
		expect(decodeChangeCursor("nope")).toBeNull();
		expect(decodeChangeCursor("")).toBeNull();
		expect(decodeChangeCursor(null)).toBeNull();
	});
});

describe("readGitHubChanges", () => {
	it("issues a cursor on the first poll and returns later changes", async () => {
		const { db } = setup();
		await insert(db, [["acme/api", "pull:acme/api#1", true]]);

		const first = await readGitHubChanges(db, {
			since: null,
			access: everything,
			now: NOW,
		});
		expect(first).toMatchObject({ entities: [], expired: false });

		await insert(db, [
			["acme/api", "pull:acme/api#2", true],
			["acme/api", "pull:acme/api#2", true],
		]);
		const second = await readGitHubChanges(db, {
			since: decodeChangeCursor(first.cursor),
			access: everything,
			now: NOW + 1_000,
		});
		expect(second.entities).toEqual(["pull:acme/api#2"]);

		const third = await readGitHubChanges(db, {
			since: decodeChangeCursor(second.cursor),
			access: everything,
			now: NOW + 2_000,
		});
		expect(third.entities).toEqual([]);
	});

	it("keeps one row per entity and reports each new change to it once", async () => {
		const { db, sqlite } = setup();
		const start = await readGitHubChanges(db, {
			since: null,
			access: everything,
			now: NOW,
		});

		for (const at of [NOW, NOW + 100, NOW + 200]) {
			await insert(db, [["acme/api", "checks:acme/api@abc1234", false, at]]);
		}
		expect(
			sqlite.prepare("SELECT COUNT(*) AS n FROM github_change").get(),
		).toEqual({ n: 1 });

		const first = await readGitHubChanges(db, {
			since: decodeChangeCursor(start.cursor),
			access: everything,
			now: NOW + 1_000,
		});
		expect(first.entities).toEqual(["checks:acme/api@abc1234"]);

		await insert(db, [["acme/api", "checks:acme/api@abc1234", false]]);
		const second = await readGitHubChanges(db, {
			since: decodeChangeCursor(first.cursor),
			access: everything,
			now: NOW + 2_000,
		});
		expect(second.entities).toEqual(["checks:acme/api@abc1234"]);
	});

	it("expires a cursor that is ahead of the table, such as one issued before a reset", async () => {
		const { db } = setup();
		await insert(db, [["acme/api", "pull:acme/api#1", true]]);
		const result = await readGitHubChanges(db, {
			since: { version: 1_400_000, at: NOW },
			access: everything,
			now: NOW,
		});
		expect(result.expired).toBe(true);
		expect(decodeChangeCursor(result.cursor)).toEqual({ version: 1, at: NOW });
	});

	it("only returns private-repo changes the viewer can read", async () => {
		const { db } = setup();
		const readable = new Set(["acme/api"]);
		const access: GitHubChangeAccess = {
			canRead: (repo, isPrivate) => !isPrivate || readable.has(repo),
			watched: "all",
		};
		await insert(db, [
			["acme/api", "pull:acme/api#1", true],
			["acme/secret", "pull:acme/secret#9", true],
			["acme/secret", "notifications", true],
			["oss/lib", "issue:oss/lib#3", false],
		]);
		const result = await readGitHubChanges(db, {
			since: { version: 0, at: NOW },
			access,
			now: NOW,
		});
		expect(result.entities.sort()).toEqual([
			"issue:oss/lib#3",
			"pull:acme/api#1",
		]);
	});

	it("limits entities to watched repos and ignores legacy notifications rows", async () => {
		const { db } = setup();
		await insert(db, [
			["acme/api", "pull:acme/api#1", true],
			["acme/web", "pull:acme/web#2", true],
			["acme/web", "notifications", true],
		]);
		const result = await readGitHubChanges(db, {
			since: { version: 0, at: NOW },
			access: { canRead: () => true, watched: new Set(["acme/api"]) },
			now: NOW,
		});
		expect(result.entities).toEqual(["pull:acme/api#1"]);
	});

	it("expires cursors older than the retention window", async () => {
		const { db } = setup();
		await insert(db, [["acme/api", "pull:acme/api#1", true]]);
		const result = await readGitHubChanges(db, {
			since: { version: 0, at: NOW - GITHUB_CHANGE_RETENTION_MS },
			access: everything,
			now: NOW,
		});
		expect(result.expired).toBe(true);
		expect(decodeChangeCursor(result.cursor)).toEqual({ version: 1, at: NOW });
	});

	it("reports overflow as expired instead of returning a huge page", async () => {
		const { db } = setup();
		await insert(
			db,
			Array.from({ length: 5 }, (_, i) => [
				"acme/api",
				`pull:acme/api#${i + 1}`,
				true,
			]),
		);
		const result = await readGitHubChanges(db, {
			since: { version: 0, at: NOW },
			access: everything,
			now: NOW,
			limit: 3,
		});
		expect(result.expired).toBe(true);
	});
});

describe("toGitHubChangeRows", () => {
	it("turns a webhook into deduplicated rows", () => {
		const entities = getWebhookChangeEntities("check_suite", {
			repository: { name: "Api", owner: { login: "Acme" }, private: false },
			check_suite: {
				head_sha: "ABCDEF1234567",
				pull_requests: [{ number: 3 }, { number: 3 }],
			},
		});
		expect(
			toGitHubChangeRows(
				entities,
				{ fullName: "acme/api", isPrivate: false },
				NOW,
			),
		).toEqual([
			{
				repo: "acme/api",
				entityKey: "checks:acme/api@abcdef1234567",
				isPrivate: false,
				changedAt: NOW,
			},
			{
				repo: "acme/api",
				entityKey: "pull:acme/api#3",
				isPrivate: false,
				changedAt: NOW,
			},
		]);
	});
});

describe("sweepGitHubChanges", () => {
	it("deletes only rows past retention, in bounded batches with pauses", async () => {
		const { db, sqlite } = setup();
		const old = NOW - GITHUB_CHANGE_RETENTION_MS - 1;
		await insert(
			db,
			Array.from({ length: 25 }, (_, i) => [
				"acme/api",
				`pull:acme/api#${i}`,
				true,
				old,
			]),
		);
		await insert(db, [["acme/api", "pull:acme/api#999", true, NOW]]);

		const sleep = vi.fn(async () => undefined);
		const result = await sweepGitHubChanges(db, {
			now: NOW,
			batchSize: 10,
			pauseMs: 4_000,
			sleep,
		});
		expect(result).toEqual({ deleted: 25, batches: 3, complete: true });
		expect(sleep).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(4_000);
		const remaining = sqlite
			.prepare("SELECT entity_key FROM github_change")
			.all() as { entity_key: string }[];
		expect(remaining.map((row) => row.entity_key)).toEqual([
			"pull:acme/api#999",
		]);
	});

	it("keeps the newest row so versions never go backwards", async () => {
		const { db } = setup();
		const old = NOW - GITHUB_CHANGE_RETENTION_MS - 1;
		await insert(db, [
			["acme/api", "pull:acme/api#1", true, old],
			["acme/api", "pull:acme/api#2", true, old],
		]);
		const before = await readGitHubChanges(db, {
			since: null,
			access: everything,
			now: NOW,
		});

		const result = await sweepGitHubChanges(db, {
			now: NOW,
			sleep: async () => undefined,
		});
		expect(result.deleted).toBe(1);

		await insert(db, [["acme/api", "pull:acme/api#3", true]]);
		const after = await readGitHubChanges(db, {
			since: decodeChangeCursor(before.cursor),
			access: everything,
			now: NOW + 1_000,
		});
		expect(after.entities).toEqual(["pull:acme/api#3"]);
	});

	it("stops after maxBatches and reports the sweep as incomplete", async () => {
		const { db } = setup();
		const old = NOW - GITHUB_CHANGE_RETENTION_MS - 1;
		await insert(
			db,
			Array.from({ length: 30 }, (_, i) => [
				"acme/api",
				`pull:acme/api#${i}`,
				true,
				old,
			]),
		);
		const result = await sweepGitHubChanges(db, {
			now: NOW,
			batchSize: 10,
			maxBatches: 2,
			sleep: async () => undefined,
		});
		expect(result).toEqual({ deleted: 20, batches: 2, complete: false });
	});

	it("never deletes more than 20k rows per statement", async () => {
		const { db } = setup();
		const bound: unknown[][] = [];
		const spied = {
			...db,
			prepare: (sql: string) => {
				const statement = db.prepare(sql);
				return {
					...statement,
					bind: (...params: unknown[]) => {
						if (sql.startsWith("DELETE")) bound.push(params);
						return statement.bind(...params);
					},
				};
			},
		} as unknown as D1Database;
		await sweepGitHubChanges(spied, {
			now: NOW,
			batchSize: 1_000_000,
			sleep: async () => undefined,
		});
		expect(bound).toEqual([[NOW - GITHUB_CHANGE_RETENTION_MS, 20_000]]);
	});
});

describe("checkD1Health", () => {
	it("warns at 80% of the size limit", async () => {
		const { db } = setup();
		const lines: string[] = [];
		const report = await checkD1Health(db, {
			limitBytes: 1,
			log: (line) => lines.push(line),
		});
		expect(report.alert).toBe("d1_size_warning");
		expect(JSON.parse(lines[0])).toMatchObject({ alert: "d1_size_warning" });
	});

	it("flags a change table the sweeper has stopped keeping small", async () => {
		const { db } = setup();
		await insert(db, [
			["acme/api", "pull:acme/api#1", true],
			["acme/api", "pull:acme/api#2", true],
		]);
		const lines: string[] = [];
		const report = await checkD1Health(db, {
			maxExpectedChangeRows: 1,
			log: (line) => lines.push(line),
		});
		expect(report.alert).toBe("d1_change_table_growth");
		expect(JSON.parse(lines[0])).toMatchObject({
			alert: "d1_change_table_growth",
			changeRows: 2,
		});
	});

	it("stays quiet when healthy", async () => {
		const { db } = setup();
		const lines: string[] = [];
		const report = await checkD1Health(db, { log: (line) => lines.push(line) });
		expect(report.alert).toBeNull();
		expect(report.sizeBytes).toBeGreaterThan(0);
		expect(report.changeRows).toBe(0);
		expect(lines).toEqual([]);
	});
});
