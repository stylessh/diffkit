import type { Parent } from "unist";
import {
	MARKDOWN_REFERENCE_TAG,
	type MarkdownTextReference,
	type MarkdownTextReferenceResolver,
	referenceToHProperties,
} from "./markdown-resource-reference";
import { replaceTextTokens } from "./mdast-text-tokens";

const OWNER = "[A-Za-z\\d](?:[A-Za-z\\d]|-(?=[A-Za-z\\d])){0,38}";
const REPO = "[\\w.-]{1,100}";
const SHA = "[0-9a-f]{7,40}";

/**
 * `owner/repo#12`, `owner/repo@sha`, `#12` and bare SHAs, GitHub's autolinked
 * references. The leading boundary rejects `a#1`, `&#123;` entities and paths;
 * the trailing one rejects `#12abc`.
 */
const TEXT_REFERENCE = new RegExp(
	`(^|[^\\w/#@.&-])(?:(${OWNER})/(${REPO})(?:#(\\d+)|@(${SHA}))|#(\\d+)|(${SHA}))(?![\\w-])`,
	"gu",
);

const SHORT_SHA_LENGTH = 7;

/** Rejects all-digit numbers and plain hex words like `deadbeef` or `defaced`. */
function looksLikeSha(value: string) {
	return /\d/u.test(value) && /[a-f]/u.test(value);
}

function positiveNumber(digits: string): number | null {
	const number = Number(digits);
	return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function parseMatch(
	match: RegExpMatchArray,
): { reference: MarkdownTextReference; label: string } | null {
	const [, , owner, repo, repoNumber, repoSha, number, sha] = match;
	const slug = owner && repo ? { owner, repo } : null;
	const prefix = slug ? `${slug.owner}/${slug.repo}` : "";

	const digits = repoNumber ?? number;
	if (digits) {
		const value = positiveNumber(digits);
		return value === null
			? null
			: {
					reference: { kind: "number", repo: slug, number: value },
					label: `${prefix}#${digits}`,
				};
	}

	const commit = repoSha ?? sha;
	if (!(commit && looksLikeSha(commit))) {
		return null;
	}
	const short = commit.slice(0, SHORT_SHA_LENGTH);
	return {
		reference: { kind: "commit", repo: slug, sha: commit },
		label: slug ? `${prefix}@${short}` : short,
	};
}

export function remarkTextReferences(resolve: MarkdownTextReferenceResolver) {
	return () => (tree: Parent) =>
		replaceTextTokens(tree, TEXT_REFERENCE, (match) => {
			const parsed = parseMatch(match);
			const ref = parsed ? resolve(parsed.reference) : null;
			if (!(parsed && ref)) {
				return null;
			}
			return {
				type: "link",
				url: ref.href,
				data: {
					hName: MARKDOWN_REFERENCE_TAG,
					hProperties: referenceToHProperties(ref, "text"),
				},
				children: [{ type: "text", value: parsed.label }],
			};
		});
}
