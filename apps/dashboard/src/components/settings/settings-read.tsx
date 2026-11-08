import { ExternalLinkIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import type { UseQueryResult } from "@tanstack/react-query";
import type * as React from "react";
import type { SettingsRead } from "#/lib/settings/read-result";
import { SettingsGroup } from "./settings-group";

export function SettingsSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<output
			aria-label="Loading"
			className="block overflow-hidden rounded-lg bg-card shadow-card"
		>
			{Array.from({ length: rows }, (_, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
					key={index}
					className="flex h-11 items-center gap-3 border-t-[0.5px] border-rule px-4 first:border-t-0"
				>
					<Skeleton className="size-5 rounded-full" />
					<Skeleton className="h-3 w-40" />
					<Skeleton className="ml-auto h-3 w-16" />
				</div>
			))}
		</output>
	);
}

export function SettingsNotice({
	title,
	children,
	action,
}: {
	title: string;
	children?: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<SettingsGroup>
			<div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
				<p className="text-[13px] font-medium text-text-header">{title}</p>
				{children ? (
					<p className="max-w-sm text-[13px] text-pretty text-muted-foreground">
						{children}
					</p>
				) : null}
				{action ? <div className="mt-2 flex">{action}</div> : null}
			</div>
		</SettingsGroup>
	);
}

export function EditOnGitHubLink({
	href,
	children = "Edit on GitHub",
}: {
	href: string;
	children?: React.ReactNode;
}) {
	return (
		<Button asChild variant="outline" size="sm">
			<a href={href} target="_blank" rel="noopener noreferrer">
				{children}
				<ExternalLinkIcon size={13} />
			</a>
		</Button>
	);
}

export function SettingsReadView<T>({
	query,
	skeletonRows,
	forbiddenTitle,
	forbiddenHint,
	githubUrl,
	children,
}: {
	query: UseQueryResult<SettingsRead<T>>;
	skeletonRows?: number;
	forbiddenTitle: string;
	forbiddenHint: string;
	githubUrl: string;
	children: (data: T) => React.ReactNode;
}) {
	if (query.isPending) return <SettingsSkeleton rows={skeletonRows} />;
	const result = query.data;
	if (result?.status === "ok") return <>{children(result.data)}</>;
	if (result?.status === "forbidden") {
		return (
			<SettingsNotice
				title={forbiddenTitle}
				action={
					<EditOnGitHubLink href={githubUrl}>Open on GitHub</EditOnGitHubLink>
				}
			>
				{forbiddenHint}
			</SettingsNotice>
		);
	}
	return (
		<SettingsNotice
			title={result?.message ?? "Couldn't load this page."}
			action={
				<Button
					variant="outline"
					size="sm"
					onClick={() => void query.refetch()}
				>
					Try again
				</Button>
			}
		/>
	);
}
