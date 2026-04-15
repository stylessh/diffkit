export type CloneProtocol = "https" | "ssh" | "cli";

const CLONE_PROTOCOL_STORAGE_KEY = "diffkit:repo-clone-protocol";
const DEFAULT_CLONE_PROTOCOL: CloneProtocol = "cli";

const VALID_CLONE_PROTOCOLS = {
	https: true,
	ssh: true,
	cli: true,
} satisfies Record<CloneProtocol, true>;

export function isCloneProtocol(value: unknown): value is CloneProtocol {
	return typeof value === "string" && value in VALID_CLONE_PROTOCOLS;
}

export function readStoredCloneProtocol(): CloneProtocol {
	if (typeof window === "undefined") {
		return DEFAULT_CLONE_PROTOCOL;
	}

	try {
		const stored = window.localStorage.getItem(CLONE_PROTOCOL_STORAGE_KEY);
		return isCloneProtocol(stored) ? stored : DEFAULT_CLONE_PROTOCOL;
	} catch {
		return DEFAULT_CLONE_PROTOCOL;
	}
}

export function persistCloneProtocol(protocol: CloneProtocol): void {
	try {
		window.localStorage.setItem(CLONE_PROTOCOL_STORAGE_KEY, protocol);
	} catch {}
}
