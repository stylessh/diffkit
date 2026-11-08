// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

(
	globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("Button", () => {
	it("makes disabled slotted links inert", () => {
		const html = renderToStaticMarkup(
			createElement(
				Button,
				{ asChild: true, disabled: true },
				createElement(
					"a",
					{
						"aria-disabled": false,
						"data-disabled": "false",
						href: "/settings",
						tabIndex: 0,
					},
					"Settings",
				),
			),
		);

		expect(html).toContain('aria-disabled="true"');
		expect(html).toContain('data-disabled=""');
		expect(html).toContain('tabindex="-1"');
		expect(html).not.toContain('data-disabled="false"');
		expect(html).not.toContain(" disabled=");
	});

	it("blocks disabled activation during capture", () => {
		const element = Button({
			asChild: true,
			disabled: true,
			children: createElement("a", { href: "/settings" }, "Settings"),
		});
		const preventDefault = vi.fn();
		const stopPropagation = vi.fn();
		const props = element.props as {
			onClickCapture: (event: {
				preventDefault: () => void;
				stopPropagation: () => void;
			}) => void;
		};

		props.onClickCapture({ preventDefault, stopPropagation });

		expect(preventDefault).toHaveBeenCalledOnce();
		expect(stopPropagation).toHaveBeenCalledOnce();
	});

	it("runs the disabled guard before slotted child handlers", async () => {
		const container = document.createElement("div");
		const root = createRoot(container);
		const childCapture = vi.fn();
		const childClick = vi.fn();
		try {
			await act(async () => {
				root.render(
					createElement(
						Button,
						{ asChild: true, disabled: true },
						createElement(
							"a",
							{
								"aria-disabled": false,
								"data-disabled": "false",
								href: "/settings",
								onClick: childClick,
								onClickCapture: childCapture,
								tabIndex: 0,
							},
							"Settings",
						),
					),
				);
			});

			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			expect(link?.getAttribute("aria-disabled")).toBe("true");
			expect(link?.getAttribute("data-disabled")).toBe("");
			expect(link?.tabIndex).toBe(-1);
			const click = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
			});
			await act(async () => {
				link?.dispatchEvent(click);
			});

			expect(click.defaultPrevented).toBe(true);
			expect(childCapture).not.toHaveBeenCalled();
			expect(childClick).not.toHaveBeenCalled();
		} finally {
			await act(async () => root.unmount());
		}
	});
});
