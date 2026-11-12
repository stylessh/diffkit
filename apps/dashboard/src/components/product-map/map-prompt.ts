import { MAP_FILE_PATH } from "#/lib/product-map/map-file";

/**
 * The brief a repository owner pastes into a coding agent to get a map file.
 * It has to stand alone: the agent has the checkout but not DiffKit's docs.
 */
export function mapSetupPrompt(owner: string, repo: string) {
	return `Write a product map for this repository (${owner}/${repo}) and open a pull request with it.

The map is one file, ${MAP_FILE_PATH}. DiffKit reads it to show the repository as a product: its areas in plain language, how each works and where its code lives. Pull requests, sizes and people are counted live from GitHub, so do not put any numbers in the file.

## Steps

1. Survey the repository: routes or entry points, component and library folders, packages, docs. Propose 6 to 30 product areas that a user or a new contributor would recognise. Name them in plain language ("Checkout", "Search", "Billing sync"), not after folders.
2. Write path rules so every source file lands in exactly one area. The first matching rule wins, so put specific patterns before general ones. Put lock files, generated files and vendored code in "ignore".
3. For each area, open the code before you describe it. Every path, line and symbol you write must be one you opened and checked. Do not describe anything from its file name alone.
4. Group the areas into 2 to 5 bands for the overview, and write a tour of 4 to 8 stops that walks a newcomer through the product.
5. Check the file (see "Before you finish"), commit it on a new branch and open a pull request titled "Add a product map".

## File format

\`\`\`json
{
  "version": 1,
  "pitch": "One sentence: what the product is.",
  "description": "One or two more sentences.",
  "bands": [
    { "id": "screens", "name": "What people use", "caption": "Optional line",
      "groups": [{ "id": "account", "name": "Your account", "areas": ["sign-in"] }] }
  ],
  "areas": [
    {
      "id": "sign-in",
      "name": "Sign-in",
      "icon": "lock",
      "tagline": "A few words",
      "summary": "One or two sentences: what it does for a user.",
      "flow": [
        { "kind": "page", "label": "Login page", "note": "One sentence.", "path": "src/routes/login.tsx" }
      ],
      "features": [
        { "name": "Password reset", "summary": "One or two sentences.",
          "entry": [{ "path": "src/auth/reset.ts", "line": 12, "symbol": "requestReset" }] }
      ],
      "entryPoints": [{ "path": "src/auth/session.ts", "symbol": "getSession", "role": "Where a request finds its user" }],
      "dependsOn": ["database"],
      "outside": ["email-provider"],
      "goodParts": ["What is done well, with the file or number that shows it."],
      "watch": ["What looks rough, with the file or number that shows it."]
    }
  ],
  "rules": [
    { "path": "src/auth/**", "area": "sign-in" },
    { "path": "src/**", "area": "app" }
  ],
  "ignore": ["pnpm-lock.yaml", "**/*.gen.ts"],
  "outside": [{ "id": "email-provider", "name": "Transactional email", "owner": "Postmark", "role": "Sends reset links" }],
  "tour": [{ "title": "Sign in", "text": "About 15 words.", "areas": ["sign-in"], "outside": [] }]
}
\`\`\`

Rules of the format:

- ids: lowercase letters, digits and dashes. Every area must be in exactly one group. "dependsOn" lists other area ids; "outside" lists ids from the top-level "outside".
- Path patterns are globs, not regular expressions: * stays inside one path segment, ** crosses segments ("src/**" is everything under src; "src/lib/api**" also matches src/lib/api.ts), a "**/" segment also matches no folder, {a,b} is either. At most 8 wildcards per pattern.
- "flow" is the path one request takes, 3 to 6 steps. "kind" is one of: page, component, client (in the browser); server, route (on the server); github, storage, external (outside systems); tool.
- "icon" is one of: actions, cache, code, command, comment, commit, compare, computer, display, github, globe, home, inbox, issues, kit, layers, lock, package, pull, refresh, repo, reviews, settings, shell, tag.
- Per area: 3 to 8 features, 3 to 6 entry points, and one to three notes each in "goodParts" and "watch". Keep every sentence short and free of jargon the product's users would not know.
- Paths are relative to the repository root. "line" is optional; include it only if you checked it.

## Before you finish

- The file is valid JSON and under 1 MB.
- Every path in flow, features and entryPoints exists.
- Every area is in one group and receives at least one file from the rules.
- List the repository's tracked files and confirm that few are left matching no rule and no ignore pattern.
`;
}

/** A shorter brief for a map file that exists but was rejected. */
export function mapFixPrompt(problems: readonly string[]) {
	return `${MAP_FILE_PATH} in this repository was rejected by DiffKit. Fix these problems without changing anything else, then open a pull request:

${problems.map((problem) => `- ${problem}`).join("\n")}

Reminders: every area must be in exactly one group; "rules", "dependsOn", "tour" and "issues" may only name areas that exist; path patterns are globs (* inside a segment, ** across segments, {a,b} alternatives), not regular expressions; paths are relative to the repository root.
`;
}
