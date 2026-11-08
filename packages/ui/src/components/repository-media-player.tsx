import {
	MediaControlBar,
	MediaController,
	MediaDurationDisplay,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPipButton,
	MediaPlayButton,
	MediaPlaybackRateButton,
	MediaTimeDisplay,
	MediaTimeRange,
	MediaVolumeRange,
} from "media-chrome/react";
import type { CSSProperties } from "react";

const controllerStyle = {
	"--media-background-color":
		"color-mix(in srgb, var(--surface-0) 92%, transparent)",
	"--media-control-background": "transparent",
	"--media-primary-color": "var(--foreground)",
	"--media-secondary-color": "var(--muted-foreground)",
} as CSSProperties;

export default function RepositoryMediaPlayer({
	kind,
	src,
	fileName,
	onError,
}: {
	kind: "audio" | "video";
	src: string;
	fileName: string;
	onError: () => void;
}) {
	if (kind === "audio") {
		return (
			<MediaController
				audio
				className="w-full max-w-3xl overflow-hidden rounded-lg border-[0.5px] bg-surface-0"
				style={controllerStyle}
			>
				{/* biome-ignore lint/a11y/useMediaCaption: arbitrary repository audio has no associated captions asset. */}
				<audio
					slot="media"
					src={src}
					preload="metadata"
					onError={onError}
					aria-label={fileName}
				/>
				<MediaControlBar className="w-full">
					<MediaPlayButton />
					<MediaTimeDisplay />
					<MediaTimeRange className="min-w-24 flex-1" />
					<MediaDurationDisplay />
					<MediaPlaybackRateButton />
					<MediaMuteButton />
					<MediaVolumeRange />
				</MediaControlBar>
			</MediaController>
		);
	}

	return (
		<MediaController
			className="w-full max-w-5xl overflow-hidden rounded-lg bg-black shadow-sm"
			style={controllerStyle}
		>
			{/* biome-ignore lint/a11y/useMediaCaption: arbitrary repository video has no associated captions asset. */}
			<video
				slot="media"
				src={src}
				preload="metadata"
				playsInline
				onError={onError}
				aria-label={fileName}
				className="max-h-[70vh] w-full object-contain"
			/>
			<MediaControlBar className="w-full">
				<MediaPlayButton />
				<MediaMuteButton />
				<MediaVolumeRange />
				<MediaTimeDisplay />
				<MediaTimeRange className="min-w-24 flex-1" />
				<MediaDurationDisplay />
				<MediaPlaybackRateButton />
				<MediaPipButton />
				<MediaFullscreenButton />
			</MediaControlBar>
		</MediaController>
	);
}
