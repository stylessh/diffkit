import { AlertCircleIcon, XIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useShowOrgSetupQueryState } from "#/lib/github-access-dialog-query";
import { openGitHubAccessPrompt } from "#/lib/github-access-modal-store";
import { removeWarning, useWarnings } from "#/lib/warning-store";
import { ExtensionInstallPrompt } from "./extension-install-prompt";

export function DashboardBottomBar() {
	const warnings = useWarnings();
	const [, setShowOrgSetup] = useShowOrgSetupQueryState();

	return (
		<div className="empty:hidden flex flex-row flex-wrap items-start gap-1 px-2 pb-2">
			<ExtensionInstallPrompt />
			{warnings.map((warning) => {
				const isError = warning.severity === "error";

				return (
					<div
						key={warning.id}
						className={cn(
							"flex min-h-8 w-fit items-center gap-2 rounded-lg bg-popover py-1 pr-1 pl-2.5 text-xs text-text-header shadow-popover",
						)}
					>
						<AlertCircleIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"shrink-0",
								isError ? "text-danger" : "text-warning",
							)}
						/>
						<span className="min-w-0 flex-1">{warning.message}</span>
						{warning.action
							? (() => {
									const action = warning.action;

									return action.kind === "link" ? (
										<a
											href={action.href}
											target="_blank"
											rel="noopener noreferrer"
											className="flex h-6 shrink-0 items-center rounded-md bg-button px-2 font-medium text-foreground shadow-button transition-colors hover:bg-button-hover"
										>
											{action.label}
										</a>
									) : (
										<button
											type="button"
											onClick={() => {
												openGitHubAccessPrompt({
													source: "warning",
													owner: action.owner,
													repo: action.repo,
													fallbackHref: action.href,
												});
												void setShowOrgSetup(true);
											}}
											className="flex h-6 shrink-0 items-center rounded-md bg-button px-2 font-medium text-foreground shadow-button transition-colors hover:bg-button-hover"
										>
											{action.label}
										</button>
									);
								})()
							: null}
						{warning.dismissible && (
							<button
								type="button"
								onClick={() => removeWarning(warning.id)}
								aria-label="Dismiss"
								className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
							>
								<XIcon size={12} strokeWidth={2} />
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}
