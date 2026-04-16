import { useCallback } from "react";
import { useLocalStorageState } from "./use-local-storage-state";

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

export function useRepoCloneProtocol() {
	const [cloneProtocol, setCloneProtocol] = useLocalStorageState(
		CLONE_PROTOCOL_STORAGE_KEY,
		{
			defaultValue: DEFAULT_CLONE_PROTOCOL,
			validate: isCloneProtocol,
		},
	);

	const setStoredCloneProtocol = useCallback(
		(protocol: string) => {
			if (!isCloneProtocol(protocol)) {
				return;
			}

			setCloneProtocol(protocol);
		},
		[setCloneProtocol],
	);

	return [cloneProtocol, setStoredCloneProtocol] as const;
}
