import { CloseIcon, SearchIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import { RepoHeader } from "#/components/repo/repo-header";
import type { RepoNavKey } from "#/components/repo/repo-nav";
import type { GitHubQueryScope } from "#/lib/github.query";

export function RepoPageHeader({
	owner,
	repo,
	scope,
	active,
	trail,
	tabActions,
	toolbar,
	scrollRef,
	bodyClassName,
	children,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	active?: RepoNavKey;
	trail?: ReactNode;
	tabActions?: ReactNode;
	toolbar?: ReactNode;
	scrollRef?: RefObject<HTMLDivElement | null>;
	bodyClassName?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active={active}
				trail={trail}
				tabActions={tabActions}
			/>
			{toolbar ? (
				<div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 px-2 py-1.5">
					{toolbar}
				</div>
			) : null}
			<div
				ref={scrollRef}
				className={cn(
					"min-h-0 flex-1 overflow-y-auto px-2 pb-10",
					!toolbar && "pt-2",
					bodyClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

export { PageHeaderCrumb as RepoCrumb } from "@diffkit/ui/components/page-header";

export function RepoListSearchInput({
	value,
	onChange,
	placeholder,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	className?: string;
}) {
	return (
		<label
			className={cn(
				"flex h-7 min-w-0 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground shadow-field transition-shadow focus-within:shadow-[0_0_0_1px_var(--color-focus)]",
				className,
			)}
		>
			<SearchIcon size={13} className="shrink-0" />
			<input
				type="text"
				aria-label={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="min-w-0 flex-1 bg-transparent text-xs font-[450] text-foreground outline-none placeholder:text-muted-foreground"
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear search"
					className="-mr-1 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					<CloseIcon size={12} />
				</button>
			) : null}
		</label>
	);
}
