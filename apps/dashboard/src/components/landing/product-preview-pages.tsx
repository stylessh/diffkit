import {
	CommentIcon,
	InboxIcon,
	IssuesIcon,
	ReviewsIcon,
} from "@diffkit/icons";
import { ReviewDraftsEmptyState } from "#/components/drafts/review-drafts-page";
import { InboxList } from "#/components/inbox/inbox-list";
import { InboxPreview } from "#/components/inbox/inbox-preview";
import { IssueRow } from "#/components/issues/issue-row";
import { OverviewContent } from "#/components/overview/overview-content";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListGroup, ListPage } from "#/components/shared/list-page";
import type { NotificationItem } from "#/lib/github.types";
import { groupNotifications, type InboxFilter } from "#/lib/inbox";
import type { PreviewInbox } from "./product-preview-inbox";
import { PreviewListActions } from "./product-preview-list";
import {
	PREVIEW_VIEWER,
	type PreviewWorkspace,
} from "./product-preview-samples";
import type { PreviewPage } from "./product-preview-views";

function ReviewsPage({ pulls }: Pick<PreviewWorkspace, "pulls">) {
	return (
		<ListPage
			title="Reviews"
			count={pulls.reviewRequested.length}
			className="overflow-hidden"
			actions={<PreviewListActions />}
		>
			<ListGroup
				icon={ReviewsIcon}
				title="Review requested"
				count={pulls.reviewRequested.length}
			>
				{pulls.reviewRequested.map((pull) => (
					<PullRequestRow key={pull.id} pr={pull} />
				))}
			</ListGroup>
		</ListPage>
	);
}

function IssuesPage({ issues }: Pick<PreviewWorkspace, "issues">) {
	const groups = [
		{ title: "Assigned", icon: InboxIcon, issues: issues.assigned },
		{ title: "Authored", icon: IssuesIcon, issues: issues.authored },
		{ title: "Mentioned", icon: CommentIcon, issues: issues.mentioned },
	];
	return (
		<ListPage
			title="Issues"
			count={groups.reduce((sum, group) => sum + group.issues.length, 0)}
			className="overflow-hidden"
			actions={<PreviewListActions />}
		>
			{groups.map((group) => (
				<ListGroup
					key={group.title}
					icon={group.icon}
					title={group.title}
					count={group.issues.length}
				>
					{group.issues.map((issue) => (
						<IssueRow key={issue.id} issue={issue} />
					))}
				</ListGroup>
			))}
		</ListPage>
	);
}

function DraftsPage() {
	return (
		<ListPage title="Drafts" count={0} className="overflow-hidden">
			<ReviewDraftsEmptyState />
		</ListPage>
	);
}

const INBOX_FILTERS: Record<
	InboxFilter,
	(item: NotificationItem, savedIds: ReadonlySet<string>) => boolean
> = {
	unread: (item) => item.unread,
	all: () => true,
	saved: (item, savedIds) => savedIds.has(item.id),
};

function InboxPage({
	inbox,
	onOpen,
}: {
	inbox: PreviewInbox;
	onOpen: (item: NotificationItem) => void;
}) {
	const matches = INBOX_FILTERS[inbox.filter];
	const visible = inbox.items.filter((item) => matches(item, inbox.savedIds));

	return (
		<div className="flex h-full min-h-0">
			<InboxList
				filter={inbox.filter}
				onFilterChange={inbox.setFilter}
				counts={{
					unread: inbox.items.filter((item) => item.unread).length,
					all: null,
					saved: inbox.savedIds.size,
				}}
				grouping={inbox.grouping}
				onGroupingChange={inbox.setGrouping}
				groups={groupNotifications(visible, inbox.grouping)}
				collapsed={inbox.collapsed}
				onToggleGroup={inbox.toggleGroup}
				selectedId={null}
				savedIds={inbox.savedIds}
				isRefreshing={false}
				onSelect={(item) => {
					inbox.markRead(item);
					onOpen(item);
				}}
				onMarkRead={inbox.markRead}
				onMarkDone={inbox.markDone}
				onToggleSaved={inbox.toggleSaved}
				onMarkAllRead={inbox.markAllRead}
				onMarkReadDone={inbox.clearRead}
			/>
			<InboxPreview
				item={null}
				userId={PREVIEW_VIEWER.id}
				saved={false}
				onToggleSaved={inbox.toggleSaved}
				onUnsubscribe={inbox.markDone}
				onMarkDone={inbox.markDone}
			/>
		</div>
	);
}

/** Every page but the pull request list, which the landing page renders up front. */
export default function ProductPreviewPage({
	page,
	workspace,
	inbox,
	onOpenNotification,
}: {
	page: Exclude<PreviewPage, "pulls">;
	workspace: PreviewWorkspace;
	inbox: PreviewInbox;
	onOpenNotification: (item: NotificationItem) => void;
}) {
	switch (page) {
		case "overview":
			return (
				<OverviewContent
					firstName={PREVIEW_VIEWER.name?.split(" ")[0] ?? ""}
					pulls={workspace.pulls}
					issues={workspace.issues}
				/>
			);
		case "inbox":
			return <InboxPage inbox={inbox} onOpen={onOpenNotification} />;
		case "reviews":
			return <ReviewsPage pulls={workspace.pulls} />;
		case "issues":
			return <IssuesPage issues={workspace.issues} />;
		case "drafts":
			return <DraftsPage />;
	}
}
