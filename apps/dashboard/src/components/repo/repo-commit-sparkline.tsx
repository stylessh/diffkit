import { useQuery } from "@tanstack/react-query";
import {
	type GitHubQueryScope,
	githubRepoParticipationQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";

/** Sized to fill a 24px chip inside its 1px ring: 9 rows over 22px. */
const ROWS = 9;
const COLUMNS = 32;
const PITCH = 22 / ROWS;
const DOT_RADIUS = 0.75;
const WIDTH = COLUMNS * PITCH;
const HEIGHT = ROWS * PITCH;
const ACTIVE = "#60C679";
/**
 * Eased fades on the left (the oldest weeks) and along the top and bottom, so
 * the grid melts into the pill; the right edge, this week, stays crisp.
 */
const LEFT_FADE =
	"linear-gradient(to right, rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.55) 4px, rgb(0 0 0 / 0.88) 8px, #000 12px)";
const VERTICAL_FADE =
	"linear-gradient(to bottom, rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.8) 3px, #000 6px, #000 calc(100% - 6px), rgb(0 0 0 / 0.8) calc(100% - 3px), rgb(0 0 0 / 0.35))";
const EDGE_FADE = `${LEFT_FADE}, ${VERTICAL_FADE}`;

/** The weeks spread over `COLUMNS`, oldest first: each column the mean of the weeks it covers. */
function bucket(weekly: number[]) {
	if (weekly.length === 0) return Array.from({ length: COLUMNS }, () => 0);
	return Array.from({ length: COLUMNS }, (_, column) => {
		const start = Math.floor((column * weekly.length) / COLUMNS);
		const end = Math.max(
			start + 1,
			Math.floor(((column + 1) * weekly.length) / COLUMNS),
		);
		const weeks = weekly.slice(start, end);
		return (
			weeks.reduce((sum, commits) => sum + (commits || 0), 0) / weeks.length
		);
	});
}

/**
 * A column's reach from the middle row: 0 for no commits, then up to the full
 * height for the busiest column, so the year reads as a waveform.
 */
function reach(commits: number, busiest: number) {
	if (commits <= 0 || busiest <= 0) return 0;
	return Math.ceil((commits / busiest) * Math.ceil(ROWS / 2));
}

/** A year of weekly commits as a dot matrix: lit dots spread from the middle row as a column gets busier. */
export function RepoCommitSparkline({
	scope,
	owner,
	repo,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
}) {
	const hasMounted = useHasMounted();
	const query = useQuery({
		...githubRepoParticipationQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const columns = bucket(query.data?.weeklyCommits ?? []);
	const busiest = Math.max(0, ...columns);
	const middle = Math.floor(ROWS / 2);
	const label =
		busiest > 0
			? `Weekly commit activity for ${owner}/${repo}, last 52 weeks`
			: `No commits in the last 52 weeks for ${owner}/${repo}`;

	return (
		<svg
			role="img"
			aria-label={hasMounted && !query.isLoading ? label : undefined}
			aria-hidden={hasMounted && !query.isLoading ? undefined : true}
			width={WIDTH}
			height={HEIGHT}
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			style={{
				maskImage: EDGE_FADE,
				WebkitMaskImage: EDGE_FADE,
				maskComposite: "intersect",
				WebkitMaskComposite: "source-in",
			}}
			className="pointer-events-none shrink-0 select-none"
		>
			{columns.map((commits, column) => {
				const lit = reach(commits, busiest);
				return Array.from({ length: ROWS }, (_, row) => {
					const on = Math.abs(row - middle) < lit;
					return (
						<circle
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid; position is the identity
							key={`${column}-${row}`}
							cx={column * PITCH + PITCH / 2}
							cy={row * PITCH + PITCH / 2}
							r={DOT_RADIUS}
							fill={on ? ACTIVE : "currentColor"}
							fillOpacity={on ? 1 : 0.09}
						/>
					);
				});
			})}
		</svg>
	);
}
