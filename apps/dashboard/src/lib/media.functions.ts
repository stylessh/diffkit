import { createServerFn } from "@tanstack/react-start";
import { getRequestSession } from "#/lib/auth-runtime";
import {
	buildCommentMediaHtml,
	type CommentMediaKind,
	clampDisplayDimensions,
	classifyCommentMedia,
	maxBytesForCommentMediaKind,
	publicUrlForR2Key,
	sanitizeCommentMediaFilename,
	verifyCommentMediaKeyForUser,
	verifyCommentMediaObject,
} from "#/lib/comment-media.server";

export type FinalizeCommentMediaInput = {
	key: string;
	width: number;
	height: number;
	kind: CommentMediaKind;
	fileName: string;
};

export type FinalizeCommentMediaResult =
	| { ok: true; html: string }
	| { ok: false; error: string };

const MAX_KEY_LENGTH = 512;
const MAX_FILENAME_LENGTH = 512;
const MAX_DIMENSION = 100_000;

function validateFinalizeCommentMediaInput(
	raw: unknown,
): FinalizeCommentMediaInput {
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid payload");
	}
	const { key, width, height, kind, fileName } = raw as Record<string, unknown>;
	if (
		typeof key !== "string" ||
		key.length === 0 ||
		key.length > MAX_KEY_LENGTH
	) {
		throw new Error("Invalid key");
	}
	if (
		typeof width !== "number" ||
		!Number.isFinite(width) ||
		width <= 0 ||
		width > MAX_DIMENSION
	) {
		throw new Error("Invalid width");
	}
	if (
		typeof height !== "number" ||
		!Number.isFinite(height) ||
		height <= 0 ||
		height > MAX_DIMENSION
	) {
		throw new Error("Invalid height");
	}
	if (kind !== "image" && kind !== "video") {
		throw new Error("Invalid kind");
	}
	if (
		typeof fileName !== "string" ||
		fileName.length === 0 ||
		fileName.length > MAX_FILENAME_LENGTH
	) {
		throw new Error("Invalid fileName");
	}
	return { key, width, height, kind, fileName };
}

export const finalizeCommentMediaUpload = createServerFn({ method: "POST" })
	.inputValidator(validateFinalizeCommentMediaInput)
	.handler(async ({ data }): Promise<FinalizeCommentMediaResult> => {
		const session = await getRequestSession();
		if (!session) {
			return { ok: false, error: "Not authenticated" };
		}

		const { env } = await import("cloudflare:workers");
		const bucket = env.COMMENT_MEDIA;
		const publicBaseUrl = env.R2_PUBLIC_BASE_URL;

		if (!bucket || !publicBaseUrl) {
			return { ok: false, error: "Media uploads are not configured" };
		}

		if (!verifyCommentMediaKeyForUser(data.key, session.user.id)) {
			return { ok: false, error: "Invalid object key" };
		}

		const verified = await verifyCommentMediaObject(bucket, data.key);
		if (!verified.ok) {
			return { ok: false, error: verified.reason };
		}

		const contentType = verified.contentType ?? "";
		const classified = classifyCommentMedia(contentType);
		if (!classified) {
			return { ok: false, error: "Unsupported stored media type" };
		}
		if (classified !== data.kind) {
			return { ok: false, error: "Media kind does not match file" };
		}

		const maxBytes = maxBytesForCommentMediaKind(classified);
		if (verified.size > maxBytes) {
			return { ok: false, error: "Uploaded file is too large" };
		}

		const dims = clampDisplayDimensions(data.width, data.height);
		const src = publicUrlForR2Key(publicBaseUrl, data.key);
		const safeName = sanitizeCommentMediaFilename(data.fileName);
		const alt = safeName.replace(/\.[^.]+$/u, "") || "attachment";

		const html = buildCommentMediaHtml({
			kind: classified,
			src,
			width: dims.width,
			height: dims.height,
			alt,
		});

		return { ok: true, html };
	});
