import { Spinner } from "@diffkit/ui/components/spinner";

/**
 * Pending component used for routes rendered inside the dashboard card
 * (`DashboardLayout`). The `h-full` chain resolves against the card so the
 * spinner stays visually centered within the content area.
 *
 * For top-level pending fallbacks where the parent is just `<body>` (e.g.
 * when `_protected` itself is reloading), use `DashboardViewportLoading`
 * instead — `h-full` there collapses to content height and pins the spinner
 * to the top of the viewport.
 */
export function DashboardContentLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<Spinner size={20} className="text-muted-foreground" />
		</div>
	);
}

/**
 * Full-viewport pending component. Use for route pending states that render
 * directly inside the document body (where no ancestor provides a resolved
 * height). Keeps the spinner centered regardless of how little content the
 * layout has yet rendered.
 */
export function DashboardViewportLoading() {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background">
			<Spinner size={20} className="text-muted-foreground" />
		</div>
	);
}
