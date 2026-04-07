import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="flex min-h-screen items-center justify-center">
			<h1 className="text-4xl font-bold tracking-tight">QuickHub Dashboard</h1>
		</main>
	);
}
