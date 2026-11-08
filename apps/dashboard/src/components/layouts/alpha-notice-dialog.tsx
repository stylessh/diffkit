"use client";

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@diffkit/ui/components/alert";
import { Button } from "@diffkit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@diffkit/ui/components/dialog";
import { useEffect, useState } from "react";
import { siteConfig } from "#/lib/site-config";
import { useHasMounted } from "#/lib/use-has-mounted";

const STORAGE_KEY = "diffkit-alpha-notice-dismissed";

const issuesUrl = `${siteConfig.githubRepositoryUrl}/issues`;

export function AlphaNoticeDialog() {
	const hasMounted = useHasMounted();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!hasMounted) {
			return;
		}
		try {
			if (!localStorage.getItem(STORAGE_KEY)) {
				setOpen(true);
			}
		} catch {
			// Storage blocked — skip modal
		}
	}, [hasMounted]);

	function dismiss() {
		try {
			localStorage.setItem(STORAGE_KEY, "1");
		} catch {
			// ignore
		}
		setOpen(false);
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
			<DialogContent className="top-[14%] translate-y-0 gap-0 p-0 sm:max-w-lg">
				<DialogHeader className="gap-1.5 px-5 pt-5 pb-4">
					<DialogTitle className="text-[0.9375rem]">
						Welcome to {siteConfig.name}
					</DialogTitle>
					<DialogDescription className="text-[0.8125rem]">
						Thanks for trying the dashboard — here is what you should know
						before you dive in.
					</DialogDescription>
				</DialogHeader>

				<div className="px-5 pb-5">
					<Alert className="border-0 bg-pill-warning text-foreground">
						<AlertTitle className="text-pill-warning-text">
							Alpha software
						</AlertTitle>
						<AlertDescription className="text-text-header">
							DiffKit is in early release. Expect bugs, rough edges, and
							unfinished flows. When something breaks, please report it on our
							GitHub issues board — it helps us ship a stable product.
						</AlertDescription>
					</Alert>
				</div>

				<DialogFooter className="border-t-[0.5px] border-popover-border px-5 py-3">
					<Button type="button" variant="ghost" size="sm" asChild>
						<a href={issuesUrl} target="_blank" rel="noopener noreferrer">
							Report an issue
						</a>
					</Button>
					<Button type="button" size="sm" onClick={dismiss}>
						Got it
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
