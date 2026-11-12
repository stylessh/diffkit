import {
	ActionsIcon,
	AlertCircleIcon,
	ArchiveDownIcon,
	CellsIcon,
	CircleCheckIcon,
	ClockIcon,
	CodeIcon,
	CodeSimpleIcon,
	CommandIcon,
	CommentIcon,
	ComputerIcon,
	DashboardIcon,
	DisplayOptionsIcon,
	DownloadIcon,
	EditIcon,
	FileIcon,
	FilterIcon,
	FolderIcon,
	GitBranchIcon,
	GitCommitIcon,
	GitCompareIcon,
	GitHubLogo,
	GitMergeIcon,
	GitPullRequestIcon,
	GlobeIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	LayersIcon,
	LinkIcon,
	LoaderCircleIcon,
	LockKeyIcon,
	PackageIcon,
	RefreshCwIcon,
	RepoIcon,
	ReviewsIcon,
	SearchIcon,
	SettingsIcon,
	SmileIcon,
	StarIcon,
	SunIcon,
	TagIcon,
	UploadIcon,
	UserMultiple02Icon,
} from "@diffkit/icons";
import type { ComponentType } from "react";

type MapIconProps = {
	size?: number;
	strokeWidth?: number;
	className?: string;
};

export type MapIcon = ComponentType<MapIconProps>;

function GitHubMark({ size = 16, className }: MapIconProps) {
	return <GitHubLogo width={size} height={size} className={className} />;
}

const areaIcons: Record<string, MapIcon> = {
	actions: ActionsIcon,
	cache: ArchiveDownIcon,
	code: CodeIcon,
	command: CommandIcon,
	comment: CommentIcon,
	commit: GitCommitIcon,
	compare: GitCompareIcon,
	computer: ComputerIcon,
	display: DisplayOptionsIcon,
	github: GitHubMark,
	globe: GlobeIcon,
	home: HomeIcon,
	inbox: InboxIcon,
	issues: IssuesIcon,
	kit: CellsIcon,
	layers: LayersIcon,
	lock: LockKeyIcon,
	package: PackageIcon,
	pull: GitPullRequestIcon,
	refresh: RefreshCwIcon,
	repo: RepoIcon,
	reviews: ReviewsIcon,
	settings: SettingsIcon,
	shell: DashboardIcon,
	tag: TagIcon,
};

export function areaIcon(name: string): MapIcon {
	return areaIcons[name] ?? CellsIcon;
}

const stepKinds: Record<string, { icon: MapIcon; label: string }> = {
	page: { icon: DashboardIcon, label: "Page" },
	component: { icon: CellsIcon, label: "Component" },
	client: { icon: ComputerIcon, label: "In the browser" },
	server: { icon: CodeSimpleIcon, label: "Server function" },
	route: { icon: LinkIcon, label: "API route" },
	github: { icon: GitHubMark, label: "GitHub" },
	storage: { icon: LayersIcon, label: "Storage" },
	external: { icon: GlobeIcon, label: "Outside" },
	tool: { icon: SettingsIcon, label: "Tooling" },
};

export function stepKind(kind: string) {
	return stepKinds[kind] ?? { icon: FileIcon, label: kind };
}

const pathKinds: [RegExp, string][] = [
	[/\/routes\/api\//, "route"],
	[/\/routes\//, "page"],
	[/^packages\/ui\/|\/components\//, "component"],
	[/^apps\/(emulator|e2e)\/|^scripts\/|^\.github\/|^docs\//, "tool"],
	[/\/db\/|\/crons\//, "storage"],
	[/^extensions\//, "external"],
	[/\.server\.|\.functions\.|\/lib\/github\//, "server"],
];

export function pathKind(path: string) {
	return pathKinds.find(([pattern]) => pattern.test(path))?.[1] ?? "client";
}

/**
 * Stands in for the icon a model would choose per sub-feature: the first word
 * family found in the name wins, and the kind of file it lives in is the fallback.
 */
const featureIcons: [RegExp, MapIcon][] = [
	[/search|go to file/, SearchIcon],
	[/filter|sort/, FilterIcon],
	[/shortcut|keyboard|command|key sequence/, CommandIcon],
	[/\blight|dark|theme|colour/, SunIcon],
	[/emoji|reaction/, SmileIcon],
	[/upload|media|image/, UploadIcon],
	[/skeleton|loading/, LoaderCircleIcon],
	[/error|404|warning|alert/, AlertCircleIcon],
	[
		/sign-in|oauth|auth|token (routing|cache)|access|protection|secret|security|private/,
		LockKeyIcon,
	],
	[/collaborator|team|organisation|orgs|account|reviewer/, UserMultiple02Icon],
	[/cache|persist|restore|stale|preload|kv /, ArchiveDownIcon],
	[/blame|commit|history/, GitCommitIcon],
	[/branch/, GitBranchIcon],
	[/merge/, GitMergeIcon],
	[/compare|diff/, GitCompareIcon],
	[/\breview/, ReviewsIcon],
	[/pull request|\bpr\b|stack/, GitPullRequestIcon],
	[/issue/, IssuesIcon],
	[/release|tag|label/, TagIcon],
	[/comment|thread|reply|mention|composer/, CommentIcon],
	[/download|asset|artifact|clone/, DownloadIcon],
	[/webhook|polling|live|invalidation|cursor|re-run|dedup/, RefreshCwIcon],
	[/table|migration|bucket|sweeper/, LayersIcon],
	[/run|job|log|workflow|check|ci /, ActionsIcon],
	[/deploy|health|production/, GlobeIcon],
	[/github|graphql/, GitHubMark],
	[/emulat|seeded|demo|playwright|sample/, ComputerIcon],
	[/extension|install|popup|package/, PackageIcon],
	[/timeline|activity|timeout|expiry/, ClockIcon],
	[/star|pinned|saved/, StarIcon],
	[/inbox|unread/, InboxIcon],
	[/select|bulk/, CircleCheckIcon],
	[/edit|draft/, EditIcon],
	[/link|redirect|url/, LinkIcon],
	[/settings|general|toggle|rule|option/, SettingsIcon],
	[/folder|tree/, FolderIcon],
	[/file|readme|markdown|docs/, FileIcon],
];

export function featureIcon(name: string, path: string): MapIcon {
	const lowered = `${name.toLowerCase()} `;
	const match = featureIcons.find(([pattern]) => pattern.test(lowered));
	return match ? match[1] : stepKind(pathKind(path)).icon;
}
