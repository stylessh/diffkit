# Product map

A repository's **Map** tab shows it as a product instead of a file tree: its
areas in plain language, how each one works, where its code lives, and the
pull requests that changed it. A pull request's side panel shows which areas
it touches, each with its share of the changed lines the map can place, and
how many of its files the map does not cover yet.

The map has two halves:

- **Written by an agent, kept in the repository.** The `.diffkit/` folder on
  the default branch names the areas, says which folders belong to each and
  explains each one in a few sentences. It is ordinary reviewed text, changed
  in pull requests, and deliberately small: about a hundred lines per area.
- **Worked out when the page opens.** File counts, merged and open
  pull requests per area, each pull request's share, the people involved, and
  the files in each area that change the most. None of this is stored; DiffKit
  reads it from GitHub, and the browser may show the last answer for up to
  five minutes.

The rule for which half something belongs to: if it can be counted or looked
up, DiffKit computes it. The files never list files, name functions or carry
line numbers, because those change with every edit. An earlier version stored
hand-picked entry points with line numbers and notes on code quality; both
are gone. Entry points are now the area's most changed files, computed, and
code-quality notes are a different feature.

## Setting one up

A repository without the folder shows the Map tab only to people who can push
to it, marked **New**. For them `/owner/repo/map` shows a three-line prompt to
copy into a coding agent (Claude Code, Codex, Cursor, Antigravity or any other).
Everyone else has no Map tab, and the page only says there is no map yet. The prompt installs the
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

The aim is that a repository sets its map up once and never tends it by hand.
Four things do the tending:

- **The note in `AGENTS.md`.** Every agent working in the repository reads
  that when a change adds, moves, renames or removes a feature, the matching
  area file changes in the same pull request.
- **The skill's tools** ([`skills/product-map/scripts/`](../skills/product-map/scripts)),
  all dependency-free:
  - `changed.mjs` names the areas a change touched, the mentioned files that
    moved and the new files no area covers, so an update reads only those.
  - `check.mjs --fix` applies DiffKit's own validation, confirms every
    mentioned path exists and every area receives files, and puts keys in the
    format's order.
  - `survey.mjs` and `scaffold.mjs` are for setting a map up: a bounded
    inventory of any size of repository, and files written in the one
    accepted shape.
- **Workflows the skill installs on request** (templates in
  [`skills/product-map/assets/`](../skills/product-map/assets)): a check on
  every pull request, which needs no secret, and an optional weekly refresh
  where a coding agent updates the areas whose code changed and a pull
  request is opened. In the refresh the agent's job can only read the
  repository; a second job applies only its changes under `.diffkit/`, runs
  the check and opens the pull request.
- **DiffKit itself.** A pull request's side panel says how many of its files
  are outside the map, and the overview's side panel counts them for the whole
  repository.

The format is closed: a field, icon or step kind the format does not list
makes the whole map invalid, in the checker and in DiffKit alike. An agent can
therefore not drift into a structure the page cannot draw.

### In this repository

- DiffKit's own map is covered by a test
  (`apps/dashboard/src/lib/product-map/repo-map.test.ts`): it must parse,
  every path it mentions must exist, every area must receive files and no
  area file may run past 150 lines.
- `.github/workflows/product-map.yml` runs the skill's check action on this
  repository's own map.
- The skill's scripts are exercised end to end on a throwaway repository in
  `apps/dashboard/src/lib/product-map/skill-scripts.test.ts`.
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
- GitHub truncates very large file trees (about 100,000 entries); file counts
  are then partial.
- Screenshots are served from GitHub like README images, so they show for
  public repositories or a browser signed in to GitHub.
