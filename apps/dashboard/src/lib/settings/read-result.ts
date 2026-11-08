export type SettingsRead<T> =
	| { status: "ok"; data: T }
	| { status: "forbidden" }
	| { status: "error"; message: string };

export type SettingsOutcome = { ok: true } | { ok: false; error: string };
