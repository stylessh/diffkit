import type { ErrorComponentProps } from "@tanstack/react-router";
import { DashboardErrorScreen } from "./dashboard-error-screen";

export function ErrorScreen(props: ErrorComponentProps) {
	return (
		<div className="min-h-dvh">
			<DashboardErrorScreen {...props} />
		</div>
	);
}
