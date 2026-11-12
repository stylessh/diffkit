const INSTALL_SKILL = "npx skills add stylessh/diffkit --skill product-map -y";

/**
 * What a repository owner pastes into a coding agent to get a product map.
 * It only points at the skill: the format, the steps and the checker live
 * there, so they can improve without anyone copying a new prompt.
 */
export function mapSetupPrompt(owner: string, repo: string) {
	return `Set up a DiffKit product map for this repository (${owner}/${repo}).

1. Install the skill: ${INSTALL_SKILL}
2. Follow its "Create it" steps, then open a pull request titled "Add a product map".
`;
}

/** The same, for a map that exists but was rejected. */
export function mapFixPrompt(problems: readonly string[]) {
	return `DiffKit rejected this repository's product map (the .diffkit folder). Fix these problems and open a pull request:

${problems.map((problem) => `- ${problem}`).join("\n")}

Use the product-map skill and run its checker until it passes. If the skill is not installed: ${INSTALL_SKILL}
`;
}
