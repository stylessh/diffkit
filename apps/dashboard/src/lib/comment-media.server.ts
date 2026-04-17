export const COMMENT_MEDIA_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const COMMENT_MEDIA_MAX_VIDEO_BYTES = 120 * 1024 * 1024;
const DISPLAY_MAX_SIDE = 1200;

const IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/gif",
	"image/webp",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type CommentMediaKind = "image" | "video";

export function classifyCommentMedia(
	contentType: string,
): CommentMediaKind | null {
	const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	if (IMAGE_TYPES.has(normalized)) return "image";
	if (VIDEO_TYPES.has(normalized)) return "video";
	return null;
}

export function maxBytesForCommentMediaKind(kind: CommentMediaKind): number {
	return kind === "image"
		? COMMENT_MEDIA_MAX_IMAGE_BYTES
		: COMMENT_MEDIA_MAX_VIDEO_BYTES;
}

export function sanitizeCommentMediaFilename(name: string): string {
	const base = name.replace(/[^\w.\-()+ ]/gu, "_").slice(0, 120);
	return base.length > 0 ? base : "upload";
}

export function buildCommentMediaObjectKey(
	userId: string,
	filename: string,
): string {
	const safe = sanitizeCommentMediaFilename(filename);
	return `comment-media/${userId}/${Date.now()}-${safe}`;
}

export function verifyCommentMediaKeyForUser(
	key: string,
	userId: string,
): boolean {
	const prefix = `comment-media/${userId}/`;
	return key.startsWith(prefix) && !key.slice(prefix.length).includes("/");
}

export function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/gu, "&amp;")
		.replace(/"/gu, "&quot;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;");
}

export function clampDisplayDimensions(
	width: number,
	height: number,
	maxSide: number = DISPLAY_MAX_SIDE,
): { width: number; height: number } {
	if (
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		width <= 0 ||
		height <= 0
	) {
		return { width: 1, height: 1 };
	}

	const max = Math.max(width, height);
	if (max <= maxSide) {
		return { width: Math.round(width), height: Math.round(height) };
	}

	const scale = maxSide / max;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/** Encode each path segment for URLs where the key may contain spaces etc. */
export function publicUrlForR2Key(publicBaseUrl: string, key: string): string {
	const base = publicBaseUrl.replace(/\/$/u, "");
	const encodedKey = key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
	return `${base}/${encodedKey}`;
}

export function buildCommentMediaHtml(options: {
	kind: CommentMediaKind;
	src: string;
	width: number;
	height: number;
	alt: string;
}): string {
	const src = escapeHtmlAttribute(options.src);
	const alt = escapeHtmlAttribute(options.alt);
	const w = String(options.width);
	const h = String(options.height);

	if (options.kind === "image") {
		return `<img width="${w}" height="${h}" alt="${alt}" src="${src}" />`;
	}

	return `<video src="${src}" width="${w}" height="${h}" controls preload="metadata" title="${alt}"></video>`;
}

export async function verifyCommentMediaObject(
	bucket: R2Bucket, // global from worker types
	key: string,
): Promise<
	| { ok: true; size: number; contentType?: string }
	| { ok: false; reason: string }
> {
	const head = await bucket.head(key);
	if (!head) {
		return { ok: false, reason: "Object not found" };
	}
	if (!head.size || head.size <= 0) {
		return { ok: false, reason: "Object is empty" };
	}
	return {
		ok: true,
		size: head.size,
		contentType: head.httpMetadata?.contentType,
	};
}
