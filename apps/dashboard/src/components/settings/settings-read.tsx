import { ExternalLinkIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import type * as React from "react";
import { Skeleton } from "skullet/react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import type { SettingsRead } from "#/lib/settings/read-result";
import { SettingsGroup, SettingsListRow } from "./settings-group";

/** For a page whose shape isn't known yet, such as while access is checked. */
export function SettingsRowsSample({ rows = 3 }: { rows?: number }) {
	return (
		<SettingsGroup>
			{Array.from({ length: rows }, (_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static sample rows
				<SettingsListRow key={index}>
					<div className="size-5 shrink-0 rounded-full" />
					<span className="text-[13px] font-medium text-foreground">
						Settings entry
					</span>
					<span className="ml-auto text-xs text-muted-foreground">Detail</span>
				</SettingsListRow>
			))}
		</SettingsGroup>
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

type SettingsReadViewProps<T> = {
	query: UseQueryResult<SettingsRead<T>>;
	sample: T;
	forbiddenTitle: string;
	forbiddenHint: string;
	githubUrl: string;
	children: (data: T) => React.ReactNode;
};

export function SettingsReadView<T>(props: SettingsReadViewProps<T>) {
	return (
		<Skeleton loading={props.query.isPending} label="Loading settings">
			<div className="flex flex-col gap-8">
				<SettingsReadContent {...props} />
			</div>
		</Skeleton>
	);
}

function SettingsReadContent<T>({
	query,
	sample,
	forbiddenTitle,
	forbiddenHint,
	githubUrl,
	children,
}: SettingsReadViewProps<T>) {
	if (query.isPending) {
		return <SkeletonSample>{children(sample)}</SkeletonSample>;
	}
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
