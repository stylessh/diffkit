import {
	CommentIcon,
	FilterIcon,
	GitBranchIcon,
	GitPullRequestIcon,
	InboxIcon,
	ReviewsIcon,
	SearchIcon,
	Sorting01Icon,
} from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListGroup, ListPage } from "#/components/shared/list-page";
import {
	allPreviewPulls,
	type PreviewWorkspace,
} from "./product-preview-samples";

export function PreviewListActions() {
	return (
		<>
			<PageIconButton raised aria-label="Search">
				<SearchIcon size={14} strokeWidth={2} />
			</PageIconButton>
			<PageIconButton raised aria-label="Filter">
				<FilterIcon size={14} strokeWidth={2} />
			</PageIconButton>
			<PageIconButton raised aria-label="Sort">
				<Sorting01Icon size={14} strokeWidth={2} />
			</PageIconButton>
		</>
	);
}

export function PreviewPullsPage({ pulls }: Pick<PreviewWorkspace, "pulls">) {
	const groups = [
		{
			title: "Review requested",
			icon: ReviewsIcon,
			pulls: pulls.reviewRequested,
		},
		{ title: "Assigned", icon: InboxIcon, pulls: pulls.assigned },
		{ title: "Authored", icon: GitPullRequestIcon, pulls: pulls.authored },
		{ title: "Mentioned", icon: CommentIcon, pulls: pulls.mentioned },
		{ title: "Involved", icon: GitBranchIcon, pulls: pulls.involved },
	];
	return (
		<ListPage
			title="Pull Requests"
			count={allPreviewPulls(pulls).length}
			className="overflow-hidden"
			actions={<PreviewListActions />}
		>
			{groups.map((group) => (
				<ListGroup
					key={group.title}
					icon={group.icon}
					title={group.title}
					count={group.pulls.length}
				>
					{group.pulls.map((pull) => (
						<PullRequestRow key={pull.id} pr={pull} />
					))}
				</ListGroup>
			))}
		</ListPage>
	);
}
