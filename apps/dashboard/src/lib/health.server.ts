export type DependencyCheck<T = Record<never, never>> =
	| ({ status: "ok"; latencyMs: number } & T)
	| { status: "failed"; latencyMs: number; error: string };

export type MaintenanceRun =
	| {
			status: "recent" | "stale";
			lastRunAt: string;
			ageSeconds: number;
			result: MaintenanceResult;
	  }
	| { status: "never_recorded" }
	| { status: "unreadable" };

export type WorkerVersion =
	| { status: "known"; id: string; tag: string; uploadedAt: string }
	| { status: "unknown" };

export type HealthReport = {
	status: "ok" | "degraded";
	checkedAt: string;
	version: WorkerVersion;
	checks: {
		d1: DependencyCheck<{ sizeBytes?: number }>;
		kv: DependencyCheck;
	};
	maintenance: MaintenanceRun;
};

type MaintenanceResult = "ok" | "errors";
type MaintenanceHeartbeat = { ranAt: number; result: MaintenanceResult };

const MAINTENANCE_HEARTBEAT_KEY = "health:maintenance-heartbeat";
const MAINTENANCE_HEARTBEAT_TTL_SECONDS = 24 * 60 * 60;
/** Two missed 5-minute cron runs plus scheduling slack. */
const MAINTENANCE_STALE_AFTER_MS = 12 * 60 * 1000;
const CHECK_TIMEOUT_MS = 5_000;

export async function recordMaintenanceRun(
	kv: KVNamespace,
	summary: Record<string, unknown>,
	ranAt = Date.now(),
) {
	const heartbeat: MaintenanceHeartbeat = {
		ranAt,
		result:
			"sweepError" in summary || "healthError" in summary ? "errors" : "ok",
	};
	try {
		await kv.put(MAINTENANCE_HEARTBEAT_KEY, JSON.stringify(heartbeat), {
			expirationTtl: MAINTENANCE_HEARTBEAT_TTL_SECONDS,
		});
	} catch (error) {
		console.warn("[health] maintenance heartbeat write failed", error);
	}
}

export async function checkHealth(deps: {
	db: D1Database;
	kv: KVNamespace;
	versionMetadata?: WorkerVersionMetadata;
	now?: number;
}): Promise<HealthReport> {
	const now = deps.now ?? Date.now();
	const [d1, kvRead] = await Promise.all([
		timedCheck(async () => {
			const result = await deps.db.prepare("SELECT 1 AS ok").all();
			const sizeBytes = result.meta.size_after;
			return typeof sizeBytes === "number" ? { sizeBytes } : {};
		}),
		timedCheck(async () => ({
			heartbeat: await deps.kv.get<MaintenanceHeartbeat>(
				MAINTENANCE_HEARTBEAT_KEY,
				"json",
			),
		})),
	]);

	const checks = { d1, kv: withoutValue(kvRead) };
	return {
		status: overallStatus(checks),
		checkedAt: new Date(now).toISOString(),
		version: workerVersion(deps.versionMetadata),
		checks,
		maintenance: maintenanceRun(kvRead, now),
	};
}

export function healthResponse(report: HealthReport) {
	return Response.json(report, {
		status: report.status === "ok" ? 200 : 503,
		headers: { "Cache-Control": "no-store" },
	});
}

function overallStatus(checks: HealthReport["checks"]): HealthReport["status"] {
	return Object.values(checks).every((check) => check.status === "ok")
		? "ok"
		: "degraded";
}

function workerVersion(
	metadata: WorkerVersionMetadata | undefined,
): WorkerVersion {
	if (!metadata?.id) return { status: "unknown" };
	return {
		status: "known",
		id: metadata.id,
		tag: metadata.tag,
		uploadedAt: metadata.timestamp,
	};
}

function maintenanceRun(
	kvRead: DependencyCheck<{ heartbeat: MaintenanceHeartbeat | null }>,
	now: number,
): MaintenanceRun {
	if (kvRead.status === "failed") return { status: "unreadable" };
	if (!kvRead.heartbeat) return { status: "never_recorded" };
	const { ranAt, result } = kvRead.heartbeat;
	const ageMs = Math.max(0, now - ranAt);
	return {
		status: ageMs > MAINTENANCE_STALE_AFTER_MS ? "stale" : "recent",
		lastRunAt: new Date(ranAt).toISOString(),
		ageSeconds: Math.round(ageMs / 1000),
		result,
	};
}

function withoutValue(
	check: DependencyCheck<{ heartbeat: unknown }>,
): DependencyCheck {
	if (check.status === "failed") return check;
	return { status: "ok", latencyMs: check.latencyMs };
}

async function timedCheck<T extends object>(
	probe: () => Promise<T>,
): Promise<DependencyCheck<T>> {
	const startedAt = Date.now();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS}ms`)),
			CHECK_TIMEOUT_MS,
		);
	});
	try {
		const value = await Promise.race([probe(), timeout]);
		return { status: "ok", latencyMs: Date.now() - startedAt, ...value };
	} catch (error) {
		return {
			status: "failed",
			latencyMs: Date.now() - startedAt,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		clearTimeout(timer);
	}
}
