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
							"flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-xs",
							isError
								? "bg-red-500 text-white dark:bg-red-500 dark:text-white"
								: "bg-yellow-500 text-yellow-950 dark:bg-yellow-500 dark:text-yellow-950",
						)}
					>
						<AlertCircleIcon size={14} strokeWidth={2} className="shrink-0" />
						<span className="min-w-0 flex-1">{warning.message}</span>
						{warning.action
							? (() => {
									const action = warning.action;

									return action.kind === "link" ? (
										<a
											href={action.href}
											target="_blank"
											rel="noopener noreferrer"
											className={cn(
												"shrink-0 rounded-md px-2 py-0.5 font-medium transition-colors",
												isError
													? "bg-white/15 hover:bg-white/25"
													: "bg-yellow-950/10 hover:bg-yellow-950/20",
											)}
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
											className={cn(
												"shrink-0 rounded-md px-2 py-0.5 font-medium transition-colors",
												isError
													? "bg-white/15 hover:bg-white/25"
													: "bg-yellow-950/10 hover:bg-yellow-950/20",
											)}
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
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded transition-colors",
									isError ? "hover:bg-white/15" : "hover:bg-yellow-600/20",
								)}
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
