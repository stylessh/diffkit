import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { createTestD1 } from "../lib/testing/d1-sqlite";
import * as schema from "./schema";

/**
 * The migrations in drizzle/ are hand-maintained after 0001, so the Drizzle
 * schema can drift from what production actually has. This applies every
 * migration to an empty database and compares it with schema.ts.
 */

const MIGRATIONS = [
	"0000_pretty_the_call.sql",
	"0001_outstanding_blizzard.sql",
	"0002_github_revalidation_signal.sql",
	"0003_github_cache_namespace.sql",
	"0004_github_webhook_event.sql",
	"0005_user_forbidden_org.sql",
	"0006_github_change.sql",
];

type ColumnInfo = { name: string; type: string; notnull: number; pk: number };

const { sqlite } = createTestD1(MIGRATIONS);

const tables: SQLiteTable[] = Object.values<unknown>(schema).filter(
	(value): value is SQLiteTable => is(value, SQLiteTable),
);

describe("drizzle schema matches the migrations", () => {
	it("finds the tables", () => {
		expect(tables.map((table) => getTableConfig(table).name).sort()).toEqual([
			"account",
			"github_change",
			"session",
			"user",
			"user_forbidden_org",
			"verification",
		]);
	});

	for (const table of tables) {
		const config = getTableConfig(table);

		it(`${config.name}: columns, nullability and primary keys`, () => {
			const actual = sqlite
				.prepare(`PRAGMA table_info(${JSON.stringify(config.name)})`)
				.all() as ColumnInfo[];
			const byName = new Map(actual.map((column) => [column.name, column]));

			expect([...byName.keys()].sort()).toEqual(
				config.columns.map((column) => column.name).sort(),
			);
			for (const column of config.columns) {
				const info = byName.get(column.name);
				// SQLite reports `notnull` 0 for INTEGER PRIMARY KEY.
				expect(Boolean(info?.notnull) || column.primary, column.name).toBe(
					column.notNull || column.primary,
				);
				expect(info?.type.toLowerCase(), column.name).toBe(
					column.getSQLType().toLowerCase(),
				);
			}
		});

		it(`${config.name}: indexes exist`, () => {
			const indexes = sqlite
				.prepare(`PRAGMA index_list(${JSON.stringify(config.name)})`)
				.all() as Array<{ name: string }>;
			const names = new Set(indexes.map((index) => index.name));
			for (const index of config.indexes) {
				expect(names.has(index.config.name), index.config.name).toBe(true);
			}
		});
	}

	it("keeps github_change.id AUTOINCREMENT so cursors never move backwards", () => {
		const row = sqlite
			.prepare("SELECT sql FROM sqlite_master WHERE name = 'github_change'")
			.get() as { sql: string };
		expect(row.sql).toMatch(/AUTOINCREMENT/i);
	});
});
