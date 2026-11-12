/**
 * Path rules from a repository's map file. The patterns come from a file
 * anyone with push access can write, so they are globs compiled to a regular
 * expression with no nested repetition, never regular expressions themselves.
 *
 * `*` stays inside one path segment and `**` crosses segments. A `**` that
 * fills a whole segment also matches no segment at all, so "src/**" then
 * "/x.ts" finds src/x.ts. `{a,b}` is either, and a backslash escapes.
 */

export const MAX_GLOB_LENGTH = 300;
const MAX_WILDCARDS = 8;

export type PathRule = { path: string; area: string };

export type AreaMatch =
	| { kind: "area"; area: string }
	| { kind: "ignored" }
	| { kind: "unmapped" };

const REGEX_SPECIAL = /[.+^$()|[\]\\]/;

export function compileGlob(glob: string): RegExp {
	if (glob.length === 0 || glob.length > MAX_GLOB_LENGTH)
		throw new Error(`pattern must be 1 to ${MAX_GLOB_LENGTH} characters`);
	let source = "";
	let depth = 0;
	let wildcards = 0;
	for (let index = 0; index < glob.length; index++) {
		const char = glob[index];
		if (char === "\\") {
			const next = glob[++index];
			if (next === undefined) throw new Error("pattern ends with a backslash");
			source +=
				REGEX_SPECIAL.test(next) || "*?{}".includes(next) ? `\\${next}` : next;
		} else if (char === "*") {
			wildcards += 1;
			if (glob[index + 1] !== "*") {
				source += "[^/]*";
				continue;
			}
			index += 1;
			const atSegmentStart = index === 1 || glob[index - 2] === "/";
			if (atSegmentStart && glob[index + 1] === "/") {
				index += 1;
				source += "(?:.*/)?";
			} else {
				source += ".*";
			}
		} else if (char === "?") {
			source += "[^/]";
		} else if (char === "{") {
			depth += 1;
			source += "(?:";
		} else if (char === "}") {
			if (depth === 0) throw new Error("unmatched }");
			depth -= 1;
			source += ")";
		} else if (char === "," && depth > 0) {
			source += "|";
		} else {
			source += REGEX_SPECIAL.test(char) ? `\\${char}` : char;
		}
	}
	if (depth > 0) throw new Error("unmatched {");
	if (wildcards > MAX_WILDCARDS)
		throw new Error(`at most ${MAX_WILDCARDS} wildcards per pattern`);
	return new RegExp(`^${source}$`);
}

const MAX_ALTERNATIVES = 64;

/** `a/{b,c{,d}}` as the plain patterns it stands for: a/b, a/c, a/cd. */
export function expandBraces(glob: string): string[] {
	let open = -1;
	let depth = 0;
	for (let index = 0; index < glob.length; index++) {
		const char = glob[index];
		if (char === "\\") index += 1;
		else if (char === "{") {
			if (depth === 0) open = index;
			depth += 1;
		} else if (char === "}" && depth > 0) {
			depth -= 1;
			if (depth > 0) continue;
			const options: string[] = [];
			let start = open + 1;
			let inner = 0;
			for (let at = open + 1; at <= index; at++) {
				const here = glob[at];
				if (here === "\\") at += 1;
				else if (here === "{") inner += 1;
				else if (here === "}" && inner > 0) inner -= 1;
				else if ((here === "," && inner === 0) || at === index) {
					options.push(glob.slice(start, at));
					start = at + 1;
				}
			}
			const expanded = options.flatMap((option) =>
				expandBraces(glob.slice(0, open) + option + glob.slice(index + 1)),
			);
			if (expanded.length > MAX_ALTERNATIVES)
				throw new Error(`at most ${MAX_ALTERNATIVES} alternatives per pattern`);
			return expanded;
		}
	}
	return [glob];
}

/** The text a brace-free pattern fixes before its first wildcard. */
function literalPrefix(glob: string) {
	let prefix = "";
	for (let index = 0; index < glob.length; index++) {
		const char = glob[index];
		if (char === "*" || char === "?") break;
		prefix += char === "\\" ? (glob[++index] ?? "") : char;
	}
	return prefix;
}

/**
 * Gives each path to the most specific pattern that matches it: the one that
 * fixes the longest start of the path, then the one with the most fixed text.
 * Order between areas therefore never matters, so each area can keep its own
 * patterns in its own file. Ignored paths belong to no area and do not count
 * as unmapped.
 */
export function createAreaMatcher(
	rules: readonly PathRule[],
	ignore: readonly string[],
): (path: string) => AreaMatch {
	const ignored = ignore.map(compileGlob);
	const candidates = rules
		.flatMap((rule) => {
			compileGlob(rule.path);
			return expandBraces(rule.path).map((glob) => ({
				area: rule.area,
				prefix: literalPrefix(glob),
				fixed: glob.replace(/[*?]/g, "").length,
				pattern: compileGlob(glob),
			}));
		})
		.sort((a, b) => b.prefix.length - a.prefix.length || b.fixed - a.fixed);
	return (path) => {
		if (ignored.some((pattern) => pattern.test(path)))
			return { kind: "ignored" };
		const found = candidates.find(
			(candidate) =>
				path.startsWith(candidate.prefix) && candidate.pattern.test(path),
		);
		return found ? { kind: "area", area: found.area } : { kind: "unmapped" };
	};
}
