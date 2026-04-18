import { Spinner } from "@diffkit/ui/components/spinner";

export function DashboardContentLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<Spinner size={20} className="text-muted-foreground" />
		</div>
	);
}
