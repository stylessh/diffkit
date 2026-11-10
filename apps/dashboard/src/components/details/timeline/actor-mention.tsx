export function ActorMention({
	actor,
	hideAvatar,
}: {
	actor: { login: string; avatarUrl?: string } | null | undefined;
	hideAvatar?: boolean;
}) {
	const login = actor?.login ?? "someone";
	return (
		<span className="inline-flex items-center gap-1 font-medium text-foreground">
			{!hideAvatar && actor?.avatarUrl && (
				<img
					src={actor.avatarUrl}
					alt={login}
					className="inline-block size-3.5 rounded-full border-[0.5px] border-border align-text-bottom"
				/>
			)}
			{login}
		</span>
	);
}
