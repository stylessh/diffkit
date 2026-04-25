import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
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

export const searchRepoRegistry = sqliteTable(
	"search_repo_registry",
	{
		id: text("id").primaryKey(),
		provider: text("provider", { enum: ["github"] }).notNull(),
		owner: text("owner").notNull(),
		name: text("name").notNull(),
		defaultBranch: text("default_branch").notNull(),
		isEnabled: integer("is_enabled", { mode: "boolean" }).notNull(),
		tier: text("tier", { enum: ["hot", "warm", "cold"] }).notNull(),
		lastSeenHeadSha: text("last_seen_head_sha"),
		lastIndexedHeadSha: text("last_indexed_head_sha"),
		lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
		lastIndexedAt: integer("last_indexed_at", { mode: "timestamp" }),
		status: text("status", {
			enum: ["ready", "syncing", "indexing", "not_indexed", "failed"],
		}).notNull(),
		isPrivate: integer("is_private", { mode: "boolean" }).notNull(),
		lastError: text("last_error"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		providerOwnerNameUidx: uniqueIndex(
			"search_repo_registry_provider_owner_name_uidx",
		).on(table.provider, table.owner, table.name),
		statusIdx: index("search_repo_registry_status_idx").on(table.status),
		tierStatusIdx: index("search_repo_registry_tier_status_idx").on(
			table.tier,
			table.status,
		),
		enabledTierIdx: index("search_repo_registry_enabled_tier_idx").on(
			table.isEnabled,
			table.tier,
		),
	}),
);

export const searchJobs = sqliteTable(
	"search_jobs",
	{
		id: text("id").primaryKey(),
		repoId: text("repo_id")
			.notNull()
			.references(() => searchRepoRegistry.id, { onDelete: "cascade" }),
		jobType: text("job_type", { enum: ["sync", "index"] }).notNull(),
		priority: text("priority", {
			enum: ["interactive", "normal", "backfill"],
		}).notNull(),
		status: text("status", {
			enum: ["queued", "running", "done", "failed"],
		}).notNull(),
		attempt: integer("attempt").notNull(),
		error: text("error"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		repoTypeStatusIdx: index("search_jobs_repo_type_status_idx").on(
			table.repoId,
			table.jobType,
			table.status,
		),
		statusCreatedIdx: index("search_jobs_status_created_idx").on(
			table.status,
			table.createdAt,
		),
	}),
);

export const searchIndexBuilds = sqliteTable(
	"search_index_builds",
	{
		id: text("id").primaryKey(),
		buildVersion: text("build_version").notNull(),
		repoCount: integer("repo_count").notNull(),
		startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
		finishedAt: integer("finished_at", { mode: "timestamp" }),
		status: text("status").notNull(),
		manifestR2Key: text("manifest_r2_key"),
	},
	(table) => ({
		buildVersionUidx: uniqueIndex("search_index_builds_build_version_uidx").on(
			table.buildVersion,
		),
		statusStartedIdx: index("search_index_builds_status_started_idx").on(
			table.status,
			table.startedAt,
		),
	}),
);
