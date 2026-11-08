import type { RepoBlob } from "./types";

const RASTER_IMAGE_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	ico: "image/x-icon",
	bmp: "image/bmp",
};

/** Git's own heuristic: a NUL byte in the first 8000 bytes means binary. */
const BINARY_SNIFF_BYTES = 8000;

function extension(path: string) {
	const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "" : name.slice(dot + 1);
}

function decodeText(bytes: Uint8Array): string | null {
	const sniffLength = Math.min(bytes.length, BINARY_SNIFF_BYTES);
	for (let index = 0; index < sniffLength; index++) {
		if (bytes[index] === 0) return null;
	}
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

export type ContentsFile = {
	path: string;
	sha: string;
	size: number;
	encoding: string;
	content: string;
};

/**
 * The contents API inlines base64 only up to 1 MB; larger files come back
 * with `encoding: "none"` and an empty body.
 */
export function classifyContentsFile(file: ContentsFile): RepoBlob {
	const { sha, size } = file;
	if (file.encoding !== "base64") return { kind: "tooLarge", sha, size };

	const base64 = file.content.replace(/\s/g, "");
	const imageType = RASTER_IMAGE_TYPES[extension(file.path)];
	if (imageType) {
		return { kind: "image", sha, size, mimeType: imageType, base64 };
	}

	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	const text = decodeText(bytes);
	if (text === null) return { kind: "binary", sha, size, base64 };
	return { kind: "text", sha, size, text };
}
