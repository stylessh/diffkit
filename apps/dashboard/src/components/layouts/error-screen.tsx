import { Button } from "@quickhub/ui/components/button";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

export function ErrorScreen({ reset }: ErrorComponentProps) {
	const router = useRouter();

	return (
		<div className="flex min-h-dvh items-center justify-center px-6 py-16">
			<div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
				<div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
					<AlertCircleIcon size={24} strokeWidth={1.75} />
				</div>

				<div className="flex flex-col gap-1.5">
					<h1 className="text-lg font-semibold tracking-tight">
						Something went wrong
					</h1>
					<p className="text-sm text-muted-foreground text-balance">
						An unexpected error occurred. Please try again or refresh the page.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						iconLeft={<RefreshCwIcon />}
						onClick={() => {
							reset();
							router.invalidate();
						}}
					>
						Try again
					</Button>
				</div>
			</div>
		</div>
	);
}
