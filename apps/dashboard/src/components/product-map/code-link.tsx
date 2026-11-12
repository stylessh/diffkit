import { Link } from "@tanstack/react-router";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { shortPath } from "./map-format";

/** What a link inside the map needs to stay inside DiffKit. */
export type RepoLinks = { owner: string; repo: string; branch: string };

export function blobLink(
	repo: RepoLinks,
	reference: { path: string; line?: number },
) {
	return {
		to: "/$owner/$repo/blob/$",
		params: {
			owner: repo.owner,
			repo: repo.repo,
			_splat: `${repo.branch}/${reference.path}`,
		},
		hash: reference.line ? `L${reference.line}` : undefined,
	} as const;
}

export function CodeLink({
	reference,
	repo,
}: {
	reference: { path: string; line?: number };
	repo: RepoLinks;
}) {
	return (
		<Link
			{...blobLink(repo, reference)}
			title={reference.path}
			className="inline-flex h-5.5 max-w-full items-center gap-1.5 rounded-[5px] bg-inline-code px-1.5 font-mono text-[11px] text-text-header transition-colors hover:text-foreground"
		>
			<FileTypeIcon path={reference.path} size={11} />
			<span className="truncate">
				{shortPath(reference.path)}
				{reference.line ? `:${reference.line}` : ""}
			</span>
		</Link>
	);
}
