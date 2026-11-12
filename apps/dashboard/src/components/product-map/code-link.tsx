import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { githubBlobUrl, shortPath } from "./map-format";

export type RepoLinks = { url: string; branch: string };

export function CodeLink({
	reference,
	repo,
}: {
	reference: { path: string; line?: number };
	repo: RepoLinks;
}) {
	return (
		<a
			href={githubBlobUrl(
				repo.url,
				repo.branch,
				reference.path,
				reference.line,
			)}
			target="_blank"
			rel="noreferrer"
			title={reference.path}
			className="inline-flex h-5.5 max-w-full items-center gap-1.5 rounded-[5px] bg-inline-code px-1.5 font-mono text-[11px] text-text-header transition-colors hover:text-foreground"
		>
			<FileTypeIcon path={reference.path} size={11} />
			<span className="truncate">
				{shortPath(reference.path)}
				{reference.line ? `:${reference.line}` : ""}
			</span>
		</a>
	);
}
