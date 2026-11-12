# Product map

A repository's **Map** tab shows it as a product instead of a file tree: its
areas in plain language, how each one works, where its code lives, and the
pull requests that changed it. A pull request's side panel shows which areas
it touches, with what share of its changed lines, and how many of its files
the map does not cover yet.

The map has two halves:

- **Written by an agent, kept in the repository.** The `.diffkit/` folder on
  the default branch names the areas, says which files belong to each and
  explains each one. It is ordinary reviewed text, changed in pull requests.
- **Counted when the page opens.** File counts and sizes, merged and open pull
  requests per area, each pull request's share, the people involved. None of
  this is stored; DiffKit reads it from GitHub every time, so it is never out
  of date.

## Setting one up

A repository without the folder has no Map tab. Opening `/owner/repo/map`
directly shows a three-line prompt to copy into a coding agent (Claude Code,
Codex, Cursor, Antigravity or any other). The prompt installs the
**product-map skill** and asks the agent to follow it:

```bash
npx skills add stylessh/diffkit --skill product-map -y
```

The agent reads the code, writes the folder, adds a short note to `AGENTS.md`
and opens a pull request. The map appears once that is merged.

## The folder

```
.diffkit/
  map.json          the overview: pitch, groups of areas, outside systems, tour
  areas/
    <area-id>.json  one area: what it does, how it works, which files are its own
  screens/          optional screenshots an area can show
```

One file per area keeps edits small: a feature pull request touches the one
area it changed. Each area lists its own path patterns, and the most specific
matching pattern wins, so areas need no ordering between them.

The fields are specified once, in the skill:
[`skills/product-map/references/format.md`](../skills/product-map/references/format.md).
DiffKit's own folder is the reference example: [`.diffkit/`](../.diffkit).

A map that does not parse, names an area that has no file, leaves an area out
of every group or has a pattern the matcher refuses is rejected as a whole.
The Map page then lists what to fix and offers a prompt that fixes it.

## Keeping it current

Three things keep the map from going stale:

- **The note in `AGENTS.md`.** Every agent working in the repository reads
  that when a change adds, moves, renames or removes a feature, the matching
  area file changes in the same pull request.
- **The skill** ([`skills/product-map/`](../skills/product-map)). It holds the
  steps for creating, updating and fixing a map, and a checker with no
  dependencies: `node <skill folder>/scripts/check.mjs`. The checker applies
  the same validation as DiffKit, confirms every path the map mentions exists
  and every area receives files, and lists files no area covers. It exits 1 on
  a broken map, so it can run in CI. `npx skills update` brings a repository's
  copy up to date.
- **DiffKit itself.** A pull request's side panel says how many of its files
  are outside the map, and the overview's side panel counts them for the whole
  repository. That number is the signal that the map is behind.

Descriptions go stale more slowly than paths. When an area's code changes a
lot, the pull request's "Product areas" section names the areas to re-read.

### In this repository

- DiffKit's own map is covered by a test
  (`apps/dashboard/src/lib/product-map/repo-map.test.ts`): it must parse,
  every path it mentions must exist and every area must receive files.
- The skill's checker runs a JavaScript copy of the dashboard's validation
  modules. After changing `apps/dashboard/src/lib/product-map/map-file.ts` or
  `path-rules.ts`, run `node scripts/build-map-skill.mjs`; a test fails while
  the copy is stale.
- `node scripts/capture-map-screens.mjs` refreshes the screenshots in
  `.diffkit/screens` from demo mode.

## What it costs

Opening the map makes one GitHub request for the whole folder, one for the
file tree, one per 50 pull requests (up to 300, most recently updated first)
and, when an area lists issues, one for open issues. Results are cached in the
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
- Screenshots are served from GitHub like README images, so they show for
  public repositories or a browser signed in to GitHub.
