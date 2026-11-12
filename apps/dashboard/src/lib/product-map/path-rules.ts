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

/** First matching rule wins; ignored paths belong to no area and are not counted as unmapped. */
export function createAreaMatcher(
	rules: readonly PathRule[],
	ignore: readonly string[],
): (path: string) => AreaMatch {
	const ignored = ignore.map(compileGlob);
	const compiled = rules.map((rule) => ({
		area: rule.area,
		pattern: compileGlob(rule.path),
	}));
	return (path) => {
		if (ignored.some((pattern) => pattern.test(path)))
			return { kind: "ignored" };
		const rule = compiled.find((candidate) => candidate.pattern.test(path));
		return rule ? { kind: "area", area: rule.area } : { kind: "unmapped" };
	};
}
