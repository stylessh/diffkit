import {
	getCommentMediaUploadPlaceholderText,
	type MarkdownEditorHandle,
	type MarkdownEditorMediaUpload,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { CommentMediaKind } from "#/lib/comment-media.server";
import {
	type FinalizeCommentMediaResult,
	finalizeCommentMediaUpload,
} from "#/lib/media.functions";

async function probeImageDimensions(file: File): Promise<{
	width: number;
	height: number;
}> {
	const url = URL.createObjectURL(file);
	try {
		return await new Promise<{ width: number; height: number }>(
			(resolve, reject) => {
				const img = new Image();
				img.onload = () => {
					resolve({ width: img.naturalWidth, height: img.naturalHeight });
				};
				img.onerror = () =>
					reject(new Error("Could not read image dimensions"));
				img.src = url;
			},
		);
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function probeVideoDimensions(file: File): Promise<{
	width: number;
	height: number;
}> {
	const url = URL.createObjectURL(file);
	try {
		return await new Promise<{ width: number; height: number }>(
			(resolve, reject) => {
				const video = document.createElement("video");
				video.preload = "metadata";
				video.onloadedmetadata = () => {
					resolve({ width: video.videoWidth, height: video.videoHeight });
				};
				video.onerror = () =>
					reject(new Error("Could not read video dimensions"));
				video.src = url;
			},
		);
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function probeDimensions(
	file: File,
	kind: CommentMediaKind,
): Promise<{ width: number; height: number }> {
	try {
		return kind === "image"
			? await probeImageDimensions(file)
			: await probeVideoDimensions(file);
	} catch {
		return { width: 1, height: 1 };
	}
}

type UploadJson = {
	key: string;
	publicUrl: string;
	kind: CommentMediaKind;
	contentType: string;
};

export function useCommentMediaUpload(
	editorRef: React.RefObject<MarkdownEditorHandle | null>,
) {
	const [pendingUploads, setPendingUploads] = useState(0);

	const uploadAndInsert = useCallback(
		async (file: File) => {
			const id = crypto.randomUUID();
			const placeholder = getCommentMediaUploadPlaceholderText(id);
			editorRef.current?.insertAtCaret(`${placeholder}\n`);

			const formData = new FormData();
			formData.append("file", file);

			setPendingUploads((count) => count + 1);
			try {
				const response = await fetch("/api/comment-media/upload", {
					method: "POST",
					body: formData,
					credentials: "include",
				});

				if (!response.ok) {
					let message = "Upload failed";
					try {
						const payload = (await response.json()) as { error?: string };
						if (payload.error) message = payload.error;
					} catch {
						// ignore
					}
					throw new Error(message);
				}

				const payload = (await response.json()) as UploadJson;
				const dimensions = await probeDimensions(file, payload.kind);

				const finalized: FinalizeCommentMediaResult =
					await finalizeCommentMediaUpload({
						data: {
							key: payload.key,
							width: dimensions.width,
							height: dimensions.height,
							kind: payload.kind,
							fileName: file.name,
						},
					});

				if (!finalized.ok) {
					throw new Error(finalized.error);
				}

				editorRef.current?.replaceUploadPlaceholder(id, `${finalized.html}\n`);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Upload failed";
				toast.error(message);
				editorRef.current?.replaceUploadPlaceholder(
					id,
					`*Could not upload "${file.name}": ${message}*\n`,
				);
			} finally {
				setPendingUploads((count) => count - 1);
			}
		},
		[editorRef],
	);

	const processFiles = useCallback(
		async (files: File[]) => {
			if (files.length === 0) return;
			for (const file of files) {
				await uploadAndInsert(file);
			}
		},
		[uploadAndInsert],
	);

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			void processFiles(acceptedFiles);
		},
		[processFiles],
	);

	const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
		onDrop,
		noClick: true,
		noKeyboard: true,
		accept: {
			"image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
			"video/*": [".mp4", ".webm", ".mov"],
		},
	});

	const onPaste = useCallback(
		(event: React.ClipboardEvent<HTMLTextAreaElement>) => {
			const items = event.clipboardData?.items;
			if (!items) return;

			const files: File[] = [];
			for (const item of items) {
				if (item.kind !== "file") continue;
				const file = item.getAsFile();
				if (!file) continue;
				if (
					!file.type.startsWith("image/") &&
					!file.type.startsWith("video/")
				) {
					continue;
				}
				files.push(file);
			}

			if (files.length === 0) return;

			event.preventDefault();
			void processFiles(files);
		},
		[processFiles],
	);

	const media: MarkdownEditorMediaUpload = {
		isDragActive,
		rootProps: getRootProps(),
		inputProps: getInputProps(),
		onToolbarAttach: () => {
			open();
		},
	};

	return { media, onPaste, pendingUploads };
}
