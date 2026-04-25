import {
	CenterFocusIcon,
	FullScreenIcon,
	MinusSignIcon,
	PlusSignIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { ControlButton, Controls, useReactFlow } from "@xyflow/react";

const CONTROL_BUTTON_CLASS = cn(
	"!flex !size-7 !items-center !justify-center !rounded-md !border-0 !bg-transparent !p-0 !text-secondary-foreground/70",
	"hover:!bg-secondary-foreground/10 hover:!text-secondary-foreground",
	"[&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_svg]:!max-h-none [&_svg]:!max-w-none [&_svg]:!fill-none",
);

export function GraphControls({
	isFullscreen,
	onToggleFullscreen,
}: {
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}) {
	const { zoomIn, zoomOut, fitView } = useReactFlow();
	return (
		<Controls
			orientation="horizontal"
			position="bottom-right"
			showZoom={false}
			showFitView={false}
			showInteractive={false}
			className={cn(
				"!m-3 !flex !flex-row !gap-0.5 !overflow-hidden !rounded-lg !border-0 !bg-secondary !p-0.5 !shadow-xs",
			)}
		>
			<ControlButton
				onClick={() => zoomIn()}
				aria-label="Zoom in"
				className={CONTROL_BUTTON_CLASS}
			>
				<PlusSignIcon size={14} strokeWidth={2} />
			</ControlButton>
			<ControlButton
				onClick={() => zoomOut()}
				aria-label="Zoom out"
				className={CONTROL_BUTTON_CLASS}
			>
				<MinusSignIcon size={14} strokeWidth={2} />
			</ControlButton>
			<ControlButton
				onClick={() => fitView({ duration: 200 })}
				aria-label="Center"
				className={CONTROL_BUTTON_CLASS}
			>
				<CenterFocusIcon size={14} strokeWidth={2} />
			</ControlButton>
			<ControlButton
				onClick={onToggleFullscreen}
				aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
				className={CONTROL_BUTTON_CLASS}
			>
				<FullScreenIcon size={14} strokeWidth={2} />
			</ControlButton>
		</Controls>
	);
}
