import { cn } from "@diffkit/ui/lib/utils";
import { areaIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import { type TileRole, tileRole } from "./spotlight";

const railRoleClassName: Record<TileRole, string> = {
	plain: "text-text-header hover:bg-nav-hover",
	lit: "text-text-header hover:bg-nav-hover",
	dim: "text-muted-foreground hover:bg-nav-hover hover:text-foreground",
	self: "bg-nav-selected text-foreground outline-1 outline-indigo outline-solid -outline-offset-1",
	uses: "text-foreground hover:bg-nav-hover",
	"used-by": "text-foreground hover:bg-nav-hover",
};

const railMarker: Partial<
	Record<TileRole, { label: string; className: string }>
> = {
	uses: { label: "builds on", className: "bg-indigo" },
	"used-by": {
		label: "used by",
		className: "border border-muted-foreground",
	},
};

export function MapRail({
	map,
	currentId,
	onNavigate,
}: {
	map: LoadedProductMap;
	currentId: string;
	onNavigate: (id: string) => void;
}) {
	return (
		<nav
			aria-label="Product areas"
			className="flex h-full min-h-0 flex-col border-rule border-r-[0.5px] bg-group/50"
		>
			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
				{map.bands.map((band) => (
					<div key={band.id} className="mb-3">
						<span className="block px-2 pb-1 text-[11px] text-muted-foreground">
							{band.name}
						</span>
						<ul className="flex flex-col">
							{band.groups
								.flatMap((group) => group.areas)
								.map((id) => {
									const area = map.areaById.get(id);
									if (!area) return null;
									const role = tileRole(
										{ kind: "area", id: currentId },
										id,
										map,
									);
									const marker = railMarker[role];
									const Icon = areaIcon(area.icon);
									return (
										<li key={id}>
											<button
												type="button"
												aria-current={role === "self" ? "page" : undefined}
												onClick={() => onNavigate(id)}
												className={cn(
													"flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors",
													railRoleClassName[role],
												)}
											>
												<Icon
													size={13}
													strokeWidth={2}
													className="shrink-0 opacity-70"
												/>
												<span className="min-w-0 flex-1 truncate">
													{area.name}
												</span>
												{marker ? (
													<span
														title={marker.label}
														className={cn(
															"size-1.5 shrink-0 rounded-full",
															marker.className,
														)}
													/>
												) : null}
											</button>
										</li>
									);
								})}
						</ul>
					</div>
				))}
			</div>
			<div className="flex shrink-0 items-center gap-3 border-rule border-t-[0.5px] px-4 py-2 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span className="size-1.5 rounded-full bg-indigo" />
					builds on
				</span>
				<span className="flex items-center gap-1.5">
					<span className="size-1.5 rounded-full border border-muted-foreground" />
					used by
				</span>
			</div>
		</nav>
	);
}
