import { useEffect, useState } from "react";

export function useMergeBypass({
	isMergeBlocked,
	canBypassProtections,
	hasConflicts,
}: {
	isMergeBlocked: boolean;
	canBypassProtections: boolean;
	hasConflicts: boolean;
}) {
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		if (!isMergeBlocked) setChecked(false);
	}, [isMergeBlocked]);

	// Bypass is only relevant when merge is blocked by branch protection rules,
	// not by conflicts — GitHub will always reject merging conflicting branches
	// regardless of bypass permissions.
	const canBypass = isMergeBlocked && canBypassProtections && !hasConflicts;

	return {
		shouldBypass: canBypass && checked,
		showOption: canBypass,
		checked,
		setChecked,
	};
}
