import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Button } from "@diffkit/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	type GitHubQueryScope,
	githubViewerOrganizationsQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";

export function ViewerOrganizations({ scope }: { scope: GitHubQueryScope }) {
	const hasMounted = useHasMounted();
	const query = useQuery({
		...githubViewerOrganizationsQueryOptions(scope),
		enabled: hasMounted,
	});
	const orgs = query.data?.status === "ok" ? query.data.data : [];
	if (orgs.length === 0) return null;

	return (
		<ul className="flex flex-col gap-2">
			{orgs.map((org) => (
				<li
					key={org.login}
					className="flex items-center justify-between gap-4 rounded-xl border-[0.5px] border-border/70 px-4 py-3"
				>
					<span className="flex min-w-0 items-center gap-3 text-sm font-medium">
						<Avatar className="size-6">
							<AvatarImage src={org.avatarUrl} alt="" />
							<AvatarFallback>{org.login.slice(0, 2)}</AvatarFallback>
						</Avatar>
						<span className="truncate">{org.login}</span>
					</span>
					<Button asChild variant="outline" size="sm" className="shrink-0">
						<Link to="/orgs/$org/settings" params={{ org: org.login }}>
							Settings
						</Link>
					</Button>
				</li>
			))}
		</ul>
	);
}
