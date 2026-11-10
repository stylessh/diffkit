import { afterEach, describe, expect, it, vi } from "vitest";
import { recordGitHubChanges } from "./github-change.server";
import { runScheduledMaintenance } from "./scheduled-maintenance.server";
import { createTestD1 } from "./testing/d1-sqlite";

const NOW = 1_800_000_000_000;

afterEach(() => {
	vi.restoreAllMocks();
});

function quiet() {
	return vi.spyOn(console, "log").mockImplementation(() => undefined);
}

describe("runScheduledMaintenance", () => {
	it("sweeps expired entities, keeps fresh ones and logs one JSON line", async () => {
		const log = quiet();
		const { db } = createTestD1([
			"0006_github_change.sql",
			"0008_github_change_latest.sql",
		]);
		await recordGitHubChanges(db, [
			{
				repo: "a/b",
				entityKey: "repo:a/b",
				isPrivate: true,
				changedAt: NOW - 16 * 60_000,
			},
			{
				repo: "a/b",
				entityKey: "repo:a/b",
				isPrivate: true,
				changedAt: NOW - 20 * 60_000,
			},
			{
				repo: "a/b",
				entityKey: "pull:a/b#1",
				isPrivate: true,
				changedAt: NOW - 60_000,
			},
		]);

		const summary = await runScheduledMaintenance(db, NOW);

		expect(summary).toMatchObject({
			task: "scheduled-maintenance",
			scheduledTime: NOW,
			sweep: { deleted: 1, batches: 1, complete: true },
			changeRows: 1,
		});
		expect(typeof summary.d1SizeBytes).toBe("number");
		expect(log).toHaveBeenCalledTimes(1);
		expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual(summary);
	});

	it("reports a failing task in the log line and never lets it stop the other", async () => {
		quiet();
		const failing = (pattern: string) => {
			const { db } = createTestD1([
				"0006_github_change.sql",
				"0008_github_change_latest.sql",
			]);
			const realPrepare = db.prepare.bind(db);
			db.prepare = ((sql: string) => {
				if (sql.includes(pattern)) throw new Error("D1_ERROR: unavailable");
				return realPrepare(sql);
			}) as D1Database["prepare"];
			return db;
		};

		const sweepDown = await runScheduledMaintenance(failing("DELETE"), NOW);
		expect(sweepDown.sweepError).toContain("unavailable");
		expect(sweepDown.changeRows).toBe(0);

		const healthDown = await runScheduledMaintenance(failing("COUNT(*)"), NOW);
		expect(healthDown.healthError).toContain("unavailable");
		expect(healthDown.sweep).toMatchObject({ complete: true });

		const bothDown = await runScheduledMaintenance(
			failing("github_change"),
			NOW,
		);
		expect(bothDown.sweepError).toBeDefined();
		expect(bothDown.healthError).toBeDefined();
	});
});
