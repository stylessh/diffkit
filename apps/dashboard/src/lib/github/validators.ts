/** No server-only imports here: TanStack Start keeps `.validator(...)` in the SSR caller module, so this file loads wherever a server function is imported. */

export function identityValidator<TInput>(data: TInput) {
	return data;
}

const REPOSITORY_NAME_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/u;

export function isRepositoryName(value: unknown): value is string {
	return typeof value === "string" && REPOSITORY_NAME_PATTERN.test(value);
}

export type RepoInput = { owner: string; repo: string };

/**
 * For handlers that hand their input to Octokit. Octokit reads keys such as
 * `baseUrl`, `url`, `method` and `headers` as request options, so the result
 * carries `owner` and `repo` only, whatever else the request sent.
 */
export function repoInputValidator(data: RepoInput): RepoInput {
	const { owner, repo } = (data ?? {}) as Partial<RepoInput>;
	if (!isRepositoryName(owner) || !isRepositoryName(repo)) {
		throw new Error("Invalid repository.");
	}
	return { owner, repo };
}
