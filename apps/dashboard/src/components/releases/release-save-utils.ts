import type {
	RepoRelease,
	SaveRepoReleaseInput,
	UpdateRepoReleaseInput,
} from "#/lib/github.types";

/**
 * Git ref-name rules (subset of `git check-ref-format`) that GitHub enforces
 * for tag names: no control chars, spaces, `~^:?*[\`, `..`, `@{`, no leading
 * or trailing `/` or `.`, no `.lock` suffix, no empty path components.
 */
const RELEASE_TAG_REGEX =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
	/^(?!\/)(?!.*\/\/)(?!.*\/$)(?!.*\.\.)(?!.*@\{)(?!.*\.lock(?:\/|$))(?!.*\/\.)(?!\.)[^\x00-\x20\x7f~^:?*[\\]+(?<!\.)$/;

export const RELEASE_TAG_FORMAT_MESSAGE =
	"Tags can't contain spaces, ~ ^ : ? * [ \\, or '..', and can't start or end with '/' or '.'";

export function validateReleaseTag(tag: string): string | null {
	const trimmed = tag.trim();
	if (!trimmed) return "Choose an existing tag or create a new one";
	if (trimmed === "@") return RELEASE_TAG_FORMAT_MESSAGE;
	return RELEASE_TAG_REGEX.test(trimmed) ? null : RELEASE_TAG_FORMAT_MESSAGE;
}

export type ReleaseFormState = {
	tagName: string;
	/** Branch the tag is created from — only sent when the tag is new. */
	targetCommitish: string;
	/** Changelog range start for "Generate release notes". */
	previousTagName: string;
	name: string;
	body: string;
	prerelease: boolean;
	makeLatest: boolean;
};

export function initialReleaseFormState({
	release,
	defaultBranch,
}: {
	release?: RepoRelease | null;
	defaultBranch: string;
}): ReleaseFormState {
	if (!release) {
		return {
			tagName: "",
			targetCommitish: defaultBranch,
			previousTagName: "",
			name: "",
			body: "",
			prerelease: false,
			makeLatest: true,
		};
	}
	return {
		tagName: release.tagName,
		targetCommitish: release.targetCommitish || defaultBranch,
		previousTagName: "",
		// GitHub echoes the tag as the name when the title was left blank.
		name: release.name === release.tagName ? "" : release.name,
		body: release.body,
		prerelease: release.isPrerelease,
		// Drafts are never "latest" yet; GitHub's default on publish is latest.
		makeLatest: release.isDraft ? true : release.isLatest,
	};
}

export type ReleaseFormErrors = Partial<
	Record<"tagName" | "name" | "body", string>
>;

const MAX_RELEASE_BODY_LENGTH = 125_000;

export function validateReleaseForm(
	form: ReleaseFormState,
	{
		releasedTags = [],
		editingTag,
	}: {
		/** Tags that already have a release (published or draft). */
		releasedTags?: readonly string[];
		/** Tag of the release being edited — allowed to stay the same. */
		editingTag?: string;
	} = {},
): ReleaseFormErrors {
	const errors: ReleaseFormErrors = {};
	const tag = form.tagName.trim();
	const tagError = validateReleaseTag(tag);
	if (tagError) {
		errors.tagName = tagError;
	} else if (tag !== editingTag && releasedTags.includes(tag)) {
		errors.tagName = "A release for this tag already exists";
	}
	if (form.name.length > 1024) {
		errors.name = "Title is too long";
	}
	if (form.body.length > MAX_RELEASE_BODY_LENGTH) {
		errors.body = "Release notes are too long";
	}
	return errors;
}

export type ReleaseSaveIntent = "publish" | "draft";

/**
 * Builds the create/update payload. Notable rules:
 * - Saving a published release never demotes it to a draft.
 * - `make_latest` only applies to published releases; prereleases are never
 *   latest. Edits to an already-published release only send it when the
 *   switch changed, so a failed "latest" lookup can't demote the real latest.
 * - The target branch is only sent for new tags (GitHub ignores it otherwise,
 *   and sending a stale branch for an existing tag is misleading).
 */
export function buildReleaseSavePayload({
	owner,
	repo,
	form,
	intent,
	existing,
	tagExists,
}: {
	owner: string;
	repo: string;
	form: ReleaseFormState;
	intent: ReleaseSaveIntent;
	existing?: RepoRelease | null;
	tagExists: boolean;
}): SaveRepoReleaseInput | UpdateRepoReleaseInput {
	const tagName = form.tagName.trim();
	const draft = existing && !existing.isDraft ? false : intent === "draft";
	const published = !draft;
	const wantsLatest = form.makeLatest && !form.prerelease;
	const sendMakeLatest =
		published &&
		(!existing || existing.isDraft || wantsLatest !== existing.isLatest);
	const payload: SaveRepoReleaseInput = {
		owner,
		repo,
		tagName,
		name: form.name.trim() || tagName,
		body: form.body,
		draft,
		prerelease: form.prerelease,
		...(tagExists ? {} : { targetCommitish: form.targetCommitish.trim() }),
		...(sendMakeLatest
			? { makeLatest: wantsLatest ? ("true" as const) : ("false" as const) }
			: {}),
	};
	return existing ? { ...payload, releaseId: existing.id } : payload;
}

/**
 * Generated notes arrive asynchronously. Only apply them when the range they
 * were generated for is still selected and the user hasn't typed meanwhile.
 */
export function shouldApplyGeneratedReleaseNotes({
	currentKey,
	requestKey,
	currentNotes,
	baselineNotes,
}: {
	currentKey: string;
	requestKey: string;
	currentNotes: string;
	baselineNotes: string;
}): boolean {
	return currentKey === requestKey && currentNotes === baselineNotes;
}

export function releaseNotesRangeKey(
	form: Pick<
		ReleaseFormState,
		"tagName" | "targetCommitish" | "previousTagName"
	>,
) {
	return `${form.previousTagName.trim()}...${form.targetCommitish.trim()}->${form.tagName.trim()}`;
}

export type ReleaseStatusBadge = "draft" | "prerelease" | "latest";

export function releaseStatusBadges(
	release: Pick<RepoRelease, "isDraft" | "isPrerelease" | "isLatest">,
): ReleaseStatusBadge[] {
	const badges: ReleaseStatusBadge[] = [];
	if (release.isDraft) badges.push("draft");
	if (release.isPrerelease) badges.push("prerelease");
	if (release.isLatest && !release.isDraft) badges.push("latest");
	return badges;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const exponent = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		BYTE_UNITS.length - 1,
	);
	const value = bytes / 1024 ** exponent;
	const digits = exponent === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
	return `${Number(value.toFixed(digits))} ${BYTE_UNITS[exponent]}`;
}
