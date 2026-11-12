# Keeping the map current without anyone asking

Two workflows, both optional, both in this skill's `assets/` folder. Copy the
ones the user chose into `.github/workflows/` unchanged, apart from the two
edits named below.

## The check (no secret, recommended)

`assets/product-map-check.yml` → `.github/workflows/product-map.yml`

Runs on every pull request and on pushes to the default branch. It fails when
DiffKit would reject the map, when the map mentions a file that no longer
exists, or when an area has no files left. Files no area covers show as a
warning.

Edits to make when copying:

- If the default branch is not `main`, change it under `on.push.branches`.
- If the user wants pull requests that add unplaced code to fail, set
  `fail-on-unmapped: "true"`. Leave it `"false"` unless they ask: it stops
  people who do not use an agent from merging.

## The weekly refresh (needs an API key)

`assets/product-map-refresh-claude.yml` or
`assets/product-map-refresh-codex.yml` →
`.github/workflows/product-map-refresh.yml`

Every Monday a coding agent runs `changed.mjs --since "8 days ago"`, re-reads
only the areas whose code changed, updates their files and stops. A second
job opens a pull request with the result. Nothing happens in a week where no
area's code changed.

How it is kept safe: the agent's job can only read the repository. Its
changes travel to the second job as a patch, of which only paths under
`.diffkit/` are applied, and the check runs on the result before the pull
request is opened. The agent never holds a token that can write.

Tell the user, in the pull request description, what they must do before it
works:

1. Add the API key as a repository secret: `ANTHROPIC_API_KEY` for Claude
   Code, `OPENAI_API_KEY` for Codex.
2. Turn on "Allow GitHub Actions to create and approve pull requests" under
   Settings > Actions > General.

Never create or ask for the secret's value yourself.

## Without GitHub Actions

If the user's agent has its own scheduler, the same job is one prompt on a
weekly schedule:

> Run the product-map skill's "Keep it current" steps for everything merged
> in the last eight days (`changed.mjs --since "8 days ago"`), and open a
> pull request if any area file changed.
