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
	(table) => [primaryKey({ columns: [table.userId, table.org] })],
);

/**
 * Change feed (docs/data-fetching.md, L2): the latest change of each entity a
 * GitHub webhook touched. A repeat change updates the row and raises
 * `version`, which is the cursor clients poll from. The cron sweeper deletes
 * rows unchanged for 15 minutes but always keeps the newest, so `version`
 * never goes backwards.
 */
export const githubChange = sqliteTable(
	"github_change",
	{
		/** Lowercased `owner/repo`. */
		repo: text("repo").notNull(),
		entityKey: text("entity_key").notNull(),
		isPrivate: integer("is_private", { mode: "boolean" })
			.notNull()
			.default(true),
		version: integer("version").notNull(),
		/** Epoch milliseconds. */
		changedAt: integer("changed_at").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.repo, table.entityKey] }),
		index("github_change_version_idx").on(table.version),
	],
);
