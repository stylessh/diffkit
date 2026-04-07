import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "#/lib/auth.client";

export const Route = createFileRoute("/_protected/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const { user } = Route.useRouteContext();

	return (
		<main className="p-8">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					{user.image && (
						<img
							src={user.image}
							alt={user.name}
							className="h-10 w-10 rounded-full"
						/>
					)}
					<h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
				</div>
				<button
					type="button"
					onClick={() =>
						signOut().then(() => {
							window.location.href = "/";
						})
					}
					className="rounded-md border px-4 py-2 hover:bg-neutral-100 transition-colors"
				>
					Sign out
				</button>
			</div>
		</main>
	);
}
