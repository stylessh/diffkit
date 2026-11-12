---
name: product-map
description: Create and maintain a repository's DiffKit product map, the .diffkit folder that describes the product as plain-language areas and says which code belongs to each. Use when asked to set up, update or fix the product map, and after any change that adds, moves, renames or removes a feature, screen, module or folder in a repository that has a .diffkit folder.
license: MIT
metadata:
  homepage: https://github.com/stylessh/diffkit/blob/main/docs/product-map.md
---

# Product map

DiffKit shows a repository as a product: its areas in plain language, how each
works and where its code lives. The repository owns that description as small
files in `.diffkit/`. DiffKit counts everything else (sizes, pull requests,
people) live from GitHub.

```
.diffkit/
  map.json          the overview: pitch, groups of areas, outside systems, tour
  areas/
    <area-id>.json  one area: what it does, how it works, which files are its own
```

## Rules that do not bend

1. **The format is closed.** Only the fields, icons and step kinds listed in
   [references/format.md](references/format.md) exist. Anything else makes
   DiffKit reject the whole map. Do not add a field because it seems useful.
2. **No numbers.** Never write counts, sizes, dates or percentages into these
   files. DiffKit computes them.
3. **Only what you opened.** Every path, line and symbol must be one you
   opened and checked. Describe nothing from its file name alone.
4. **The checker decides when you are done.** The work is finished only when
   `check.mjs --fix` exits 0. Never skip it and never commit a map it rejects.

## Tools

All in this skill's `scripts/` folder. They need Node 18 or later and no
install. Run them from the repository root.

| Script | What it is for |
| --- | --- |
| `survey.mjs` | A bounded inventory of the repository: folders by size, packages, likely entry points, most changed files. Same length for any repository size. |
| `scaffold.mjs` | Writes `map.json` and new area files in the exact accepted shape. Use it instead of typing the structure. |
| `changed.mjs` | Says which areas a change touched, which mentioned files moved, and which new files no area covers. |
| `check.mjs --fix` | Puts keys in the format's order, moves code links whose line drifted back onto their symbol, then validates exactly as DiffKit does and checks the map against the code. |

## Keep it current (the usual job)

Do this in the same pull request as the code change.

1. Run `node <skill>/scripts/changed.mjs`. If it says no update is needed,
   stop: there is nothing to do.
2. **Files that are gone.** Fix every path it lists first.
3. **Areas whose code changed.** Open only those area files. Update the
   `summary`, `flow`, `features` and `entryPoints` where the behaviour, a
   path, a line or a symbol is now wrong. Leave what your change did not
   affect exactly as it is.
4. **New files no area covers.** Add a pattern to the `paths` of the area each
   belongs to, at folder level where you can. Generated or vendored files go
   in `ignore` in `map.json` instead.
5. **A new product area** gets `scaffold.mjs area …`. Add one only for
   something a user or a new contributor would name as its own thing, not for
   a new folder.
6. Run `node <skill>/scripts/check.mjs --fix` until it exits 0.

A bug fix or a refactor that moves no files usually needs no map edit.

## Set it up

### Ask first

Ask these three questions together, with your question tool if you have one.
If you cannot ask, or the user told you to proceed on your own, take the
defaults and say which you took.

1. **What to map.** Default: the whole repository. In a monorepo, offer the
   apps and packages `survey.mjs` lists and let the user leave some out; put
   the ones left out in `ignore`.
2. **Check the map in CI?** Default: yes. Adds a workflow that validates the
   map on every pull request. It needs no secret.
3. **Refresh it every week?** Default: no. Adds a scheduled workflow where a
   coding agent updates the map and opens a pull request. Options: Claude
   Code, Codex, or no. It needs an API key stored as a repository secret, so
   never choose it for the user.

### Then build it

1. Run `survey.mjs`. Propose areas from its output: things a user or a new
   contributor would recognise, named in plain language ("Checkout",
   "Search", "Billing sync"), not after folders. Aim for 6 to 30. Group them
   into 2 to 5 bands.
2. `scaffold.mjs init --pitch "…"`, then one `scaffold.mjs area …` per area
   with its name, tagline, summary, paths and its band and group.
3. Fill in each area file: `flow`, `features`, `entryPoints`, `dependsOn`,
   `outside`, `goodParts`, `watch`. Follow "Large repositories" below for how
   much to read.
4. In `map.json`, add the `outside` systems the areas name and a `tour` of 4
   to 8 stops that walks a newcomer through the product.
5. Run `check.mjs --fix`. Add patterns or `ignore` entries until few files
   are left outside the map, and fix everything it reports.
6. Add the note below to `AGENTS.md` (create it if there is none; also add it
   to `CLAUDE.md` if the repository has one that does not import
   `AGENTS.md`).
7. Add the workflows the user chose, as described in
   [references/automation.md](references/automation.md).
8. Commit on a new branch and open a pull request titled "Add a product map".
   In its description, say what you set up and what the user still has to do
   (for a weekly refresh: add the secret).

### The AGENTS.md note

```markdown
## Product map

`.diffkit/` describes this product as areas: `map.json` is the overview and
each file in `areas/` covers one area and lists the paths that belong to it.
When a change adds, moves, renames or removes a feature, screen, module or
folder, update the matching area file in the same pull request. The
`product-map` skill has the steps, the format and a checker
(`npx skills add stylessh/diffkit --skill product-map`).
```

## Large repositories

The map describes a product, not every file, so the work must not grow with
the repository.

- **Do not walk the tree.** `survey.mjs` is the inventory. Do not list
  directories or read files to find out what exists.
- **Read a fixed amount per area.** For each area, open its entry points and
  the files `survey.mjs` lists as most changed inside it: about 10 to 15
  files, never the whole folder. That is enough for a flow of 3 to 6 steps
  and 3 to 8 features.
- **Patterns at folder level.** Prefer `apps/billing/**` to a list of files.
  A handful of patterns per area is normal; dozens means the area is drawn
  along the wrong line.
- **Work in parallel when you can.** If you can start subagents, give each
  one 3 to 6 areas, the survey output and this skill. Each writes only its
  own area files, so they never conflict. Write `map.json` yourself once
  they are done.
- **Very large or unfamiliar repositories.** Start with one area per
  top-level app or package, get the checker passing, then split only the
  areas that carry most of the changes.

## Fix it

When DiffKit says the map needs fixing, run `check.mjs --fix`: it prints the
same problems. Fix only those and run it again until it exits 0.

## Writing rules

- Plain language. No jargon the product's own users would not know, and no
  internal code names in `name`, `tagline` or `summary`.
- Short. A `summary` is one or two sentences; a flow step's `note` is one.
- Evidence. Each entry in `goodParts` and `watch` names the file that shows
  it.
- Per area: a `flow` of 3 to 6 steps, 3 to 8 `features`, 3 to 6
  `entryPoints`, one to three notes each in `goodParts` and `watch`.
