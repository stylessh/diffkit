# Product map

A repository's **Map** tab shows it as a product instead of a file tree: its
areas in plain language, how each one works, where its code lives, and the
pull requests that changed it. A pull request's side panel shows which areas
it touches and with what share of its changed lines.

The map has two halves:

- **Written once, kept in the repository.** `.diffkit/map.json` on the default
  branch names the areas, says which files belong to each and explains each
  one. It is ordinary reviewed text: change it in a pull request.
- **Counted when the page opens.** File counts and sizes, merged and open pull
  requests per area, each pull request's share, the people involved. None of
  this is stored; DiffKit reads it from GitHub every time, so it is never out
  of date.

A repository without the file has no Map tab. Opening `/owner/repo/map`
directly shows a prompt to copy into a coding agent (Claude Code, Codex,
Cursor, Antigravity or any other): it writes the file and opens a pull request,
and the map appears once that is merged. A file that was rejected gets the
same page with the problems listed and a prompt that fixes them.

## The file

`.diffkit/map.json`, at most 1 MB. DiffKit's own is the reference example:
[`.diffkit/map.json`](../.diffkit/map.json).

```jsonc
{
  "version": 1,
  "pitch": "One sentence: what the product is.",
  "description": "One or two more sentences, shown beside the map.",

  // The overview's layout: bands, each with labelled groups of area ids.
  // Every area must be in exactly one group.
  "bands": [
    {
      "id": "screens",
      "name": "What people use",
      "groups": [{ "id": "pulls", "name": "Pull requests", "areas": ["review"] }]
    }
  ],

  "areas": [
    {
      "id": "review",                       // lowercase letters, digits, dashes
      "name": "Review & diff",
      "icon": "reviews",                    // see "Icons" below; optional
      "tagline": "A few words, shown on hover",
      "summary": "One or two sentences: what it does for a user.",

      // How it works: the path one request takes. `kind` picks the lane and icon.
      "flow": [
        { "kind": "page", "label": "Review page", "note": "One sentence.", "path": "src/routes/review.tsx" }
      ],

      // What is inside: the sub-features, each with one or more code links.
      "features": [
        { "name": "Inline threads", "summary": "One or two sentences.",
          "entry": [{ "path": "src/review/threads.ts", "line": 19, "symbol": "useThreads" }] }
      ],

      // Ways into the code: where to start reading.
      "entryPoints": [{ "path": "src/review/page.tsx", "symbol": "ReviewPage", "role": "Layout and queries" }],

      "dependsOn": ["github-data"],         // other area ids; "Used by" is derived
      "outside": ["github-rest"],           // ids from "outside" below
      "goodParts": ["What is done well, with its evidence."],
      "watch": ["What looks rough, with its evidence."],

      // Optional screenshots, as repository paths. Served like README images,
      // so they show for public repositories or when signed in to GitHub.
      "screen": { "light": ".diffkit/screens/review-light.jpg", "dark": ".diffkit/screens/review-dark.jpg" }
    }
  ],

  // Which files belong to which area. The first matching rule wins, so put
  // specific patterns before general ones.
  "rules": [
    { "path": "src/review/**", "area": "review" },
    { "path": "src/lib/github/**", "area": "github-data" }
  ],
  // Files that belong to no area and should not count as unmapped.
  "ignore": ["pnpm-lock.yaml", "**/*.gen.ts"],

  // Optional.
  "outside": [{ "id": "github-rest", "name": "REST API", "owner": "GitHub", "role": "Most reads" }],
  "tour": [{ "title": "Sign in", "text": "About 15 words.", "areas": ["review"], "outside": [] }],
  "issues": [{ "number": 137, "areas": ["review"], "note": "Why it matters here." }]
}
```

**Path patterns** are globs, not regular expressions: `*` stays inside one
path segment, `**` crosses segments (`src/**` is everything under `src`,
`src/lib/github**` also matches `src/lib/github.ts`), a `**/` segment also
matches no folder at all, `{a,b}` is either, and `\` escapes. At most 8
wildcards and 300 characters per pattern.

**Flow kinds:** `page`, `component`, `client` (drawn in the browser lane),
`server`, `route` (the server lane), `github`, `storage`, `external` (the
outside lane) and `tool`.

**Icons:** `actions`, `cache`, `code`, `command`, `comment`, `commit`,
`compare`, `computer`, `display`, `github`, `globe`, `home`, `inbox`,
`issues`, `kit`, `layers`, `lock`, `package`, `pull`, `refresh`, `repo`,
`reviews`, `settings`, `shell`, `tag`. Anything else gets a neutral icon.

**Issue hints** are the one part that ages: they tie an issue number to areas
because nothing in an issue says which code it is about. An issue is shown
only while it is still open on GitHub.

A file that does not parse, names an area that does not exist, leaves an area
out of every group or has a pattern the matcher refuses is rejected as a
whole, and the Map page lists what to fix.

## Writing one with an agent

The areas and their descriptions need the code read, so this is a job for a
coding agent with the repository checked out. The Map page of a repository
without a map offers the full prompt, with the format included
(`mapSetupPrompt` in `apps/dashboard/src/components/product-map/map-prompt.ts`);
in short it asks for this:

> Write `.diffkit/map.json` for this repository, following
> `docs/product-map.md` in stylessh/diffkit.
>
> 1. List routes, component folders, libraries, packages and docs, and propose
>    10 to 30 product areas a user or contributor would recognise. Name them
>    in plain language, not after folders.
> 2. Write path rules so every source file lands in one area, specific rules
>    first. Put lock files and generated files in `ignore`.
> 3. For each area, open the code before describing it. Write the summary, the
>    request path (4 to 6 steps), the sub-features and 4 to 6 entry points.
>    Every path, line and symbol must be one you opened and checked.
> 4. Add two or three notes per area on what is done well and what looks
>    rough, each with the file or number that shows it.
> 5. Group the areas into bands, write a tour of about seven stops, and check
>    the file: valid JSON, every referenced path exists, every area is in one
>    group and receives at least one file.

For DiffKit's 25 areas this took four agents about eleven minutes and 1.4M
tokens in total.

## Keeping it current

- **New code outside the map** shows as "files outside the map" in the
  overview's side panel. That number is the signal to add rules.
- **Descriptions** go stale when an area's code changes a lot. Re-read only
  the areas a large pull request touched; the pull request's "Product areas"
  section names them.
- DiffKit's own file is covered by a test
  (`apps/dashboard/src/lib/product-map/repo-map.test.ts`): it must parse,
  every path it mentions must exist and every area must receive files.
  `node scripts/capture-map-screens.mjs` refreshes its screenshots from demo
  mode.

## What it costs

Opening the map makes one GitHub request for the file, one for the file tree,
one per 50 pull requests (up to 300, most recently updated first) and, when
the file has issue hints, one for open issues. Results are cached in the
browser for five minutes and refreshed when a pull request changes. A pull
request page makes two extra requests, and only for a repository that has a
map. Repository pages learn whether a map exists from the query they already
make.

## Limits

- Activity is counted from pull requests, not commits, so work pushed straight
  to the default branch is not shown.
- Only the 300 most recently updated open and merged pull requests are
  counted, and only the first 100 changed files of each; the page says when
  that cut applies.
- Sizes are bytes of the files in an area, not lines of code.
- GitHub truncates very large file trees (about 100,000 entries); sizes are
  then partial.
