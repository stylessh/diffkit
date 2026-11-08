import type {
	MarkdownTextReference,
	ResourceReference,
} from "@diffkit/ui/components/markdown";

export type GitHubLink = {
	/** The in-app route for the URL, keeping its `#fragment`. */
	path: string;
	/** Set when the URL names something a hover card can describe. */
	reference: ResourceReference | null;
};

type RepoSlug = { owner: string; repo: string };

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** github.com pages whose first segment is not an owner. */
const RESERVED_OWNERS = new Set([
	"about",
	"account",
	"advisories",
	"apps",
	"codespaces",
	"collections",
	"contact",
	"customer-stories",
	"enterprise",
	"enterprises",
	"events",
	"explore",
	"features",
	"marketplace",
	"new",
	"notifications",
	"orgs",
	"organizations",
	"pricing",
	"search",
	"security",
	"settings",
	"site",
	"sponsors",
	"topics",
	"trending",
	"users",
]);

/** Repo sub-pages whose GitHub path is also the app's route. */
const MIRRORED_SECTIONS = new Set([
	"actions",
	"blob",
	"branches",
	"commits",
	"compare",
	"issues",
	"pulls",
	"releases",
	"tags",
	"tree",
]);

const SHA = /^[0-9a-f]{7,40}$/u;

function positiveNumber(value: string | undefined): number | null {
	if (!value || !/^[1-9]\d*$/u.test(value)) return null;
	const number = Number(value);
	return Number.isSafeInteger(number) ? number : null;
}

function safeDecode(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function repoPath({ owner, repo }: RepoSlug) {
	return `/${owner}/${repo}`;
}

export function pullPath(slug: RepoSlug, number: number) {
	return `${repoPath(slug)}/pull/${number}`;
}

export function issuePath(slug: RepoSlug, number: number) {
	return `${repoPath(slug)}/issues/${number}`;
}

export function commitPath(slug: RepoSlug, sha: string) {
	return `${repoPath(slug)}/commit/${sha}`;
}

export function releasePath(slug: RepoSlug, tag: string) {
	return `${repoPath(slug)}/releases/${encodeURIComponent(tag)}`;
}

function linkFor(
	slug: RepoSlug,
	rest: string[],
	rawRest: string[],
): GitHubLink | null {
	const [section, second, third, fourth] = rest;
	const base = repoPath(slug);

	if (!section) {
		return {
			path: base,
			reference: { kind: "repo", ...slug, href: base },
		};
	}

	if (section === "pull") {
		const number = positiveNumber(second);
		if (number === null) return null;
		if (third === "commits" && fourth && SHA.test(fourth)) {
			const href = commitPath(slug, fourth);
			return {
				path: href,
				reference: { kind: "commit", ...slug, sha: fourth, href },
			};
		}
		const href = pullPath(slug, number);
		const path = third === "files" ? `${base}/review/${number}` : href;
		return { path, reference: { kind: "pull", ...slug, number, href } };
	}

	if (section === "issues" && second) {
		const number = positiveNumber(second);
		if (number === null || third) return null;
		const href = issuePath(slug, number);
		return { path: href, reference: { kind: "issue", ...slug, number, href } };
	}

	if (section === "commit" && second && SHA.test(second)) {
		const href = commitPath(slug, second);
		return {
			path: href,
			reference: { kind: "commit", ...slug, sha: second, href },
		};
	}

	if (section === "releases" && second === "tag" && third) {
		const tag = rest.slice(2).join("/");
		const href = releasePath(slug, tag);
		return { path: href, reference: { kind: "release", ...slug, tag, href } };
	}

	if (MIRRORED_SECTIONS.has(section)) {
		return { path: `${base}/${rawRest.join("/")}`, reference: null };
	}

	return null;
}

/**
 * The in-app equivalent of a github.com URL, or `null` for URLs the app has
 * no route for (profiles, settings, gists, other hosts), which stay external.
 */
export function parseGitHubUrl(url: string): GitHubLink | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
	if (!GITHUB_HOSTS.has(parsed.hostname.toLowerCase())) return null;

	const rawSegments = parsed.pathname.split("/").filter(Boolean);
	if (rawSegments.length < 2) return null;
	const [owner, rawRepo, ...rawRest] = rawSegments;
	if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;
	const slug = {
		owner: safeDecode(owner),
		repo: safeDecode(rawRepo).replace(/\.git$/u, ""),
	};
	const link = linkFor(slug, rawRest.map(safeDecode), rawRest);
	return link ? { ...link, path: `${link.path}${parsed.hash}` } : null;
}

export function resolveGitHubLinkUrl(url: string) {
	return parseGitHubUrl(url)?.path ?? url;
}

export function resolveGitHubUrlReference(url: string) {
	return parseGitHubUrl(url)?.reference ?? null;
}

export function createTextReferenceResolver(current: RepoSlug | null) {
	return (token: MarkdownTextReference): ResourceReference | null => {
		const slug = token.repo ?? current;
		if (!slug) return null;
		if (token.kind === "number") {
			return {
				kind: "issueOrPull",
				...slug,
				number: token.number,
				href: issuePath(slug, token.number),
			};
		}
		return {
			kind: "commit",
			...slug,
			sha: token.sha,
			href: commitPath(slug, token.sha),
		};
	};
}
