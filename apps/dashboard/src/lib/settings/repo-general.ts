export type RepoVisibility = "public" | "private" | "internal";

export type RepoGeneralDraft = {
	description: string;
	homepage: string;
	defaultBranch: string;
	hasIssues: boolean;
	hasWiki: boolean;
	hasDiscussions: boolean;
	allowSquashMerge: boolean;
	allowMergeCommit: boolean;
	allowRebaseMerge: boolean;
	allowAutoMerge: boolean;
	allowUpdateBranch: boolean;
	deleteBranchOnMerge: boolean;
};

export type RepoGeneralSettings = RepoGeneralDraft & {
	owner: string;
	name: string;
	fullName: string;
	htmlUrl: string;
	visibility: RepoVisibility;
	isArchived: boolean;
	isFork: boolean;
	isOrgOwned: boolean;
};

export type RawRepoSettings = {
	owner: { login: string; type?: string };
	name: string;
	full_name: string;
	html_url: string;
	description?: string | null;
	homepage?: string | null;
	private: boolean;
	visibility?: string;
	archived?: boolean;
	fork?: boolean;
	default_branch: string;
	has_issues?: boolean;
	has_wiki?: boolean;
	has_discussions?: boolean;
	allow_squash_merge?: boolean;
	allow_merge_commit?: boolean;
	allow_rebase_merge?: boolean;
	allow_auto_merge?: boolean;
	allow_update_branch?: boolean;
	delete_branch_on_merge?: boolean;
};

function parseVisibility(raw: RawRepoSettings): RepoVisibility {
	if (raw.visibility === "internal") return "internal";
	if (raw.visibility === "public" || raw.visibility === "private") {
		return raw.visibility;
	}
	return raw.private ? "private" : "public";
}

/** GitHub omits the merge options for readers who cannot change them. */
export function mapRepoGeneralSettings(
	raw: RawRepoSettings,
): RepoGeneralSettings {
	return {
		owner: raw.owner.login,
		name: raw.name,
		fullName: raw.full_name,
		htmlUrl: raw.html_url,
		visibility: parseVisibility(raw),
		isArchived: raw.archived ?? false,
		isFork: raw.fork ?? false,
		isOrgOwned: raw.owner.type === "Organization",
		description: raw.description ?? "",
		homepage: raw.homepage ?? "",
		defaultBranch: raw.default_branch,
		hasIssues: raw.has_issues ?? true,
		hasWiki: raw.has_wiki ?? false,
		hasDiscussions: raw.has_discussions ?? false,
		allowSquashMerge: raw.allow_squash_merge ?? true,
		allowMergeCommit: raw.allow_merge_commit ?? true,
		allowRebaseMerge: raw.allow_rebase_merge ?? true,
		allowAutoMerge: raw.allow_auto_merge ?? false,
		allowUpdateBranch: raw.allow_update_branch ?? false,
		deleteBranchOnMerge: raw.delete_branch_on_merge ?? false,
	};
}

export function draftFromSettings(
	settings: RepoGeneralSettings,
): RepoGeneralDraft {
	return {
		description: settings.description,
		homepage: settings.homepage,
		defaultBranch: settings.defaultBranch,
		hasIssues: settings.hasIssues,
		hasWiki: settings.hasWiki,
		hasDiscussions: settings.hasDiscussions,
		allowSquashMerge: settings.allowSquashMerge,
		allowMergeCommit: settings.allowMergeCommit,
		allowRebaseMerge: settings.allowRebaseMerge,
		allowAutoMerge: settings.allowAutoMerge,
		allowUpdateBranch: settings.allowUpdateBranch,
		deleteBranchOnMerge: settings.deleteBranchOnMerge,
	};
}

const API_FIELDS: Record<keyof RepoGeneralDraft, string> = {
	description: "description",
	homepage: "homepage",
	defaultBranch: "default_branch",
	hasIssues: "has_issues",
	hasWiki: "has_wiki",
	hasDiscussions: "has_discussions",
	allowSquashMerge: "allow_squash_merge",
	allowMergeCommit: "allow_merge_commit",
	allowRebaseMerge: "allow_rebase_merge",
	allowAutoMerge: "allow_auto_merge",
	allowUpdateBranch: "allow_update_branch",
	deleteBranchOnMerge: "delete_branch_on_merge",
};

export function normalizeDraft(draft: RepoGeneralDraft): RepoGeneralDraft {
	return {
		...draft,
		description: draft.description.trim(),
		homepage: draft.homepage.trim(),
	};
}

export function changedFields(
	saved: RepoGeneralDraft,
	draft: RepoGeneralDraft,
): Partial<RepoGeneralDraft> {
	const next = normalizeDraft(draft);
	const changes: Record<string, unknown> = {};
	for (const key of Object.keys(API_FIELDS) as (keyof RepoGeneralDraft)[]) {
		if (next[key] !== saved[key]) changes[key] = next[key];
	}
	return changes as Partial<RepoGeneralDraft>;
}

/** The only place client-supplied field names become GitHub API names. */
export function toApiPatch(
	changes: Partial<RepoGeneralDraft>,
): Record<string, string | boolean> {
	const patch: Record<string, string | boolean> = {};
	for (const [key, value] of Object.entries(changes)) {
		const apiName = API_FIELDS[key as keyof RepoGeneralDraft];
		if (apiName !== undefined && value !== undefined) patch[apiName] = value;
	}
	return patch;
}

export const DESCRIPTION_MAX_LENGTH = 350;

function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

export function validateRepoGeneralDraft(draft: RepoGeneralDraft) {
	if (draft.defaultBranch.trim() === "") return "Choose a default branch.";
	if (draft.description.trim().length > DESCRIPTION_MAX_LENGTH) {
		return `The description can be at most ${DESCRIPTION_MAX_LENGTH} characters.`;
	}
	if (draft.homepage.trim() !== "" && !isHttpUrl(draft.homepage.trim())) {
		return "The website must be an http or https URL.";
	}
	if (
		!draft.allowSquashMerge &&
		!draft.allowMergeCommit &&
		!draft.allowRebaseMerge
	) {
		return "Allow at least one merge method.";
	}
	return null;
}
