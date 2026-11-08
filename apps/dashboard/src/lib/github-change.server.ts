import type { GitHubChangeEntity } from "./github-change-entities";
import {
	entityRepo,
	formatEntityKey,
	parseEntityKey,
} from "./github-change-entities";

/**
 * D1 storage for the change feed (`github_change`).
 *
 * Bounded by design (docs/platform-plan.md, "Incidents"):
 * - rows are useful for 15 minutes; `sweepGitHubChanges` runs from the cron
 *   trigger and deletes older rows in throttled batches;
 * - inserts happen in `waitUntil`, never on a request's critical path, and a
 *   failed insert is logged and dropped;
 * - reads that fail degrade to "cursor expired" (the client refetches its
 *   active queries), never to an error.
 */

export const GITHUB_CHANGE_RETENTION_MS = 15 * 60 * 1000;
/** Cursors older than this are expired: rows after them may be swept. */
const GITHUB_CHANGE_CURSOR_MAX_AGE_MS = GITHUB_CHANGE_RETENTION_MS - 60 * 1000;
/** A response never carries more rows than this; more means "refetch all". */
const GITHUB_CHANGE_READ_LIMIT = 2000;

/** Batch limits that stayed clear of D1's 7429 and query time limits. */
const GITHUB_CHANGE_SWEEP_BATCH_SIZE = 20_000;
const GITHUB_CHANGE_SWEEP_PAUSE_MS = 4_000;
const GITHUB_CHANGE_SWEEP_MAX_BATCHES = 10;

/** Cloudflare's per-database D1 limit. */
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
			repo: entityRepo(entity) ?? repository.fullName,
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

// ---------------------------------------------------------------------------
// Cursors
// ---------------------------------------------------------------------------

export type GitHubChangeCursor = {
	/** Last row id the client has seen. */
	id: number;
	/** When the cursor was issued (epoch ms). */
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type GitHubChangeAccess = {
	/** Repos (lowercased `owner/repo`) the viewer can read. */
	canRead: (repo: string, isPrivate: boolean) => boolean;
	/** Repos the client watches; `null` means every readable repo. */
	watched: Set<string> | null;
};

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

/**
 * Entity keys changed after `since` that the viewer can read and watches.
 *
 * - No cursor: returns a fresh cursor and no entities (first poll).
 * - Cursor older than ~14 minutes, or more than READ_LIMIT rows since it:
 *   `expired: true`, and the client refetches its active queries.
 */
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
	const { since, access } = options;

	if (!since || now - since.at > GITHUB_CHANGE_CURSOR_MAX_AGE_MS) {
		const id = await currentMaxId(db);
		const cursor = encodeChangeCursor({ id, at: now });
		return since
			? { cursor, entities: [], expired: true }
			: { cursor, entities: [], expired: false };
	}

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
		// Notifications are user-wide; everything else only for watched repos.
		if (
			parsed.kind !== "notifications" &&
			access.watched &&
			!access.watched.has(row.repo)
		) {
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

// ---------------------------------------------------------------------------
// Sweeper and guardrails (cron)
// ---------------------------------------------------------------------------

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

export type D1SizeReport = {
	sizeBytes: number | null;
	ratio: number | null;
	changeRows: number | null;
	warning: boolean;
};

/**
 * Database size via the D1 result metadata (`meta.size_after`, the same
 * number `wrangler d1 info` reports) plus the change-table row count. Logs a
 * structured warning at 80% of the 10 GB limit and when the change table has
 * grown far beyond its expected steady state (a stuck sweeper).
 */
export async function checkD1Health(
	db: D1Database,
	options: {
		limitBytes?: number;
		warnRatio?: number;
		maxExpectedChangeRows?: number;
		log?: (line: string) => void;
	} = {},
): Promise<D1SizeReport> {
	const limitBytes = options.limitBytes ?? D1_DATABASE_LIMIT_BYTES;
	const warnRatio = options.warnRatio ?? D1_SIZE_WARN_RATIO;
	const maxExpectedChangeRows = options.maxExpectedChangeRows ?? 50_000;
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

	const sizeWarning = ratio !== null && ratio >= warnRatio;
	const growthWarning =
		changeRows !== null && changeRows > maxExpectedChangeRows;
	if (sizeWarning || growthWarning) {
		log(
			JSON.stringify({
				level: "warn",
				alert: sizeWarning ? "d1_size_warning" : "d1_change_table_growth",
				sizeBytes,
				limitBytes,
				ratio,
				changeRows,
			}),
		);
	}
	return {
		sizeBytes,
		ratio,
		changeRows,
		warning: sizeWarning || growthWarning,
	};
}
