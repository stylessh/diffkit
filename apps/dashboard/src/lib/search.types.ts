export type SearchRepoTier = "hot" | "warm" | "cold";
export type SearchEtaBucket = "<10m" | "10-30m" | ">30m";

export type SearchRepoStatus = {
	status: string;
	default_branch?: string;
	last_indexed_head_sha: string | null;
	last_seen_head_sha: string | null;
	last_synced_at: number | null;
	last_indexed_at: number | null;
	tier: SearchRepoTier;
	eta_bucket?: SearchEtaBucket;
};

export type SearchCodeResultItem = {
	repo: string;
	path: string;
	line_number: number;
	line: string;
	context_before: string[];
	context_after: string[];
};

export type SearchCodeResponse = {
	results: SearchCodeResultItem[];
	repo_status: Record<string, SearchRepoStatus>;
	partial: boolean;
	trace_id: string;
	code_search_disabled?: boolean;
};

export type SearchCodeInput = {
	q: string;
	repo?: string;
	path?: string;
	lang?: string;
	page?: string;
};

export type SearchOnboardRepoInput = {
	provider: "github";
	owner: string;
	name: string;
};

export type SearchOnboardRepoResponse = {
	repo: {
		id: string;
		provider: "github";
		owner: string;
		name: string;
		default_branch: string;
		status: string;
		tier: SearchRepoTier;
		is_private: boolean;
	} | null;
	job_priority: "interactive" | "normal" | "backfill";
};

export type SearchRepoStatusResponse = {
	repo_id: string;
	provider: "github";
	owner: string;
	name: string;
	status: string;
	last_indexed_commit: string | null;
	staleness_seconds: number | null;
	latest_error: string | null;
	last_synced_at: number | null;
	last_indexed_at: number | null;
	tier: SearchRepoTier;
};
