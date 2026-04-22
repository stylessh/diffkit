import {
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import type { StatePillTone } from "@diffkit/ui/components/state-pill";

export type PrStateConfig = {
	icon: React.ComponentType<{
		size?: number;
		strokeWidth?: number;
		className?: string;
	}>;
	color: string;
	label: string;
	tone: StatePillTone;
};

export function getPrStateConfig(pr: {
	isDraft: boolean;
	state: string;
	isMerged?: boolean;
	mergedAt?: string | null;
}): PrStateConfig {
	if (pr.isDraft) {
		return {
			icon: GitPullRequestDraftIcon,
			color: "text-muted-foreground",
			label: "Draft",
			tone: "muted",
		};
	}
	if (pr.isMerged || pr.mergedAt || pr.state === "merged") {
		return {
			icon: GitMergeIcon,
			color: "text-purple-500",
			label: "Merged",
			tone: "merged",
		};
	}
	if (pr.state === "closed") {
		return {
			icon: GitPullRequestClosedIcon,
			color: "text-red-500",
			label: "Closed",
			tone: "closed",
		};
	}
	return {
		icon: GitPullRequestIcon,
		color: "text-green-500",
		label: "Open",
		tone: "open",
	};
}
