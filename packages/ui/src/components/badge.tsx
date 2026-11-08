import { XIcon } from "@diffkit/icons";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-full font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring aria-invalid:outline-1 aria-invalid:outline-destructive transition-[color,background-color,box-shadow] overflow-auto",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground [a&]:hover:bg-primary/90 data-[interactive=true]:hover:bg-primary/90",
				secondary:
					"bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 data-[interactive=true]:hover:bg-secondary/90",
				destructive: "bg-pill-blocked text-pill-blocked-text",
				outline:
					"bg-chip text-muted-foreground shadow-chip [a&]:hover:bg-accent [a&]:hover:text-foreground data-[interactive=true]:hover:bg-accent data-[interactive=true]:hover:text-foreground",
				success: "bg-pill-ok text-pill-ok-text",
				warning: "bg-pill-warning text-pill-warning-text",
				purple: "bg-pill-merged text-pill-merged-text",
				gold: "bg-pill-warning text-pill-warning-text",
			},
			size: {
				sm: "gap-1 px-2 py-0.5 text-[10px] leading-none [&>svg]:size-2.5",
				default: "gap-1 px-3 py-1 text-xs [&>svg]:size-3",
				lg: "gap-1.5 px-3.5 py-1.5 text-sm [&>svg]:size-3.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const pressedStateClass =
	"data-[pressed=true]:bg-tab-selected data-[pressed=true]:text-foreground data-[pressed=true]:shadow-tab-selected data-[pressed=false]:text-muted-foreground hover:data-[pressed=false]:text-foreground";

type BadgeBaseProps = VariantProps<typeof badgeVariants> & {
	icon?: React.ReactNode;
	className?: string;
	children?: React.ReactNode;
};

type BadgeAsSpan = BadgeBaseProps &
	Omit<React.ComponentProps<"span">, "onClick" | "color"> & {
		asChild?: boolean;
		onRemove?: (event: React.MouseEvent<HTMLButtonElement>) => void;
		removeAriaLabel?: string;
		onClick?: never;
		pressed?: never;
	};

type BadgeAsButton = BadgeBaseProps &
	Omit<React.ComponentProps<"button">, "color"> & {
		asChild?: false;
		onClick: React.MouseEventHandler<HTMLButtonElement>;
		pressed?: boolean;
		onRemove?: never;
	};

type BadgeProps = BadgeAsSpan | BadgeAsButton;

function Badge(props: BadgeProps) {
	const { className, variant, size, icon, children, ...rest } = props;
	const resolvedSize = size ?? "default";

	if (
		"onClick" in rest &&
		rest.onClick != null &&
		!("asChild" in rest && rest.asChild)
	) {
		const { onClick, pressed, type, ...buttonRest } = rest as BadgeAsButton;
		return (
			<button
				type={type ?? "button"}
				data-slot="badge"
				data-interactive="true"
				data-pressed={
					pressed === true ? "true" : pressed === false ? "false" : undefined
				}
				aria-pressed={pressed != null ? pressed : undefined}
				onClick={onClick}
				className={cn(
					badgeVariants({ variant, size }),
					pressed != null && pressedStateClass,
					className,
				)}
				{...buttonRest}
			>
				{icon}
				{children}
			</button>
		);
	}

	const { asChild, onRemove, removeAriaLabel, ...spanRest } =
		rest as BadgeAsSpan;

	if (onRemove) {
		const labelPadding =
			resolvedSize === "sm"
				? "py-0.5 pl-2 pr-1"
				: resolvedSize === "lg"
					? "py-1.5 pl-3.5 pr-2"
					: "py-1 pl-3 pr-1.5";
		const removePadding =
			resolvedSize === "sm"
				? "px-1.5"
				: resolvedSize === "lg"
					? "px-2.5"
					: "px-2";

		return (
			<span
				data-slot="badge"
				className={cn(
					badgeVariants({ variant, size }),
					"gap-0 overflow-hidden p-0",
					className,
				)}
				{...spanRest}
			>
				<span
					className={cn(
						"inline-flex min-w-0 items-center",
						resolvedSize === "sm" ? "gap-1" : "gap-1.5",
						labelPadding,
					)}
				>
					{icon}
					{children != null ? (
						<span className="min-w-0 truncate">{children}</span>
					) : null}
				</span>
				<button
					type="button"
					onClick={onRemove}
					aria-label={removeAriaLabel ?? "Remove"}
					data-slot="badge-remove"
					className={cn(
						"flex shrink-0 items-center self-stretch border-l-[0.5px] border-current/20 opacity-70 transition-[opacity,background-color] hover:bg-foreground/10 hover:opacity-100 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring",
						removePadding,
					)}
				>
					<XIcon className={resolvedSize === "lg" ? "size-3.5" : "size-3"} />
				</button>
			</span>
		);
	}

	const Comp = asChild ? Slot : "span";

	return (
		<Comp
			data-slot="badge"
			className={cn(badgeVariants({ variant, size }), className)}
			{...spanRest}
		>
			{icon}
			{children}
		</Comp>
	);
}

export type { BadgeProps };
export { Badge, badgeVariants };
