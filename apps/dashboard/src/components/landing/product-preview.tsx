import { cn } from "@diffkit/ui/lib/utils";
import { CatchBoundary } from "@tanstack/react-router";
import {
	lazy,
	type MouseEvent,
	type ReactNode,
	Suspense,
	type SyntheticEvent,
	useMemo,
	useState,
} from "react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import { AppTopbar, MobileTopbar } from "#/components/shell/app-topbar";
import { workspaceNavItems } from "#/components/shell/workspace-nav";
import type { NotificationItem } from "#/lib/github.types";
import { parseSubjectRef, subjectHref } from "#/lib/inbox";
import { type PreviewInbox, usePreviewInbox } from "./product-preview-inbox";
import { PreviewPullsPage } from "./product-preview-list";
import {
	allPreviewPulls,
	PREVIEW_COUNTS,
	PREVIEW_VIEWER,
	PREVIEW_VIEWER_LOGIN,
	type PreviewWorkspace,
	previewWorkspace,
} from "./product-preview-samples";
import {
	type PreviewPage,
	type PreviewView,
	viewForHref,
} from "./product-preview-views";

const loadPages = () => import("./product-preview-pages");
const loadPullPage = () => import("./product-preview-pull");
const ProductPreviewPage = lazy(loadPages);
const ProductPreviewPull = lazy(loadPullPage);

function loadOtherViews() {
	void loadPages();
	void loadPullPage();
}

/* The router marks no workspace link active on this page, so the selection is drawn here. */
const ACTIVE_NAV: Record<PreviewPage, string> = {
	overview:
		"[&_header_a[href='/']]:bg-nav-selected [&_header_a[href='/']]:text-foreground",
	inbox:
		"[&_header_a[href='/inbox']]:bg-nav-selected [&_header_a[href='/inbox']]:text-foreground",
	pulls:
		"[&_header_a[href='/pulls']]:bg-nav-selected [&_header_a[href='/pulls']]:text-foreground",
	reviews:
		"[&_header_a[href='/reviews']]:bg-nav-selected [&_header_a[href='/reviews']]:text-foreground",
	issues:
		"[&_header_a[href='/issues']]:bg-nav-selected [&_header_a[href='/issues']]:text-foreground",
	drafts:
		"[&_header_a[href='/drafts']]:bg-nav-selected [&_header_a[href='/drafts']]:text-foreground",
};

/* Search, create and the account menu all need a signed-in account. */
const ACCOUNT_CONTROLS = "header button";

/**
 * These views are written for signed-in routes. If a part of one ever reaches
 * for that context, the preview loses a view, not the landing page.
 */
function ViewUnavailable() {
	return null;
}

function viewKey(view: PreviewView) {
	return view.kind === "pull" ? `pull-${view.pull.id}` : view.page;
}

function Deferred({
	view,
	children,
}: {
	view: PreviewView;
	children: ReactNode;
}) {
	return (
		<CatchBoundary
			getResetKey={() => viewKey(view)}
			errorComponent={ViewUnavailable}
		>
			<Suspense fallback={null}>{children}</Suspense>
		</CatchBoundary>
	);
}

function PreviewContent({
	view,
	workspace,
	inbox,
	onOpenNotification,
}: {
	view: PreviewView;
	workspace: PreviewWorkspace;
	inbox: PreviewInbox;
	onOpenNotification: (item: NotificationItem) => void;
}) {
	if (view.kind === "pull") {
		return (
			<Deferred view={view}>
				<ProductPreviewPull
					key={view.pull.id}
					pull={view.pull}
					reviewRequested={workspace.pulls.reviewRequested.includes(view.pull)}
				/>
			</Deferred>
		);
	}
	if (view.page === "pulls") {
		return <PreviewPullsPage pulls={workspace.pulls} />;
	}
	return (
		<Deferred view={view}>
			<ProductPreviewPage
				page={view.page}
				workspace={workspace}
				inbox={inbox}
				onOpenNotification={onOpenNotification}
			/>
		</Deferred>
	);
}

function ignoreAccountControls(event: SyntheticEvent) {
	if ((event.target as Element).closest(ACCOUNT_CONTROLS)) {
		event.stopPropagation();
	}
}

/**
 * The app as a visitor can try it: the real shell, list and detail components
 * on sample data. Links move between the preview's own views instead of
 * routes, and nothing in it fetches.
 */
export function ProductPreview({ className }: { className?: string }) {
	const workspace = useMemo(() => previewWorkspace(Date.now()), []);
	const pulls = useMemo(() => allPreviewPulls(workspace.pulls), [workspace]);
	const inbox = usePreviewInbox(workspace.notifications);
	const [view, setView] = useState<PreviewView>({
		kind: "page",
		page: "pulls",
	});

	const openHref = (href: string) => {
		const next = viewForHref(href, pulls);
		if (next) setView(next);
	};

	const followLink = (event: MouseEvent<HTMLDivElement>) => {
		const target = event.target as Element;
		if (target.closest(ACCOUNT_CONTROLS)) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		const link = target.closest("a[href]");
		if (!link) return;
		event.preventDefault();
		event.stopPropagation();
		openHref(link.getAttribute("href") ?? "");
	};

	const openNotification = (item: NotificationItem) => {
		const subject = parseSubjectRef(item);
		if (subject) openHref(subjectHref(subject));
	};

	return (
		<section
			aria-label="Product preview with sample data"
			className={cn(
				"overflow-hidden rounded-2xl bg-shell shadow-[0_32px_64px_-32px_rgb(15_23_42/0.18)] dark:shadow-none",
				className,
			)}
		>
			<SkeletonSample>
				<div
					className={cn(
						"isolate flex h-full flex-col max-md:pointer-events-none",
						view.kind === "page" && ACTIVE_NAV[view.page],
					)}
					onClickCapture={followLink}
					onPointerDownCapture={ignoreAccountControls}
					onKeyDownCapture={ignoreAccountControls}
					onPointerEnter={loadOtherViews}
				>
					<AppTopbar
						user={PREVIEW_VIEWER}
						viewerLogin={PREVIEW_VIEWER_LOGIN}
						navItems={workspaceNavItems(
							PREVIEW_COUNTS,
							inbox.items.some((item) => item.unread),
						)}
						modKey="⌘"
					/>
					<MobileTopbar
						user={PREVIEW_VIEWER}
						viewerLogin={PREVIEW_VIEWER_LOGIN}
					/>
					<div className="flex flex-1 overflow-hidden md:px-2 md:pt-0.5 md:pb-2">
						<div className="relative min-w-0 flex-1 overflow-hidden bg-main md:rounded-xl md:shadow-main">
							<PreviewContent
								view={view}
								workspace={workspace}
								inbox={inbox}
								onOpenNotification={openNotification}
							/>
						</div>
					</div>
				</div>
			</SkeletonSample>
		</section>
	);
}
