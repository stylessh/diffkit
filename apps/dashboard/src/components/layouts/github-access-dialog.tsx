"use client";

import { Badge } from "@diffkit/ui/components/badge";
import { Button } from "@diffkit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@diffkit/ui/components/dialog";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getGitHubAppAccessState } from "#/lib/github.functions";
import {
	findInstallationForOwner,
	type GitHubAppAccessState,
	getAccessHrefForOwner,
} from "#/lib/github-access";
import { useShowOrgSetupQueryState } from "#/lib/github-access-dialog-query";
import {
	closeGitHubAccessPrompt,
	useGitHubAccessPrompt,
} from "#/lib/github-access-modal-store";
import { useHasMounted } from "#/lib/use-has-mounted";

const ONBOARDING_STORAGE_KEY_PREFIX = "diffkit:github-access-onboarding:v1:";

function getExternalLinkProps(href: string) {
	if (href.startsWith("http://") || href.startsWith("https://")) {
		return { target: "_blank", rel: "noopener noreferrer" } as const;
	}

	return {};
}

function getOnboardingStorageKey(userId: string) {
	return `${ONBOARDING_STORAGE_KEY_PREFIX}${userId}`;
}

function dismissOnboarding(userId: string) {
	window.localStorage.setItem(getOnboardingStorageKey(userId), "dismissed");
}

function isOnboardingDismissed(userId: string) {
	return (
		window.localStorage.getItem(getOnboardingStorageKey(userId)) === "dismissed"
	);
}

export function GitHubAccessDialog({ userId }: { userId: string }) {
	const hasMounted = useHasMounted();
	const prompt = useGitHubAccessPrompt();
	const [onboardingOpen, setOnboardingOpen] = useState(false);
	const [showOrgSetup, setShowOrgSetup] = useShowOrgSetupQueryState();

	useEffect(() => {
		if (!hasMounted || isOnboardingDismissed(userId)) {
			return;
		}

		setOnboardingOpen(true);
		void setShowOrgSetup(true);
	}, [hasMounted, setShowOrgSetup, userId]);

	const isOpen = showOrgSetup;
	const accessQuery = useQuery({
		queryKey: ["github-app-access-state", userId],
		queryFn: () => getGitHubAppAccessState(),
		enabled: hasMounted && isOpen,
		staleTime: 5 * 60 * 1000,
	});

	const state = accessQuery.data;
	const highlightedOwner = prompt?.owner ?? null;
	const highlightedHref = getAccessHrefForOwner(
		state,
		highlightedOwner,
		prompt?.fallbackHref,
	);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			return;
		}

		void setShowOrgSetup(false);
		closeGitHubAccessPrompt();
		if (onboardingOpen) {
			dismissOnboarding(userId);
			setOnboardingOpen(false);
		}
	}

	const title = prompt?.repo
		? `Configure access for ${prompt.repo}`
		: "GitHub access";
	const description = prompt?.repo
		? `DiffKit needs access to this repository.`
		: "Configure the accounts DiffKit can access.";
	const needsAppAuthorization =
		Boolean(state) && state?.installationsAvailable === false;
	const primaryHref = needsAppAuthorization
		? state?.appAuthorizationUrl
		: (highlightedHref ??
			state?.publicInstallUrl ??
			prompt?.fallbackHref ??
			null);

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="top-[14%] translate-y-0 gap-0 p-0 sm:max-w-lg">
				<DialogHeader className="gap-1.5 px-5 pt-5 pb-4">
					<DialogTitle className="text-[0.9375rem]">{title}</DialogTitle>
					<DialogDescription className="text-[0.8125rem]">
						{description}
					</DialogDescription>
				</DialogHeader>

				<div className="px-5 pb-5">
					{accessQuery.isPending ? (
						<div className="rounded-xl border border-border/70 px-4 py-8">
							<p className="text-center text-sm text-muted-foreground">
								Loading installations…
							</p>
						</div>
					) : accessQuery.isError || !state ? (
						<div className="rounded-xl border border-border/70 px-4 py-8">
							<p className="text-center text-sm text-muted-foreground">
								Could not load installations. You can still continue into
								GitHub.
							</p>
						</div>
					) : (
						<AccessList state={state} highlightedOwner={highlightedOwner} />
					)}
				</div>

				<DialogFooter className="border-t border-border/70 px-5 py-3.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => handleOpenChange(false)}
					>
						Close
					</Button>
					{primaryHref ? (
						<Button asChild size="sm">
							<a href={primaryHref} {...getExternalLinkProps(primaryHref)}>
								{needsAppAuthorization ? "Authorize app" : "Configure access"}
							</a>
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

type AccessTarget = {
	login: string;
	type: "personal" | "org";
	status: "installed" | "not-installed" | "unknown";
	scope: "all" | "selected" | null;
	href: string | null;
	isHighlighted: boolean;
};

function buildTargets(
	state: GitHubAppAccessState,
	highlightedOwner: string | null,
): AccessTarget[] {
	const targets: AccessTarget[] = [];
	const canDetect = state.installationsAvailable;

	targets.push({
		login: state.viewerLogin,
		type: "personal",
		status: canDetect
			? state.personalInstallation
				? "installed"
				: "not-installed"
			: "unknown",
		scope: state.personalInstallation
			? state.personalInstallation.repositorySelection === "selected"
				? "selected"
				: "all"
			: null,
		href: getAccessHrefForOwner(state, state.viewerLogin),
		isHighlighted:
			highlightedOwner?.toLowerCase() === state.viewerLogin.toLowerCase(),
	});

	for (const org of state.organizations) {
		const installation = findInstallationForOwner(state, org.login);
		targets.push({
			login: org.login,
			type: "org",
			status: canDetect
				? installation
					? "installed"
					: "not-installed"
				: "unknown",
			scope: installation
				? installation.repositorySelection === "selected"
					? "selected"
					: "all"
				: null,
			href: getAccessHrefForOwner(state, org.login),
			isHighlighted:
				highlightedOwner?.toLowerCase() === org.login.toLowerCase(),
		});
	}

	return targets;
}

function AccessList({
	state,
	highlightedOwner,
}: {
	state: GitHubAppAccessState;
	highlightedOwner: string | null;
}) {
	const targets = buildTargets(state, highlightedOwner);

	return (
		<ul className="overflow-hidden rounded-xl border border-border/70">
			{targets.map((target) => (
				<li
					key={target.login}
					className={cn(
						"flex items-center gap-3 px-3.5 py-2.5",
						"not-first:border-t not-first:border-border/70",
						target.isHighlighted && "bg-accent/55",
					)}
				>
					<StatusDot status={target.status} />

					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className="truncate text-sm font-medium">{target.login}</p>
							{target.scope ? (
								<Badge
									variant="secondary"
									className="rounded-md px-1.5 py-0 text-[0.625rem]"
								>
									{target.scope === "selected" ? "Selected repos" : "All repos"}
								</Badge>
							) : null}
						</div>
						<p className="text-xs text-muted-foreground">
							{target.status === "installed"
								? target.scope === "selected"
									? "Installed · selected repositories"
									: "Installed"
								: target.status === "not-installed"
									? "Not installed"
									: "Check installation status on GitHub"}
							{target.type === "personal" ? " · personal" : " · org"}
						</p>
					</div>

					{target.href ? (
						<Button
							asChild
							variant={target.status === "installed" ? "secondary" : "outline"}
							size="xs"
							className="shrink-0"
						>
							<a href={target.href} {...getExternalLinkProps(target.href)}>
								{target.status === "installed"
									? "Manage"
									: target.status === "unknown"
										? "Authorize"
										: "Configure"}
							</a>
						</Button>
					) : null}
				</li>
			))}

			{targets.length === 1 && (
				<li className="border-t border-border/70 px-3.5 py-6">
					<p className="text-center text-xs text-muted-foreground">
						No organizations detected on this account.
					</p>
				</li>
			)}
		</ul>
	);
}

function StatusDot({
	status,
}: {
	status: "installed" | "not-installed" | "unknown";
}) {
	return (
		<div
			className={cn(
				"flex size-2 shrink-0 rounded-full",
				status === "installed"
					? "bg-green-500"
					: status === "not-installed"
						? "bg-yellow-500"
						: "bg-muted-foreground/40",
			)}
		/>
	);
}
