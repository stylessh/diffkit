import { parseAsBoolean, useQueryState } from "nuqs";

export const showOrgSetupParser = parseAsBoolean
	.withDefault(false)
	.withOptions({ history: "replace" });

export function useShowOrgSetupQueryState() {
	return useQueryState("show-org-setup", showOrgSetupParser);
}
