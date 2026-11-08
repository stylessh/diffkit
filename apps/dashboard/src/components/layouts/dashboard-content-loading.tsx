import { Spinner } from "@diffkit/ui/components/spinner";

export function DashboardContentLoading() {
	return (
		<div className="pending-reveal flex h-full items-center justify-center">
			<Spinner size={20} className="text-muted-foreground" />
		</div>
	);
}

export function DashboardViewportLoading() {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background">
			<div className="pending-reveal">
				<Spinner size={20} className="text-muted-foreground" />
			</div>
		</div>
	);
}
