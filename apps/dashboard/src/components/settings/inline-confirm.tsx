import { Button } from "@diffkit/ui/components/button";
import { type ReactNode, useState } from "react";

type Step = "idle" | "confirming";

export function InlineConfirmButton({
	label,
	ariaLabel,
	prompt,
	confirmLabel = "Confirm",
	icon,
	pending,
	disabled,
	onConfirm,
}: {
	label: string;
	ariaLabel?: string;
	prompt: string;
	confirmLabel?: string;
	icon?: ReactNode;
	pending: boolean;
	disabled?: boolean;
	onConfirm: () => void;
}) {
	const [step, setStep] = useState<Step>("idle");

	if (step === "idle") {
		return (
			<Button
				type="button"
				variant="ghost"
				size="xs"
				aria-label={ariaLabel ?? label}
				disabled={disabled}
				className="min-w-[5.5rem] text-muted-foreground hover:text-danger"
				onClick={() => setStep("confirming")}
			>
				{icon}
				{label}
			</Button>
		);
	}

	return (
		<fieldset
			aria-label={prompt}
			className="m-0 flex min-w-0 items-center gap-1.5 border-0 p-0"
			onKeyDown={(event) => {
				if (event.key === "Escape" && !pending) setStep("idle");
			}}
		>
			<span className="text-xs text-muted-foreground">{prompt}</span>
			<Button
				type="button"
				variant="destructive"
				size="xs"
				disabled={pending}
				onClick={onConfirm}
			>
				{pending ? "Working…" : confirmLabel}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="xs"
				disabled={pending}
				onClick={() => setStep("idle")}
			>
				Cancel
			</Button>
		</fieldset>
	);
}
