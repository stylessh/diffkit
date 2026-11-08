import type { GitHubContext, RepositoryPermissions } from "./shared";

export function mergeRepositoryPermissions(
	...permissionsList: Array<RepositoryPermissions | null | undefined>
): RepositoryPermissions | undefined {
	const permissions = permissionsList.filter(
		(candidate): candidate is RepositoryPermissions => Boolean(candidate),
	);
	if (permissions.length === 0) {
		return undefined;
	}

	return {
		admin: permissions.some((permission) => permission.admin === true),
		maintain: permissions.some((permission) => permission.maintain === true),
		push: permissions.some((permission) => permission.push === true),
		triage: permissions.some((permission) => permission.triage === true),
		pull: permissions.some((permission) => permission.pull === true),
	};
}

export async function getRepositoryPermissions(
	context: GitHubContext | null,
	owner: string,
	repo: string,
) {
	if (!context) {
		return null;
	}

	const response = await context.octokit.rest.repos
		.get({ owner, repo })
		.catch(() => null);
	return response?.data.permissions ?? null;
}
