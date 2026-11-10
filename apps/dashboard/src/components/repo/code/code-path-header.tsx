import { CheckIcon, CodeIcon, CopyIcon } from "@diffkit/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { type CodeView, codeSplat } from "#/lib/code-browsing/code-location";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { RepoRefPicker } from "../refs/repo-ref-picker";
import { iconButtonClassName } from "../repo-ui";
import type { BlobLocation } from "./blob-header";
import { FileFinder } from "./file-finder";

const VIEW_ROUTES = {
	tree: "/$owner/$repo/tree/$",
	blob: "/$owner/$repo/blob/$",
	blame: "/$owner/$repo/blame/$",
} as const;

export function CodePathHeader({
	scope,
	repo,
	location,
	view,
	leading,
	finderOpen,
	onFinderOpenChange,
	compact = false,
}: {
	scope: GitHubQueryScope;
	repo: RepoOverview;
	location: BlobLocation;
	view: CodeView;
	leading?: ReactNode;
	finderOpen?: boolean;
	onFinderOpenChange?: (open: boolean) => void;
	/** On phones the finder and code search live in the floating action bar. */
	compact?: boolean;
}) {
	const navigate = useNavigate();
	const { owner, repo: repoName, ref, path } = location;

	const switchRef = (nextRef: string) => {
		if (nextRef === ref) return;
		void navigate({
			to: VIEW_ROUTES[view],
			params: { owner, repo: repoName, _splat: codeSplat(nextRef, path) },
		});
	};

	return (
		<div className="sticky top-0 z-30 flex h-11 min-w-0 items-center gap-2 border-b-[0.5px] border-header-rule bg-main px-3 md:px-4">
			{leading}
			<RepoRefPicker
				owner={owner}
				repo={repoName}
				scope={scope}
				currentRef={ref}
				defaultBranch={repo.defaultBranch}
				onSelect={switchRef}
			/>
			<PathBreadcrumb location={location} />
			<div
				className={cn(
					"ml-auto flex shrink-0 items-center gap-1",
					compact && "max-md:hidden",
				)}
			>
				<FileFinder
					scope={scope}
					owner={owner}
					repo={repoName}
					currentRef={ref}
					open={finderOpen}
					onOpenChange={onFinderOpenChange}
				/>
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/search"
							params={{ owner, repo: repoName }}
							aria-label="Search code"
							className={iconButtonClassName}
						>
							<CodeIcon size={15} />
						</Link>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						Search code in this repository
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}

function PathBreadcrumb({ location }: { location: BlobLocation }) {
	const { owner, repo, ref, path } = location;
	const segments = path ? path.split("/") : [];
	const [copied, setCopied] = useState(false);

	return (
		<nav
			aria-label="Path"
			className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[13px] font-medium whitespace-nowrap [scrollbar-width:none]"
		>
			<Link
				to="/$owner/$repo/tree/$"
				params={{ owner, repo, _splat: ref }}
				className={cn(
					"shrink-0 rounded-sm transition-colors hover:text-foreground",
					segments.length ? "text-muted-foreground" : "text-foreground",
				)}
			>
				{repo}
			</Link>
			{segments.map((segment, index) => {
				const segmentPath = segments.slice(0, index + 1).join("/");
				const isLast = index === segments.length - 1;
				return (
					<span key={segmentPath} className="flex shrink-0 items-center gap-1">
						<span aria-hidden className="text-icon-faint">
							/
						</span>
						{isLast ? (
							<span aria-current="page" className="text-foreground">
								{segment}
							</span>
						) : (
							<Link
								to="/$owner/$repo/tree/$"
								params={{ owner, repo, _splat: `${ref}/${segmentPath}` }}
								className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
							>
								{segment}
							</Link>
						)}
					</span>
				);
			})}
			{path ? (
				<button
					type="button"
					aria-label={copied ? "Copied" : "Copy path"}
					onClick={() => {
						void navigator.clipboard?.writeText(path).then(() => {
							setCopied(true);
							setTimeout(() => setCopied(false), 1500);
						});
					}}
					className={cn(iconButtonClassName, "size-6 shrink-0")}
				>
					{copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
				</button>
			) : null}
		</nav>
	);
}
