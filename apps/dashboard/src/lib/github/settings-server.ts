import { RequestError } from "octokit";
import type { SettingsOutcome, SettingsRead } from "../settings/read-result";
import { getGitHubContext } from "./client";
import type { GitHubClient } from "./shared";

type GitHubErrorBody = {
	message?: string;
	errors?: Array<{ message?: string; code?: string }>;
};

function githubMessage(error: RequestError) {
	const body = error.response?.data as GitHubErrorBody | undefined;
	return body?.errors?.[0]?.message ?? body?.message ?? error.message;
}

export function describeSettingsFailure(action: string, error: unknown) {
	if (!(error instanceof RequestError)) return `Couldn't ${action}.`;
	const message = githubMessage(error);
	if (error.status === 401 || error.status === 403) {
		return `Couldn't ${action}: GitHub refused (${message}).`;
	}
	if (error.status === 404) {
		return `Couldn't ${action}: not found, or you don't have access.`;
	}
	return `Couldn't ${action}: ${message}`;
}

export async function readSettings<T>(
	label: string,
	load: (octokit: GitHubClient) => Promise<T>,
): Promise<SettingsRead<T>> {
	const context = await getGitHubContext();
	if (!context) return { status: "error", message: "You are signed out." };
	try {
		return { status: "ok", data: await load(context.octokit) };
	} catch (error) {
		if (
			error instanceof RequestError &&
			(error.status === 403 || error.status === 404)
		) {
			return { status: "forbidden" };
		}
		console.error(`[settings:${label}]`, (error as Error).message);
		return { status: "error", message: `Couldn't load ${label}.` };
	}
}

export async function runSettingsMutation(
	action: string,
	run: (octokit: GitHubClient) => Promise<unknown>,
): Promise<SettingsOutcome> {
	const context = await getGitHubContext();
	if (!context) return { ok: false, error: "You are signed out." };
	try {
		await run(context.octokit);
		return { ok: true };
	} catch (error) {
		console.error(`[settings:${action}]`, (error as Error).message);
		return { ok: false, error: describeSettingsFailure(action, error) };
	}
}
