// Provider logos sourced from svgl.app (https://svgl.app), inlined as React
// components so they render without a network round-trip and pick up theme
// colors via `currentColor` where possible.
//
// Single-color marks use `currentColor` where the brand asset allows it.
// Multi-color marks (Google, Mistral, Groq) keep their brand palette. SpaceXAI
// uses a wide mark fitted inside the same square icon slot as other providers.

import { cn } from "../lib/utils";

export type AiProviderLogoKey =
	| "anthropic"
	| "openai"
	| "deepseek"
	| "moonshot"
	| "zai"
	| "google"
	| "xai"
	| "groq"
	| "mistral";

// Brand-correct display names — `capitalize` doesn't get OpenAI / xAI right.
export const PROVIDER_LABELS: Record<AiProviderLogoKey, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	deepseek: "DeepSeek",
	moonshot: "Moonshot AI",
	zai: "Z.ai",
	google: "Google",
	xai: "SpaceXAI",
	groq: "Groq",
	mistral: "Mistral",
};

export function providerLabel(provider: AiProviderLogoKey): string {
	return PROVIDER_LABELS[provider];
}

type LogoProps = {
	className?: string;
	size?: number;
};

function svgClass(className?: string) {
	return cn("shrink-0", className);
}

function Anthropic({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			fillRule="evenodd"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Anthropic"
			className={svgClass(className)}
		>
			<path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
		</svg>
	);
}

function OpenAI({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 256 260"
			preserveAspectRatio="xMidYMid"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="OpenAI"
			className={svgClass(className)}
		>
			<path
				fill="currentColor"
				d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"
			/>
		</svg>
	);
}

function DeepSeek({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="DeepSeek"
			className={svgClass(className)}
		>
			<path
				fill="#4D6BFE"
				d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"
			/>
		</svg>
	);
}

function Moonshot({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 512 512"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Moonshot AI"
			className={svgClass(cn("overflow-hidden rounded-[3px]", className))}
		>
			<path d="M503 114.333v280c0 60.711-49.29 110-110 110H113c-60.711 0-110-49.289-110-110v-280c0-60.71 49.289-110 110-110h280c60.71 0 110 49.29 110 110z" />
			<path
				fill="#027AFF"
				d="M342.065 189.759c1.886-2.42 3.541-4.63 5.289-6.77.81-1.007.74-1.771-.046-2.824-7.58-9.965-8.298-21.028-3.935-32.254 3.275-8.448 10.52-12.406 19.373-13.25 5.52-.521 10.936.046 15.959 2.73 6.596 3.53 10.438 8.912 11.688 16.341.995 5.926.81 11.712-.868 17.452-2.974 10.161-10.277 15.427-20.287 16.758-8.31 1.11-16.734 1.25-25.113 1.817-.648.046-1.308 0-2.06 0z"
			/>
			<path
				fill="#FFF"
				d="M321.512 144.254h-50.064l-39.637 90.384h-56.036v-89.99H131v232.868h44.787v-98.103h78.973c13.598 0 26.015-7.927 31.744-20.252v118.355h44.787v-98.103c0-23.342-18.239-42.97-41.523-44.671v-.116h-24.593a45.577 45.577 0 0 0 26.884-24.534l29.453-65.838z"
			/>
		</svg>
	);
}

function Zai({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Z.ai"
			className={svgClass(className)}
		>
			<rect
				x="1.5"
				y="1.5"
				width="21"
				height="21"
				rx="5"
				fill="currentColor"
				opacity="0.12"
			/>
			<path
				fill="currentColor"
				d="M6.15 6.25h11.7v2.12l-7.5 7.26h7.5v2.12H6.15v-2.12l7.5-7.26h-7.5V6.25Z"
			/>
		</svg>
	);
}

function Xai({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 834 318"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="SpaceXAI"
			className={svgClass(className)}
			preserveAspectRatio="xMidYMid meet"
			style={{ width: size, height: size }}
		>
			<g fill="currentColor">
				<path d="M832.565 0.590983C736.633 8.41256 359.563 55.1598 98.1057 317.999H1.08203L11.9228 307.195C66.6371 254.336 308.741 30.3127 832.565 0.299805V0.590983Z" />
				<path d="M504.192 317.999H428.146L278.315 208.933C292.122 200.25 306.018 191.98 319.957 184.104L504.192 317.999Z" />
				<path d="M382.659 318H306.648L283.589 301.228H154.852C163.915 293.18 173.091 285.368 182.362 277.784H251.322L215.636 251.826C228.392 242.335 241.288 233.244 254.287 224.535L382.659 318Z" />
				<path d="M105.997 116.89L164.612 159.488C150.024 168.078 136.37 176.58 123.626 184.897L30.0522 116.854L105.997 116.89Z" />
			</g>
		</svg>
	);
}

function Groq({ className, size = 14 }: LogoProps) {
	// Keeps brand red. Rounded so it reads as a token in the trigger.
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 201 201"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Groq"
			className={svgClass(cn("rounded-[3px] overflow-hidden", className))}
		>
			<path fill="#F54F35" d="M0 0h201v201H0V0Z" />
			<path
				fill="#FEFBFB"
				d="m128 49 1.895 1.52C136.336 56.288 140.602 64.49 142 73c.097 1.823.148 3.648.161 5.474l.03 3.247.012 3.482.017 3.613c.01 2.522.016 5.044.02 7.565.01 3.84.041 7.68.072 11.521.007 2.455.012 4.91.016 7.364l.038 3.457c-.033 11.717-3.373 21.83-11.475 30.547-4.552 4.23-9.148 7.372-14.891 9.73l-2.387 1.055c-9.275 3.355-20.3 2.397-29.379-1.13-5.016-2.38-9.156-5.17-13.234-8.925 3.678-4.526 7.41-8.394 12-12l3.063 2.375c5.572 3.958 11.135 5.211 17.937 4.625 6.96-1.384 12.455-4.502 17-10 4.174-6.784 4.59-12.222 4.531-20.094l.012-3.473c.003-2.414-.005-4.827-.022-7.241-.02-3.68 0-7.36.026-11.04-.003-2.353-.008-4.705-.016-7.058l.025-3.312c-.098-7.996-1.732-13.21-6.681-19.47-6.786-5.458-13.105-8.211-21.914-7.792-7.327 1.188-13.278 4.7-17.777 10.601C75.472 72.012 73.86 78.07 75 85c2.191 7.547 5.019 13.948 12 18 5.848 3.061 10.892 3.523 17.438 3.688l2.794.103c2.256.082 4.512.147 6.768.209v16c-16.682.673-29.615.654-42.852-10.848-8.28-8.296-13.338-19.55-13.71-31.277.394-9.87 3.93-17.894 9.562-25.875l1.688-2.563C84.698 35.563 110.05 34.436 128 49Z"
			/>
		</svg>
	);
}

function Mistral({ className, size = 14 }: LogoProps) {
	// Keeps Mistral's distinctive yellow/orange grid.
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 256 233"
			preserveAspectRatio="xMidYMid"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Mistral"
			className={svgClass(className)}
		>
			<path d="M186.18182 0h46.54545v46.54545h-46.54545z" />
			<path fill="#F7D046" d="M209.45454 0h46.54545v46.54545h-46.54545z" />
			<path d="M0 0h46.54545v46.54545H0zM0 46.54545h46.54545V93.0909H0zM0 93.09091h46.54545v46.54545H0zM0 139.63636h46.54545v46.54545H0zM0 186.18182h46.54545v46.54545H0z" />
			<path fill="#F7D046" d="M23.27273 0h46.54545v46.54545H23.27273z" />
			<path
				fill="#F2A73B"
				d="M209.45454 46.54545h46.54545V93.0909h-46.54545zM23.27273 46.54545h46.54545V93.0909H23.27273z"
			/>
			<path d="M139.63636 46.54545h46.54545V93.0909h-46.54545z" />
			<path
				fill="#F2A73B"
				d="M162.90909 46.54545h46.54545V93.0909h-46.54545zM69.81818 46.54545h46.54545V93.0909H69.81818z"
			/>
			<path
				fill="#EE792F"
				d="M116.36364 93.09091h46.54545v46.54545h-46.54545zM162.90909 93.09091h46.54545v46.54545h-46.54545zM69.81818 93.09091h46.54545v46.54545H69.81818z"
			/>
			<path d="M93.09091 139.63636h46.54545v46.54545H93.09091z" />
			<path
				fill="#EB5829"
				d="M116.36364 139.63636h46.54545v46.54545h-46.54545z"
			/>
			<path
				fill="#EE792F"
				d="M209.45454 93.09091h46.54545v46.54545h-46.54545zM23.27273 93.09091h46.54545v46.54545H23.27273z"
			/>
			<path d="M186.18182 139.63636h46.54545v46.54545h-46.54545z" />
			<path
				fill="#EB5829"
				d="M209.45454 139.63636h46.54545v46.54545h-46.54545z"
			/>
			<path d="M186.18182 186.18182h46.54545v46.54545h-46.54545z" />
			<path
				fill="#EB5829"
				d="M23.27273 139.63636h46.54545v46.54545H23.27273z"
			/>
			<path
				fill="#EA3326"
				d="M209.45454 186.18182h46.54545v46.54545h-46.54545zM23.27273 186.18182h46.54545v46.54545H23.27273z"
			/>
		</svg>
	);
}

// Google's brand mark is heavy (lots of gradients). For a sidebar accent we
// use a simplified four-color "G" — visually consistent with the others.
function Google({ className, size = 14 }: LogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Google"
			className={svgClass(className)}
		>
			<path
				fill="#FFC107"
				d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
			/>
			<path
				fill="#FF3D00"
				d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
			/>
			<path
				fill="#4CAF50"
				d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
			/>
			<path
				fill="#1976D2"
				d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
			/>
		</svg>
	);
}

const PROVIDERS: Record<
	AiProviderLogoKey,
	(props: LogoProps) => React.JSX.Element
> = {
	anthropic: Anthropic,
	openai: OpenAI,
	deepseek: DeepSeek,
	moonshot: Moonshot,
	zai: Zai,
	google: Google,
	xai: Xai,
	groq: Groq,
	mistral: Mistral,
};

export function ProviderLogo({
	provider,
	className,
	size = 14,
}: { provider: AiProviderLogoKey } & LogoProps) {
	const Logo = PROVIDERS[provider];
	return <Logo className={className} size={size} />;
}
