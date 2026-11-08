/**
 * GitHub accepts `owner:branch` on either side of a compare, which is how a
 * fork's branch is named. emulate only knows plain branch names, so this
 * strips the prefix when it names the repository's own owner.
 */
const COMPARE_PATH = /^\/repos\/([^/]+)\/([^/]+)\/compare\/(.+)$/u;

function withoutOwnPrefix(ref: string, owner: string) {
	const prefix = `${owner.toLowerCase()}:`;
	return ref.toLowerCase().startsWith(prefix) ? ref.slice(prefix.length) : ref;
}

export function withoutOwnForkPrefix(request: Request): Request {
	const url = new URL(request.url);
	const match = url.pathname.match(COMPARE_PATH);
	if (!match) return request;

	const [, owner, repo, rawBasehead] = match;
	const basehead = decodeURIComponent(rawBasehead);
	const separatorAt = basehead.indexOf("...");
	if (separatorAt === -1) return request;

	const base = withoutOwnPrefix(basehead.slice(0, separatorAt), owner);
	const head = withoutOwnPrefix(basehead.slice(separatorAt + 3), owner);
	if (`${base}...${head}` === basehead) return request;

	url.pathname = `/repos/${owner}/${repo}/compare/${base}...${head}`;
	return new Request(url, request);
}
