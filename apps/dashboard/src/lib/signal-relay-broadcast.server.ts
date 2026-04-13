import "@tanstack/react-start/server-only";
import { debug } from "./debug";

export async function broadcastSignalKeys(signalKeys: string[]) {
	try {
		const { env } = await import("cloudflare:workers");
		const workerEnv = env as typeof env & {
			SIGNAL_RELAY?: DurableObjectNamespace;
		};

		if (!workerEnv.SIGNAL_RELAY) {
			debug(
				"signal-relay",
				"SIGNAL_RELAY binding not available, skipping broadcast",
			);
			return;
		}

		const id = workerEnv.SIGNAL_RELAY.idFromName("global");
		const stub = workerEnv.SIGNAL_RELAY.get(id);

		await stub.fetch("https://signal-relay/broadcast", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ signalKeys }),
		});
	} catch (error) {
		debug("signal-relay", "broadcast failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
