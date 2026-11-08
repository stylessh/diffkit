export type ActionsConfigKind = "secret" | "variable";

export type RepoActionsSecret = {
	name: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export type RepoActionsVariable = RepoActionsSecret & {
	value: string;
};

export type RawActionsSecret = {
	name: string;
	created_at?: string | null;
	updated_at?: string | null;
};

export type RawActionsVariable = RawActionsSecret & { value: string };

export function mapActionsSecret(raw: RawActionsSecret): RepoActionsSecret {
	return {
		name: raw.name,
		createdAt: raw.created_at ?? null,
		updatedAt: raw.updated_at ?? null,
	};
}

export function mapActionsVariable(
	raw: RawActionsVariable,
): RepoActionsVariable {
	return { ...mapActionsSecret(raw), value: raw.value };
}

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_VALUE_BYTES = 48 * 1024;

/** GitHub stores secret and variable names in upper case. */
export function normalizeActionsName(name: string) {
	return name.trim().toUpperCase();
}

export function validateActionsName(
	name: string,
	existing: readonly string[],
): string | null {
	const normalized = normalizeActionsName(name);
	if (normalized === "") return "Enter a name.";
	if (!NAME_PATTERN.test(normalized)) {
		return "Use letters, numbers and underscores, and don't start with a number.";
	}
	if (normalized.startsWith("GITHUB_")) {
		return "Names can't start with GITHUB_.";
	}
	if (existing.some((entry) => entry.toUpperCase() === normalized)) {
		return "That name is already in use.";
	}
	return null;
}

export function validateActionsValue(value: string, kind: ActionsConfigKind) {
	if (value === "") {
		return kind === "secret" ? "Enter the secret value." : "Enter a value.";
	}
	if (new TextEncoder().encode(value).length > MAX_VALUE_BYTES) {
		return "Values can be at most 48 KB.";
	}
	return null;
}
