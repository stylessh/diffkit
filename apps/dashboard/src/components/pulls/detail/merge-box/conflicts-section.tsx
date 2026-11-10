import { StatusDisclosure, StatusRow } from "./status-row";

export function ConflictsSection({
	conflictingFiles,
}: {
	conflictingFiles: string[];
}) {
	const title = "This branch has conflicts that must be resolved";

	if (conflictingFiles.length === 0) {
		return (
			<StatusRow
				status="error"
				title={title}
				description="Use the command line to resolve conflicts."
			/>
		);
	}

	return (
		<StatusDisclosure
			status="error"
			title={title}
			titleClassName="text-sm font-medium"
			description={`${conflictingFiles.length} conflicting file${conflictingFiles.length !== 1 ? "s" : ""}`}
			defaultOpen
		>
			<div className="flex max-h-64 flex-col overflow-y-auto border-b-[0.5px] border-card-border py-1">
				{conflictingFiles.map((file) => (
					<div key={file} className="flex items-center gap-2 px-4 py-1.5 pl-11">
						<span className="min-w-0 truncate font-mono text-xs">{file}</span>
					</div>
				))}
			</div>
		</StatusDisclosure>
	);
}
