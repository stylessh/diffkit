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
people) live from GitHub, so **never write numbers into these files**.

```
.diffkit/
  map.json          the overview: pitch, groups of areas, outside systems, tour
  areas/
    <area-id>.json  one area: what it does, how it works, which files are its own
```

The exact fields are in [references/format.md](references/format.md). Read it
before writing or editing a file.

After any edit, run the checker from the repository root and fix what it
reports. It is the same validation DiffKit applies, plus checks only a
checkout can make:

```bash
node <this skill's folder>/scripts/check.mjs
```

## Keep it current (the usual job)

Do this in the same pull request as the code change, whenever the change adds,
moves, renames or removes a feature, screen, module or folder.

1. Run the checker. "Files that belong to no area" are new or moved code the
   map does not place yet. For each, add a pattern to the `paths` of the area
   it belongs to. If it is generated or not part of the product, add it to
   `ignore` in `map.json` instead.
2. Open the area file for each area whose behaviour you changed and bring it
   up to date: `summary`, the `flow` steps, `features`, `entryPoints`. Fix any
   path, line or symbol your change moved. Remove what you deleted.
3. A new product area gets its own file in `areas/` and a place in one group
   in `map.json`. Add one only for something a user or a new contributor would
   name as its own thing, not for a new folder.
4. Run the checker again until it passes.

Small changes inside an existing feature (a bug fix, a refactor that moves no
files) need no map edit. Do not rewrite descriptions you did not affect.

## Create it

1. Survey the repository: routes or entry points, component and library
   folders, packages, docs. Propose 6 to 30 areas a user or a new contributor
   would recognise, named in plain language ("Checkout", "Search", "Billing
   sync"), not after folders.
2. Write one file per area in `.diffkit/areas/`. **Open the code before you
   describe it**: every path, line and symbol must be one you opened and
   checked. Do not describe anything from its file name alone.
3. Give each area `paths` patterns so every source file lands in one area.
   The most specific matching pattern wins, so areas need no ordering. Put
   lock files, generated files and vendored code in `ignore` in `map.json`.
4. Write `map.json`: the pitch, 2 to 5 bands of groups that place every area
   exactly once, the outside systems the areas mention, and a tour of 4 to 8
   stops that walks a newcomer through the product.
5. Add the note below to `AGENTS.md` (create the file if there is none; also
   add it to `CLAUDE.md` if the repository has one and it does not import
   `AGENTS.md`), so every agent keeps the map current even without this skill
   loaded.
6. Run the checker until it passes and few files are left outside the map.
   Commit on a new branch and open a pull request titled "Add a product map".

### The AGENTS.md note

```markdown
## Product map

`.diffkit/` describes this product as areas: `map.json` is the overview and
each file in `areas/` covers one area and lists the paths that belong to it.
When a change adds, moves, renames or removes a feature, screen, module or
folder, update the matching area file in the same pull request. The
`product-map` skill has the format and a checker
(`npx skills add stylessh/diffkit --skill product-map`).
```

## Fix it

When DiffKit says the map needs fixing, run the checker: it prints the same
problems. Fix only those, run it again, and open a pull request.

## Writing rules

- Plain language. No jargon the product's own users would not know, and no
  internal code names in `name`, `tagline` or `summary`.
- Short. A `summary` is one or two sentences; a flow step's `note` is one.
- Evidence. Each entry in `goodParts` and `watch` names the file or number
  that shows it.
- Per area: a `flow` of 3 to 6 steps, 3 to 8 `features`, 3 to 6 `entryPoints`,
  one to three notes each in `goodParts` and `watch`.
