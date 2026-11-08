/**
 * Shared types for "rich" resource references in markdown (users, repos, pull
 * requests, issues, releases). The UI library stays provider-agnostic: the app
 * supplies a {@link MarkdownReferenceResolver} that maps a pasted URL to a
 * {@link ResourceReference}, and a component to render it.
 */

export type ResourceReferenceKind =
	| "user"
	| "repo"
	| "pull"
	| "issue"
	| "release";

export type ResourceReference =
	| { kind: "user"; href: string; login: string }
	| { kind: "repo"; href: string; owner: string; repo: string }
	| { kind: "pull"; href: string; owner: string; repo: string; number: number }
	| { kind: "issue"; href: string; owner: string; repo: string; number: number }
	| {
			kind: "release";
			href: string;
			owner: string;
			repo: string;
			tag: string;
	  };

/** Returns a reference when `url` points at a known resource, else `null`. */
export type MarkdownReferenceResolver = (
	url: string,
) => ResourceReference | null;

/** Custom hast element tag names emitted by the markdown remark plugins. */
export const MARKDOWN_MENTION_TAG = "dk-mention";
export const MARKDOWN_REFERENCE_TAG = "dk-reference";

/** Serialize a reference into hast element properties (all string values). */
export function referenceToHProperties(
	ref: ResourceReference,
): Record<string, string> {
	const base: Record<string, string> = { kind: ref.kind, href: ref.href };
	switch (ref.kind) {
		case "user":
			base.login = ref.login;
			break;
		case "repo":
			base.owner = ref.owner;
			base.repo = ref.repo;
			break;
		case "pull":
		case "issue":
			base.owner = ref.owner;
			base.repo = ref.repo;
			base.num = String(ref.number);
			break;
		case "release":
			base.owner = ref.owner;
			base.repo = ref.repo;
			base.tag = ref.tag;
			break;
		default:
			break;
	}
	return base;
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * Rebuild a {@link ResourceReference} from hast element properties (the inverse
 * of {@link referenceToHProperties}). Returns `null` for malformed nodes so the
 * renderer can fall back to plain text.
 */
export function referenceFromProperties(
	properties: Record<string, unknown> | undefined | null,
): ResourceReference | null {
	if (!properties) return null;
	const kind = asString(properties.kind);
	const href = asString(properties.href);
	const owner = asString(properties.owner);
	const repo = asString(properties.repo);
	if (!href) return null;

	switch (kind) {
		case "user": {
			const login = asString(properties.login);
			if (!login) return null;
			return { kind, href, login };
		}
		case "repo": {
			if (!owner || !repo) return null;
			return { kind, href, owner, repo };
		}
		case "pull":
		case "issue": {
			const rawNumber = asString(properties.num);
			if (!/^[1-9]\d*$/u.test(rawNumber)) return null;
			const number = Number(rawNumber);
			if (!owner || !repo || !Number.isSafeInteger(number)) return null;
			return { kind, href, owner, repo, number };
		}
		case "release": {
			const tag = asString(properties.tag);
			if (!owner || !repo || !tag) return null;
			return { kind, href, owner, repo, tag };
		}
		default:
			return null;
	}
}
