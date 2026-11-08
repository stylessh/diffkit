import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const novaAuthFile = fileURLToPath(
	new URL("../.auth/nova.json", import.meta.url),
);

const dashboardDevVarsFile = fileURLToPath(
	new URL("../../dashboard/.dev.vars.demo", import.meta.url),
);

/** The worker only reads its URLs from this file, so the suite follows it. */
export function demoVar(name: string) {
	const line = readFileSync(dashboardDevVarsFile, "utf8")
		.split("\n")
		.find((entry) => entry.startsWith(`${name}=`));
	if (!line) {
		throw new Error(`${name} is missing from apps/dashboard/.dev.vars.demo`);
	}
	return line.slice(name.length + 1).trim();
}

export const dashboardUrl = new URL(demoVar("BETTER_AUTH_URL")).origin;
export const emulatorUrl = new URL(demoVar("GITHUB_EMULATOR_URL")).origin;
