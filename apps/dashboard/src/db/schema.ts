import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/**
 * Orgs that returned an OAuth App access restriction error during a previous
 * search. Used to skip those orgs in the OAuth fallback search source so we
 * stop wasting per-source timeout budget (and stop re-surfacing the same
 * warning on every reload). Entries are removed once the user installs the
 * GitHub App on the org (detected in `getMySearchSources`).
 */
export const userForbiddenOrg = sqliteTable(
	"user_forbidden_org",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		org: text("org").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.org] }),
	}),
);

/**
 * Change feed: one row per entity a GitHub webhook changed (see
 * docs/data-fetching.md, L2). Rows are only useful for 15 minutes; the cron
 * sweeper in scheduled-maintenance.server.ts deletes older ones, so the table stays at a few
 * hundred rows. `id` is AUTOINCREMENT so cursors stay monotonic even when the
 * table is empty.
 */
export const githubChange = sqliteTable(
	"github_change",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		/** Lowercased `owner/repo`. */
		repo: text("repo").notNull(),
		entityKey: text("entity_key").notNull(),
		/** 0 only when the webhook payload said the repo is public. */
		isPrivate: integer("is_private").notNull().default(1),
		/** Epoch milliseconds. */
		changedAt: integer("changed_at").notNull(),
	},
	(table) => ({
		repoIdIdx: index("github_change_repo_id_idx").on(table.repo, table.id),
		changedAtIdx: index("github_change_changed_at_idx").on(table.changedAt),
	}),
);
