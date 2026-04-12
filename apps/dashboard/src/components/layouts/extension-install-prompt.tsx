"use client";

import { XIcon } from "@diffkit/icons";
import { Logo } from "@diffkit/ui/components/logo";
import { useEffect, useState } from "react";
import { isDiffKitExtensionPresent } from "#/lib/diffkit-extension-detect";
import {
	recordExtensionInstallPromptDismissed,
	shouldShowExtensionInstallPrompt,
} from "#/lib/extension-install-prompt-storage";
import { getExtensionStoreInstallUrl } from "#/lib/extension-store-url";
import { useHasMounted } from "#/lib/use-has-mounted";

export function ExtensionInstallPrompt() {
	const hasMounted = useHasMounted();
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!hasMounted) {
			return;
		}

		function applyVisibility() {
			setVisible(shouldShowExtensionInstallPrompt(isDiffKitExtensionPresent()));
		}

		applyVisibility();

		if (isDiffKitExtensionPresent()) {
			return;
		}

		const el = document.documentElement;
		const observer = new MutationObserver(() => {
			if (isDiffKitExtensionPresent()) {
				setVisible(false);
				observer.disconnect();
			} else {
				applyVisibility();
			}
		});
		observer.observe(el, {
			attributes: true,
			attributeFilter: ["data-diffkit-extension"],
		});
		return () => observer.disconnect();
	}, [hasMounted]);

	function dismiss() {
		recordExtensionInstallPromptDismissed();
		setVisible(false);
	}

	if (!visible) {
		return null;
	}

	const installHref = getExtensionStoreInstallUrl();

	return (
		<div
			className={
				"flex w-fit max-w-full items-center gap-2 rounded-lg bg-surface-1 px-3 py-2 text-xs text-foreground"
			}
		>
			<Logo className="size-4 shrink-0" aria-hidden />
			<span className="min-w-0 flex-1">
				Install the DiffKit extension to redirect GitHub PRs, issues, and
				matching pages here.
			</span>
			<a
				href={installHref}
				target="_blank"
				rel="noopener noreferrer"
				className="shrink-0 rounded-md bg-foreground/10 px-2 py-0.5 font-medium transition-colors hover:bg-foreground/15"
			>
				Install
			</a>
			<button
				type="button"
				onClick={dismiss}
				className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
				aria-label="Dismiss"
			>
				<XIcon size={12} strokeWidth={2} />
			</button>
		</div>
	);
}
