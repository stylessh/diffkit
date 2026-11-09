import { FolderIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { resolveFileIcon } from "#/lib/file-icons";

/**
 * A file in its type's coloured icon (Pierre's trees set), or a folder as the
 * plain monochrome glyph. Inline SVG, so it renders on the server and follows
 * the theme through CSS alone.
 */
export function FileTypeIcon({
	path,
	kind = "file",
	size = 16,
	className,
}: {
	path: string;
	kind?: "file" | "directory";
	size?: number;
	className?: string;
}) {
	if (kind === "directory") {
		return (
			<FolderIcon
				size={size}
				strokeWidth={1.8}
				className={cn("shrink-0 text-muted-foreground", className)}
			/>
		);
	}
	const icon = resolveFileIcon(path);
	return (
		<svg
			width={size}
			height={size}
			viewBox={icon.viewBox}
			aria-hidden="true"
			data-icon-token={icon.token}
			className={cn("shrink-0", className)}
			style={{ color: `var(--file-icon-${icon.hue})` }}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: static markup from the @pierre/trees sprite, never user input
			dangerouslySetInnerHTML={{ __html: icon.body }}
		/>
	);
}
