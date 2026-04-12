import {
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";

export type PrStateConfig = {
	icon: React.ComponentType<{
		size?: number;
		strokeWidth?: number;
		className?: string;
	}>;
	color: string;
	label: string;
	badgeClass: string;
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
			badgeClass: "bg-muted text-muted-foreground",
		};
	}
	if (pr.isMerged || pr.mergedAt || pr.state === "merged") {
		return {
			icon: GitMergeIcon,
			color: "text-purple-500",
			label: "Merged",
			badgeClass: "bg-purple-500/10 text-purple-500",
		};
	}
	if (pr.state === "closed") {
		return {
			icon: GitPullRequestClosedIcon,
			color: "text-red-500",
			label: "Closed",
			badgeClass: "bg-red-500/10 text-red-500",
		};
	}
	return {
		icon: GitPullRequestIcon,
		color: "text-green-500",
		label: "Open",
		badgeClass: "bg-green-500/10 text-green-500",
	};
}
