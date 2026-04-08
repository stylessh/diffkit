import { LoaderCircleIcon } from "lucide-react";

export function DashboardContentLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<LoaderCircleIcon
				className="size-5 animate-spin text-muted-foreground"
				strokeWidth={1.75}
			/>
		</div>
	);
}
