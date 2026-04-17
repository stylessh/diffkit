import { getAuth } from "#/lib/auth.server";
import {
	buildCommentMediaObjectKey,
	COMMENT_MEDIA_SIGNATURE_PROBE_BYTES,
	detectCommentMediaFromBytes,
	maxBytesForCommentMediaKind,
	publicUrlForR2Key,
	sanitizeCommentMediaFilename,
} from "#/lib/comment-media.server";

export async function handleCommentMediaUpload(
	request: Request,
): Promise<Response> {
	const { env } = await import("cloudflare:workers");

	const bucket = env.COMMENT_MEDIA;
	const publicBaseUrl = env.R2_PUBLIC_BASE_URL;

	if (!bucket || !publicBaseUrl) {
		return Response.json(
			{ error: "Comment media uploads are not configured" },
			{ status: 503 },
		);
	}

	const session = await getAuth().api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const contentType = request.headers.get("Content-Type") ?? "";
	if (!contentType.includes("multipart/form-data")) {
		return Response.json(
			{ error: "Expected multipart form data" },
			{ status: 400 },
		);
	}

	const form = await request.formData();
	const file = form.get("file");

	if (!(file instanceof File)) {
		return Response.json({ error: "Missing file" }, { status: 400 });
	}

	// Client-declared MIME (file.type) is not trusted — identify by signature.
	const headerBytes = new Uint8Array(
		await file.slice(0, COMMENT_MEDIA_SIGNATURE_PROBE_BYTES).arrayBuffer(),
	);
	const detected = detectCommentMediaFromBytes(headerBytes);
	if (!detected) {
		return Response.json({ error: "Unsupported file type" }, { status: 415 });
	}

	const maxBytes = maxBytesForCommentMediaKind(detected.kind);
	if (file.size > maxBytes) {
		return Response.json({ error: "File is too large" }, { status: 413 });
	}

	const filename = sanitizeCommentMediaFilename(file.name);
	const key = buildCommentMediaObjectKey(session.user.id, filename);

	await bucket.put(key, file.stream(), {
		httpMetadata: {
			contentType: detected.contentType,
			cacheControl: "public, max-age=31536000, immutable",
		},
	});

	const publicUrl = publicUrlForR2Key(publicBaseUrl, key);

	return Response.json({
		key,
		publicUrl,
		kind: detected.kind,
		contentType: detected.contentType,
	});
}
