import type { GitHubChangeEntity } from "./github-change-entities";
import { formatEntityKey, parseEntityKey } from "./github-change-entities";

// Storage rules from the 2026-11-08 incident (docs/platform-plan.md): rows
// expire after 15 minutes and the cron sweeper deletes them in throttled
// batches; inserts run in waitUntil and are dropped on failure; read failures
// degrade to "cursor expired", never to an error.

export const GITHUB_CHANGE_RETENTION_MS = 15 * 60 * 1000;
// Rows after a cursor older than this may already be swept.
const GITHUB_CHANGE_CURSOR_MAX_AGE_MS = GITHUB_CHANGE_RETENTION_MS - 60 * 1000;
const GITHUB_CHANGE_READ_LIMIT = 2000;

// Batch limits that stayed clear of D1's 7429 error and per-query time limit.
const GITHUB_CHANGE_SWEEP_BATCH_SIZE = 20_000;
const GITHUB_CHANGE_SWEEP_PAUSE_MS = 4_000;
const GITHUB_CHANGE_SWEEP_MAX_BATCHES = 10;

const D1_DATABASE_LIMIT_BYTES = 10 * 1000 * 1000 * 1000;
const D1_SIZE_WARN_RATIO = 0.8;

export type GitHubChangeRow = {
	repo: string;
	entityKey: string;
	isPrivate: boolean;
	changedAt: number;
};

const INSERT_ROWS_PER_STATEMENT = 20;

export function toGitHubChangeRows(
	entities: GitHubChangeEntity[],
	repository: { fullName: string; isPrivate: boolean },
	changedAt: number,
): GitHubChangeRow[] {
	const seen = new Set<string>();
	const rows: GitHubChangeRow[] = [];
	for (const entity of entities) {
		const entityKey = formatEntityKey(entity);
		if (seen.has(entityKey)) continue;
		seen.add(entityKey);
		rows.push({
			repo: entity.repo,
			entityKey,
			isPrivate: repository.isPrivate,
			changedAt,
		});
	}
	return rows;
}

export async function recordGitHubChanges(
	db: D1Database,
	rows: GitHubChangeRow[],
): Promise<void> {
	if (rows.length === 0) return;
	const statements: D1PreparedStatement[] = [];
	for (let start = 0; start < rows.length; start += INSERT_ROWS_PER_STATEMENT) {
		const chunk = rows.slice(start, start + INSERT_ROWS_PER_STATEMENT);
		statements.push(
			db
				.prepare(
					`INSERT INTO github_change (repo, entity_key, is_private, changed_at) VALUES ${chunk
						.map(() => "(?, ?, ?, ?)")
						.join(", ")}`,
				)
				.bind(
					...chunk.flatMap((row) => [
						row.repo,
						row.entityKey,
						row.isPrivate ? 1 : 0,
						row.changedAt,
					]),
				),
		);
	}
	await db.batch(statements);
}

export type GitHubChangeCursor = {
	id: number;
	at: number;
};

export function encodeChangeCursor(cursor: GitHubChangeCursor) {
	return `${cursor.id.toString(36)}.${cursor.at.toString(36)}`;
}

export function decodeChangeCursor(
	value: string | null | undefined,
): GitHubChangeCursor | null {
	if (!value) return null;
	const match = /^([0-9a-z]{1,12})\.([0-9a-z]{1,12})$/.exec(value);
	if (!match) return null;
	const id = Number.parseInt(match[1], 36);
	const at = Number.parseInt(match[2], 36);
	return Number.isSafeInteger(id) && Number.isSafeInteger(at)
		? { id, at }
		: null;
}

export type GitHubChangeAccess = {
	canRead: (repo: string, isPrivate: boolean) => boolean;
	watched: Set<string> | "all";
};

type CursorState =
	| { kind: "start" }
	| { kind: "stale" }
	| { kind: "live"; since: GitHubChangeCursor };

function classifyCursor(
	since: GitHubChangeCursor | null,
	now: number,
): CursorState {
	if (!since) return { kind: "start" };
	if (now - since.at > GITHUB_CHANGE_CURSOR_MAX_AGE_MS) {
		return { kind: "stale" };
	}
	return { kind: "live", since };
}

export type GitHubChangesResult =
	| { cursor: string; entities: string[]; expired: false }
	| { cursor: string; entities: []; expired: true };

type ChangeRowRecord = {
	id: number;
	repo: string;
	entity_key: string;
	is_private: number;
};

async function currentMaxId(db: D1Database) {
	const row = await db
		.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM github_change")
		.first<{ id: number }>();
	return row?.id ?? 0;
}

export async function readGitHubChanges(
	db: D1Database,
	options: {
		since: GitHubChangeCursor | null;
		access: GitHubChangeAccess;
		now?: number;
		limit?: number;
	},
): Promise<GitHubChangesResult> {
	const now = options.now ?? Date.now();
	const limit = options.limit ?? GITHUB_CHANGE_READ_LIMIT;
	const { access } = options;
	const cursorState = classifyCursor(options.since, now);

	if (cursorState.kind !== "live") {
		const cursor = encodeChangeCursor({ id: await currentMaxId(db), at: now });
		return cursorState.kind === "stale"
			? { cursor, entities: [], expired: true }
			: { cursor, entities: [], expired: false };
	}
	const { since } = cursorState;

	const { results } = await db
		.prepare(
			"SELECT id, repo, entity_key, is_private FROM github_change WHERE id > ? ORDER BY id LIMIT ?",
		)
		.bind(since.id, limit + 1)
		.all<ChangeRowRecord>();

	if (results.length > limit) {
		const id = await currentMaxId(db);
		return {
			cursor: encodeChangeCursor({ id, at: now }),
			entities: [],
			expired: true,
		};
	}

	let lastId = since.id;
	const entities = new Set<string>();
	for (const row of results) {
		lastId = Math.max(lastId, row.id);
		if (!access.canRead(row.repo, row.is_private !== 0)) continue;
		const parsed = parseEntityKey(row.entity_key);
		if (!parsed) continue;
		if (access.watched !== "all" && !access.watched.has(row.repo)) {
			continue;
		}
		entities.add(row.entity_key);
	}

	return {
		cursor: encodeChangeCursor({ id: lastId, at: now }),
		entities: [...entities],
		expired: false,
	};
}

export async function sweepGitHubChanges(
	db: D1Database,
	options: {
		now?: number;
		batchSize?: number;
		pauseMs?: number;
		maxBatches?: number;
		sleep?: (ms: number) => Promise<void>;
	} = {},
): Promise<{ deleted: number; batches: number; complete: boolean }> {
	const now = options.now ?? Date.now();
	const batchSize = Math.min(
		options.batchSize ?? GITHUB_CHANGE_SWEEP_BATCH_SIZE,
		GITHUB_CHANGE_SWEEP_BATCH_SIZE,
	);
	const pauseMs = options.pauseMs ?? GITHUB_CHANGE_SWEEP_PAUSE_MS;
	const maxBatches = options.maxBatches ?? GITHUB_CHANGE_SWEEP_MAX_BATCHES;
	const sleep =
		options.sleep ??
		((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const cutoff = now - GITHUB_CHANGE_RETENTION_MS;

	let deleted = 0;
	let batches = 0;
	while (batches < maxBatches) {
		if (batches > 0) await sleep(pauseMs);
		const result = await db
			.prepare(
				"DELETE FROM github_change WHERE id IN (SELECT id FROM github_change WHERE changed_at < ? ORDER BY id LIMIT ?)",
			)
			.bind(cutoff, batchSize)
			.run();
		batches += 1;
		const changes = result.meta.changes ?? 0;
		deleted += changes;
		if (changes < batchSize) {
			return { deleted, batches, complete: true };
		}
	}
	return { deleted, batches, complete: false };
}

type D1Alert = "d1_size_warning" | "d1_change_table_growth";

export type D1HealthReport = {
	sizeBytes: number | null;
	ratio: number | null;
	changeRows: number | null;
	alert: D1Alert | null;
};

function pickD1Alert(
	ratio: number | null,
	warnRatio: number,
	changeRows: number | null,
	maxExpectedChangeRows: number,
): D1Alert | null {
	if (ratio !== null && ratio >= warnRatio) return "d1_size_warning";
	if (changeRows !== null && changeRows > maxExpectedChangeRows) {
		return "d1_change_table_growth";
	}
	return null;
}

// Size is D1's meta.size_after, the number `wrangler d1 info` reports. A large
// change table means the sweeper is stuck.
export async function checkD1Health(
	db: D1Database,
	options: {
		limitBytes?: number;
		warnRatio?: number;
		maxExpectedChangeRows?: number;
		log?: (line: string) => void;
	} = {},
): Promise<D1HealthReport> {
	const limitBytes = options.limitBytes ?? D1_DATABASE_LIMIT_BYTES;
	const log = options.log ?? ((line: string) => console.warn(line));

	const countResult = await db
		.prepare("SELECT COUNT(*) AS count FROM github_change")
		.all<{ count: number }>();
	const changeRows = countResult.results[0]?.count ?? null;
	const sizeBytes =
		typeof countResult.meta.size_after === "number"
			? countResult.meta.size_after
			: null;
	const ratio = sizeBytes === null ? null : sizeBytes / limitBytes;
	const alert = pickD1Alert(
		ratio,
		options.warnRatio ?? D1_SIZE_WARN_RATIO,
		changeRows,
		options.maxExpectedChangeRows ?? 50_000,
	);

	if (alert) {
		log(
			JSON.stringify({
				level: "warn",
				alert,
				sizeBytes,
				limitBytes,
				ratio,
				changeRows,
			}),
		);
	}
	return { sizeBytes, ratio, changeRows, alert };
}
