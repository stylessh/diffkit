export type CodeTreeEntryType = "dir" | "file" | "submodule";

export type CodeTreeEntry = {
	path: string;
	type: CodeTreeEntryType;
	sha: string;
	size: number | null;
};

export type RepoGitTree = {
	sha: string | null;
	truncated: boolean;
	entries: CodeTreeEntry[];
};

export type RepoBlob =
	| { kind: "text"; sha: string; size: number; text: string }
	| {
			kind: "image";
			sha: string;
			size: number;
			mimeType: string;
			base64: string;
	  }
	| { kind: "binary"; sha: string; size: number; base64: string }
	| { kind: "tooLarge"; sha: string | null; size: number | null }
	| { kind: "submodule"; sha: string }
	| { kind: "missing" };

export type RepoBlobKind = RepoBlob["kind"];

export type BlameCommit = {
	oid: string;
	abbreviatedOid: string;
	headline: string;
	committedDate: string;
	authorName: string;
	authorLogin: string | null;
	avatarUrl: string | null;
	parentOid: string | null;
};

export type BlameRange = {
	start: number;
	end: number;
	age: number;
	commitOid: string;
};

export type RepoBlame =
	| {
			status: "ok";
			ranges: BlameRange[];
			commits: Record<string, BlameCommit>;
	  }
	| { status: "missing" };

export type CodeSearchFragment = {
	text: string;
	highlights: ReadonlyArray<readonly [number, number]>;
};

export type CodeSearchHit = {
	path: string;
	sha: string;
	fragments: CodeSearchFragment[];
};

export type RepoCodeSearch =
	| {
			status: "ok";
			totalCount: number;
			incomplete: boolean;
			hits: CodeSearchHit[];
	  }
	| { status: "rateLimited"; retryAt: string | null }
	| { status: "invalid"; message: string };

export type RepoCodeInput = { owner: string; repo: string; ref: string };
export type RepoCodePathInput = RepoCodeInput & { path: string };
export type RepoCodeSearchInput = {
	owner: string;
	repo: string;
	query: string;
	page: number;
};

export const CODE_SEARCH_PAGE_SIZE = 20;
