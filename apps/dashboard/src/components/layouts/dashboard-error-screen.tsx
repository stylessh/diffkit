import {
	AlertCircleIcon,
	LockIcon,
	RefreshCwIcon,
	SearchIcon,
	WifiOffIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { cn } from "@diffkit/ui/lib/utils";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useShowOrgSetupQueryState } from "#/lib/github-access-dialog-query";
import { openGitHubAccessPrompt } from "#/lib/github-access-modal-store";

type ErrorInfo = {
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	iconClassName: string;
	title: string;
	description: string;
	action: "retry" | "configure-access";
};

function getErrorInfo(error: Error): ErrorInfo {
	const msg = error.message;
	const lower = msg.toLowerCase();

	if (lower.includes("rate limit") || lower.includes("429")) {
		return {
			icon: AlertCircleIcon,
			iconClassName: "bg-amber-500/10 text-amber-500",
			title: "Rate limit reached",
			description:
				"You've made too many requests. Wait a moment and try again.",
			action: "retry",
		};
	}

	if (
		lower.includes("403") ||
		lower.includes("forbidden") ||
		lower.includes("not accessible by integration") ||
		lower.includes("insufficient permissions")
	) {
		return {
			icon: LockIcon,
			iconClassName: "bg-amber-500/10 text-amber-500",
			title: "Access not configured",
			description:
				"DiffKit doesn't have access to this resource. Add the repository or organization in your GitHub app settings.",
			action: "configure-access",
		};
	}

	if (lower.includes("404") || lower.includes("not found")) {
		return {
			icon: SearchIcon,
			iconClassName: "bg-muted-foreground/10 text-muted-foreground",
			title: "Not found",
			description:
				"This resource doesn't exist or you don't have access to it.",
			action: "retry",
		};
	}

	if (
		lower.includes("network") ||
		lower.includes("fetch failed") ||
		lower.includes("econnrefused") ||
		lower.includes("enotfound") ||
		lower.includes("failed to fetch")
	) {
		return {
			icon: WifiOffIcon,
			iconClassName: "bg-amber-500/10 text-amber-500",
			title: "Connection failed",
			description:
				"Could not reach the server. Check your internet connection and try again.",
			action: "retry",
		};
	}

	if (lower.includes("timeout") || lower.includes("timed out")) {
		return {
			icon: AlertCircleIcon,
			iconClassName: "bg-amber-500/10 text-amber-500",
			title: "Request timed out",
			description:
				"The request took too long to complete. Try again in a moment.",
			action: "retry",
		};
	}

	return {
		icon: AlertCircleIcon,
		iconClassName: "bg-destructive/10 text-destructive",
		title: "Something went wrong",
		description:
			msg ||
			"An unexpected error occurred. Please try again or refresh the page.",
		action: "retry",
	};
}

/** Strip the trailing ` - GET https://…` suffix that octokit appends. */
function cleanErrorMessage(msg: string): string | null {
	if (!msg) return null;
	const cleaned = msg
		.replace(/\s*-\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\s+https?:\/\/\S+$/i, "")
		.trim();
	return cleaned || null;
}

export function DashboardErrorScreen({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const {
		icon: Icon,
		iconClassName,
		title,
		description,
		action,
	} = getErrorInfo(error);
	const detail = cleanErrorMessage(error.message);

	return (
		<div className="flex h-full items-center justify-center px-6 py-16">
			<div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
				<div
					className={cn(
						"flex size-12 items-center justify-center rounded-xl",
						iconClassName,
					)}
				>
					<Icon size={24} strokeWidth={1.75} />
				</div>

				<div className="flex flex-col gap-1.5">
					<h1 className="text-lg font-semibold tracking-tight">{title}</h1>
					<p className="text-sm text-muted-foreground text-balance">
						{description}
					</p>
				</div>

				{detail && (
					<p className="max-w-sm rounded-lg bg-surface-1 px-3 py-2 font-mono text-xs text-muted-foreground">
						{detail}
					</p>
				)}

				<div className="flex items-center gap-2">
					{action === "configure-access" ? <ConfigureAccessButton /> : null}
					<Button
						variant="outline"
						size="sm"
						iconLeft={<RefreshCwIcon />}
						onClick={() => {
							reset();
							router.invalidate();
						}}
					>
						Try again
					</Button>
				</div>
			</div>
		</div>
	);
}

function ConfigureAccessButton() {
	const [, setShowOrgSetup] = useShowOrgSetupQueryState();

	return (
		<Button
			size="sm"
			onClick={() => {
				openGitHubAccessPrompt({ source: "warning" });
				void setShowOrgSetup(true);
			}}
		>
			Configure access
		</Button>
	);
}
