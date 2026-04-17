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

export const COMMENT_MEDIA_SIGNATURE_PROBE_BYTES = 16;

/**
 * Identify comment media by its file signature (magic bytes). Returned content
 * type is authoritative for storage/response — never trust the client MIME.
 */
export function detectCommentMediaFromBytes(
	bytes: Uint8Array,
): { kind: CommentMediaKind; contentType: string } | null {
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return { kind: "image", contentType: "image/png" };
	}
	// JPEG: FF D8 FF
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	) {
		return { kind: "image", contentType: "image/jpeg" };
	}
	// GIF: 47 49 46 38 (37|39) 61 ("GIF87a" or "GIF89a")
	if (
		bytes.length >= 6 &&
		bytes[0] === 0x47 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x38 &&
		(bytes[4] === 0x37 || bytes[4] === 0x39) &&
		bytes[5] === 0x61
	) {
		return { kind: "image", contentType: "image/gif" };
	}
	// WEBP: "RIFF" ....  "WEBP"
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return { kind: "image", contentType: "image/webp" };
	}
	// ISO BMFF (MP4/MOV): "ftyp" box at offset 4 with a 4-char brand.
	if (
		bytes.length >= 12 &&
		bytes[4] === 0x66 &&
		bytes[5] === 0x74 &&
		bytes[6] === 0x79 &&
		bytes[7] === 0x70
	) {
		const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
		if (brand === "qt  ") {
			return { kind: "video", contentType: "video/quicktime" };
		}
		return { kind: "video", contentType: "video/mp4" };
	}
	// WEBM / Matroska: EBML header 1A 45 DF A3
	if (
		bytes.length >= 4 &&
		bytes[0] === 0x1a &&
		bytes[1] === 0x45 &&
		bytes[2] === 0xdf &&
		bytes[3] === 0xa3
	) {
		return { kind: "video", contentType: "video/webm" };
	}
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
	return `comment-media/${userId}/${Date.now()}-${crypto.randomUUID()}-${safe}`;
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
	// R2Bucket.head only returns null for NoSuchKey; transient service/network
	// errors surface as exceptions, so catch them to keep the discriminated-union
	// contract (no thrown errors).
	let head: R2Object | null;
	try {
		head = await bucket.head(key);
	} catch {
		return { ok: false, reason: "Failed to verify object" };
	}
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
