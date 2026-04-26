import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const githubResponseCache = sqliteTable(
	"github_response_cache",
	{
		cacheKey: text("cache_key").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		resource: text("resource").notNull(),
		paramsJson: text("params_json").notNull(),
		etag: text("etag"),
		lastModified: text("last_modified"),
		payloadJson: text("payload_json").notNull(),
		fetchedAt: integer("fetched_at").notNull(),
		freshUntil: integer("fresh_until").notNull(),
		rateLimitRemaining: integer("rate_limit_remaining"),
		rateLimitReset: integer("rate_limit_reset"),
		statusCode: integer("status_code").notNull(),
	},
	(table) => ({
		userResourceIdx: index("github_response_cache_user_resource_idx").on(
			table.userId,
			table.resource,
		),
	}),
);

export const githubRevalidationSignal = sqliteTable(
	"github_revalidation_signal",
	{
		signalKey: text("signal_key").primaryKey(),
		updatedAt: integer("updated_at").notNull(),
	},
);

export const githubCacheNamespace = sqliteTable("github_cache_namespace", {
	namespaceKey: text("namespace_key").primaryKey(),
	version: integer("version").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const githubWebhookEvent = sqliteTable(
	"github_webhook_event",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		deliveryId: text("delivery_id").notNull().unique(),
		event: text("event").notNull(),
		signalKeysJson: text("signal_keys_json").notNull(),
		receivedAt: integer("received_at").notNull(),
		processedAt: integer("processed_at"),
		errorMessage: text("error_message"),
	},
	(table) => ({
		receivedAtIdx: index("github_webhook_event_received_at_idx").on(
			table.receivedAt,
		),
	}),
);
