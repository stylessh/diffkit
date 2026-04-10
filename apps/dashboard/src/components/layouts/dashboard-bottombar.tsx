import { AlertCircleIcon, XIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useShowOrgSetupQueryState } from "#/lib/github-access-dialog-query";
import { openGitHubAccessPrompt } from "#/lib/github-access-modal-store";
import { removeWarning, useWarnings } from "#/lib/warning-store";

export function DashboardBottomBar() {
	const warnings = useWarnings();
	const [, setShowOrgSetup] = useShowOrgSetupQueryState();

	if (warnings.length === 0) return null;

	return (
		<div className="flex flex-col gap-1 px-2 pb-2">
			{warnings.map((warning) => (
				<div
					key={warning.id}
					className={cn(
						"flex w-fit items-center gap-2 rounded-lg bg-yellow-500 px-3 py-2 text-xs text-yellow-950 dark:bg-yellow-500 dark:text-yellow-950",
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
										className="shrink-0 rounded-md bg-yellow-950/10 px-2 py-0.5 font-medium transition-colors hover:bg-yellow-950/20"
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
										className="shrink-0 rounded-md bg-yellow-950/10 px-2 py-0.5 font-medium transition-colors hover:bg-yellow-950/20"
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
							className="flex size-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-yellow-600/20"
						>
							<XIcon size={12} strokeWidth={2} />
						</button>
					)}
				</div>
			))}
		</div>
	);
}
