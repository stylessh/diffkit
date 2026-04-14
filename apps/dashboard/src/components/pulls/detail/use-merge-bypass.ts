import { useEffect, useState } from "react";

export function useMergeBypass({
	isMergeBlocked,
	canBypassProtections,
	hasCheckFailures,
	hasReviewIssue,
	hasConflicts,
	isBehind,
	allChecksPassed,
	totalChecks,
}: {
	isMergeBlocked: boolean;
	canBypassProtections: boolean;
	hasCheckFailures: boolean;
	hasReviewIssue: boolean;
	hasConflicts: boolean;
	isBehind: boolean;
	allChecksPassed: boolean;
	totalChecks: number;
}) {
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		if (!isMergeBlocked) setChecked(false);
	}, [isMergeBlocked]);

	const allCriteriaMet =
		!hasCheckFailures &&
		!hasReviewIssue &&
		!hasConflicts &&
		!isBehind &&
		(totalChecks === 0 || allChecksPassed);

	const auto = canBypassProtections && isMergeBlocked && allCriteriaMet;

	return {
		shouldBypass: auto || checked,
		showOption: isMergeBlocked && canBypassProtections && !allCriteriaMet,
		checked,
		setChecked,
	};
}
