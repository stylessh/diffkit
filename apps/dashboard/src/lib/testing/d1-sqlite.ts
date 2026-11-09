// Loaded through process.getBuiltinModule: the Cloudflare Vite plugin aliases
// `node:` imports to unenv stubs, which have no sqlite.
const { readFileSync } = process.getBuiltinModule(
	"node:fs",
) as typeof import("node:fs");
const { DatabaseSync } = process.getBuiltinModule(
	"node:sqlite",
) as typeof import("node:sqlite");

export function createTestD1(migrations: string[] = []) {
	const sqlite = new DatabaseSync(":memory:");
	for (const file of migrations) {
		const sql = readFileSync(
			new URL(`../../../db/migrations/${file}`, import.meta.url),
			"utf8",
		);
		for (const statement of sql.split("--> statement-breakpoint")) {
			if (statement.trim()) sqlite.exec(statement);
		}
	}

	const sizeAfter = () => {
		const pageCount = sqlite.prepare("PRAGMA page_count").get() as {
			page_count: number;
		};
		const pageSize = sqlite.prepare("PRAGMA page_size").get() as {
			page_size: number;
		};
		return pageCount.page_count * pageSize.page_size;
	};

	const statementCalls: string[] = [];

	const makeStatement = (sql: string, params: unknown[] = []) => {
		const statement = {
			sql,
			bind: (...next: unknown[]) => makeStatement(sql, next),
			all: async () => {
				statementCalls.push(sql);
				const results = sqlite
					.prepare(sql)
					.all(...(params as never[])) as Record<string, unknown>[];
				return {
					results,
					success: true,
					meta: { changes: 0, size_after: sizeAfter() },
				};
			},
			first: async () => {
				statementCalls.push(sql);
				return (sqlite.prepare(sql).get(...(params as never[])) ??
					null) as Record<string, unknown> | null;
			},
			// drizzle's d1 driver reads rows through `raw()` (arrays, not objects).
			raw: async () => {
				statementCalls.push(sql);
				const prepared = sqlite.prepare(sql);
				prepared.setReturnArrays(true);
				return prepared.all(...(params as never[])) as unknown as unknown[][];
			},
			run: async () => {
				statementCalls.push(sql);
				const result = sqlite.prepare(sql).run(...(params as never[]));
				return {
					results: [],
					success: true,
					meta: {
						changes: Number(result.changes),
						last_row_id: Number(result.lastInsertRowid),
						size_after: sizeAfter(),
					},
				};
			},
		};
		return statement;
	};

	const db = {
		prepare: (sql: string) => makeStatement(sql),
		batch: async (statements: ReturnType<typeof makeStatement>[]) => {
			sqlite.exec("BEGIN");
			try {
				const results = [];
				for (const statement of statements) results.push(await statement.run());
				sqlite.exec("COMMIT");
				return results;
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		},
	};

	return {
		db: db as unknown as D1Database,
		sqlite,
		statementCalls,
	};
}
