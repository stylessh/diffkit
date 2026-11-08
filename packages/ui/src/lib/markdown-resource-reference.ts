/**
 * Shared types for rich resource references in markdown. The UI library stays
 * provider-agnostic: the app maps pasted URLs and text tokens (`#12`,
 * `owner/repo#12`, commit SHAs) to a {@link ResourceReference} and supplies a
 * component to render it.
 */

export type ResourceReferenceKind = ResourceReference["kind"];

type RepoScoped = { href: string; owner: string; repo: string };

export type ResourceReference =
	| { kind: "user"; href: string; login: string }
	| ({ kind: "repo" } & RepoScoped)
	| ({ kind: "pull"; number: number } & RepoScoped)
	| ({ kind: "issue"; number: number } & RepoScoped)
	/** `#12` style references, where GitHub shares one number space between issues and PRs. */
	| ({ kind: "issueOrPull"; number: number } & RepoScoped)
	| ({ kind: "commit"; sha: string } & RepoScoped)
	| ({ kind: "release"; tag: string } & RepoScoped);

/** Where a reference came from: a pasted URL or a text token like `#12`. */
export type ResourceReferenceOrigin = "url" | "text";

export type MarkdownReferenceResolver = (
	url: string,
) => ResourceReference | null;

export type RepoSlug = { owner: string; repo: string };

export type MarkdownTextReference =
	| { kind: "number"; repo: RepoSlug | null; number: number }
	| { kind: "commit"; repo: RepoSlug | null; sha: string };

export type MarkdownTextReferenceResolver = (
	reference: MarkdownTextReference,
) => ResourceReference | null;

export const MARKDOWN_MENTION_TAG = "dk-mention";
export const MARKDOWN_REFERENCE_TAG = "dk-reference";

export const MARKDOWN_REFERENCE_ATTRIBUTES = [
	"kind",
	"origin",
	"href",
	"owner",
	"repo",
	"num",
	"sha",
	"tag",
	"login",
] as const;

export function referenceToHProperties(
	ref: ResourceReference,
	origin: ResourceReferenceOrigin,
): Record<string, string> {
	const base: Record<string, string> = {
		kind: ref.kind,
		origin,
		href: ref.href,
	};
	switch (ref.kind) {
		case "user":
			base.login = ref.login;
			return base;
		case "repo":
			return { ...base, owner: ref.owner, repo: ref.repo };
		case "pull":
		case "issue":
		case "issueOrPull":
			return {
				...base,
				owner: ref.owner,
				repo: ref.repo,
				num: String(ref.number),
			};
		case "commit":
			return { ...base, owner: ref.owner, repo: ref.repo, sha: ref.sha };
		case "release":
			return { ...base, owner: ref.owner, repo: ref.repo, tag: ref.tag };
	}
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function parseNumber(value: string): number | null {
	if (!/^[1-9]\d*$/u.test(value)) {
		return null;
	}
	const number = Number(value);
	return Number.isSafeInteger(number) ? number : null;
}

/** The inverse of {@link referenceToHProperties}; `null` for malformed nodes. */
export function referenceFromProperties(
	properties: Record<string, unknown> | undefined | null,
): ResourceReference | null {
	if (!properties) {
		return null;
	}
	const kind = asString(properties.kind);
	const href = asString(properties.href);
	const owner = asString(properties.owner);
	const repo = asString(properties.repo);
	if (!href) {
		return null;
	}
	if (kind === "user") {
		const login = asString(properties.login);
		return login ? { kind, href, login } : null;
	}
	if (!(owner && repo)) {
		return null;
	}

	switch (kind) {
		case "repo":
			return { kind, href, owner, repo };
		case "pull":
		case "issue":
		case "issueOrPull": {
			const number = parseNumber(asString(properties.num));
			return number === null ? null : { kind, href, owner, repo, number };
		}
		case "commit": {
			const sha = asString(properties.sha);
			return /^[0-9a-f]{7,40}$/u.test(sha)
				? { kind, href, owner, repo, sha }
				: null;
		}
		case "release": {
			const tag = asString(properties.tag);
			return tag ? { kind, href, owner, repo, tag } : null;
		}
		default:
			return null;
	}
}

export function referenceOriginFromProperties(
	properties: Record<string, unknown> | undefined | null,
): ResourceReferenceOrigin {
	return properties?.origin === "text" ? "text" : "url";
}
