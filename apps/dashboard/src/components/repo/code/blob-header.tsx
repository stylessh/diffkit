import {
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	ExternalLinkIcon,
	LinkIcon,
} from "@diffkit/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { encodeRefPath } from "#/lib/commits-route";
import { iconButtonClassName } from "../repo-ui";

export type BlobLocation = {
	owner: string;
	repo: string;
	ref: string;
	path: string;
};

export function githubRawUrl({ owner, repo, ref, path }: BlobLocation) {
	return `https://github.com/${owner}/${repo}/raw/${encodeRefPath(ref)}/${encodeRefPath(path)}`;
}

export function downloadBytes(fileName: string, data: BlobPart, type: string) {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function base64Bytes(base64: string) {
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const segmentClassName =
	"flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors";

export function SegmentLinks({
	location,
	view,
}: {
	location: BlobLocation;
	view: "blob" | "blame";
}) {
	const params = {
		owner: location.owner,
		repo: location.repo,
		_splat: `${location.ref}/${location.path}`,
	};
	const items = [
		{ view: "blob", label: "Code", to: "/$owner/$repo/blob/$" },
		{ view: "blame", label: "Blame", to: "/$owner/$repo/blame/$" },
	] as const;
	return (
		<nav aria-label="File view" className="flex items-center gap-0.5">
			{items.map((item) => (
				<Link
					key={item.view}
					to={item.to}
					params={params}
					aria-current={item.view === view ? "page" : undefined}
					className={cn(
						segmentClassName,
						item.view === view
							? "bg-tab-selected text-foreground shadow-tab-selected"
							: "text-muted-foreground hover:bg-ghost-hover hover:text-foreground",
					)}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}

export function SegmentToggle<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: ReadonlyArray<{ value: T; label: string }>;
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		<fieldset className="flex items-center gap-0.5">
			<legend className="sr-only">{label}</legend>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={option.value === value}
					onClick={() => onChange(option.value)}
					className={cn(
						segmentClassName,
						option.value === value
							? "bg-tab-selected text-foreground shadow-tab-selected"
							: "text-muted-foreground hover:bg-ghost-hover hover:text-foreground",
					)}
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
}

function HeaderAction({
	label,
	children,
	...props
}: {
	label: string;
	children: ReactNode;
} & (
	| { onClick: () => void; href?: never }
	| { href: string; onClick?: never }
)) {
	const className = iconButtonClassName;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{props.href ? (
					<a
						href={props.href}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={label}
						className={className}
					>
						{children}
					</a>
				) : (
					<button
						type="button"
						onClick={props.onClick}
						aria-label={label}
						className={className}
					>
						{children}
					</button>
				)}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

function useCopiedFlash() {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	const flash = () => {
		setCopied(true);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(false), 1500);
	};
	return { copied, flash };
}

export function BlobHeader({
	location,
	stats,
	leading,
	copyText,
	onDownload,
	onCopyPermalink,
}: {
	location: BlobLocation;
	stats?: ReactNode;
	leading?: ReactNode;
	copyText?: string;
	onDownload?: () => void;
	onCopyPermalink: () => void;
}) {
	const { copied, flash } = useCopiedFlash();
	return (
		<div className="flex h-10 min-w-0 items-center gap-3 border-b-[0.5px] border-card-border pr-2 pl-3 text-xs font-[450] text-muted-foreground">
			{leading}
			{stats ? (
				<span className="min-w-0 truncate tabular-nums max-sm:hidden">
					{stats}
				</span>
			) : null}
			<div className="ml-auto flex shrink-0 items-center gap-0.5">
				{copyText !== undefined ? (
					<HeaderAction
						label={copied ? "Copied" : "Copy contents"}
						onClick={() => {
							void navigator.clipboard.writeText(copyText).then(flash);
						}}
					>
						{copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
					</HeaderAction>
				) : null}
				<HeaderAction label="Copy permalink (Y)" onClick={onCopyPermalink}>
					<LinkIcon size={14} />
				</HeaderAction>
				<HeaderAction label="View raw on GitHub" href={githubRawUrl(location)}>
					<ExternalLinkIcon size={14} />
				</HeaderAction>
				{onDownload ? (
					<HeaderAction label="Download" onClick={onDownload}>
						<DownloadIcon size={14} />
					</HeaderAction>
				) : null}
			</div>
		</div>
	);
}
