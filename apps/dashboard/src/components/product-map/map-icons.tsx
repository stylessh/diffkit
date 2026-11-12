import {
	ActionsIcon,
	ArchiveDownIcon,
	CellsIcon,
	CodeIcon,
	CodeSimpleIcon,
	CommandIcon,
	CommentIcon,
	ComputerIcon,
	DashboardIcon,
	DisplayOptionsIcon,
	FileIcon,
	GitCommitIcon,
	GitCompareIcon,
	GitHubLogo,
	GitPullRequestIcon,
	GlobeIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	LayersIcon,
	LinkIcon,
	LockKeyIcon,
	PackageIcon,
	RefreshCwIcon,
	RepoIcon,
	ReviewsIcon,
	SettingsIcon,
	TagIcon,
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
