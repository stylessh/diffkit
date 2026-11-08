export type LabelDraft = {
	name: string;
	color: string;
	description: string;
};

export const LABEL_NAME_MAX = 50;
export const LABEL_DESCRIPTION_MAX = 100;

const HEX_COLOR = /^[0-9a-f]{6}$/;

export function normalizeLabelColor(input: string) {
	return input.trim().replace(/^#/, "").toLowerCase();
}

export function validateLabelDraft(
	draft: LabelDraft,
	otherNames: readonly string[],
) {
	const name = draft.name.trim();
	if (name === "") return "Enter a label name.";
	if (name.length > LABEL_NAME_MAX) {
		return `Label names can be at most ${LABEL_NAME_MAX} characters.`;
	}
	if (otherNames.some((other) => other.toLowerCase() === name.toLowerCase())) {
		return "A label with that name already exists.";
	}
	if (!HEX_COLOR.test(normalizeLabelColor(draft.color))) {
		return "Use a six-digit hex colour, like 0075ca.";
	}
	if (draft.description.trim().length > LABEL_DESCRIPTION_MAX) {
		return `Descriptions can be at most ${LABEL_DESCRIPTION_MAX} characters.`;
	}
	return null;
}

export function labelRequestBody(draft: LabelDraft) {
	return {
		name: draft.name.trim(),
		color: normalizeLabelColor(draft.color),
		description: draft.description.trim(),
	};
}

export const LABEL_COLORS = [
	"0075ca",
	"d73a4a",
	"e4e669",
	"008672",
	"7057ff",
	"d876e3",
	"a2eeef",
	"e99695",
	"c5def5",
	"c2e0c6",
	"f9d0c4",
	"bfdadc",
] as const;

export function suggestLabelColor(used: readonly string[]) {
	const taken = new Set(used.map(normalizeLabelColor));
	return LABEL_COLORS.find((color) => !taken.has(color)) ?? LABEL_COLORS[0];
}
