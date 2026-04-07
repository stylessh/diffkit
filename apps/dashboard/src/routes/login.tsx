import { createFileRoute, redirect } from "@tanstack/react-router";
import { signIn } from "#/lib/auth.client";
import { getSession } from "#/lib/auth.functions";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session) throw redirect({ to: "/dashboard" });
	},
	component: LoginPage,
});

function LoginPage() {
	return (
		<main className="flex min-h-screen items-center justify-center">
			<div className="text-center space-y-6">
				<h1 className="text-3xl font-bold">Sign in to QuickHub</h1>
				<p className="text-muted-foreground">
					Connect your GitHub account to get started.
				</p>
				<button
					type="button"
					onClick={() => signIn.social({ provider: "github" })}
					className="rounded-md bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-800 transition-colors"
				>
					Continue with GitHub
				</button>
			</div>
		</main>
	);
}
