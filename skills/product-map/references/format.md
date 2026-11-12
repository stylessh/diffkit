# The `.diffkit` folder format

Two kinds of file, both JSON. Paths are relative to the repository root.

**The format is closed.** A field, icon or step kind that is not listed here
is an error and DiffKit rejects the whole map. Fields are written in the order
shown; `check.mjs --fix` puts them in that order.

**The files stay small.** They say what an area is and how it works, in a few
sentences. They never list files, name functions or carry line numbers:
DiffKit finds the files from an area's `paths` and shows the ones that change
most on its own.

## `.diffkit/map.json`

The overview. It holds no description of any single area.

```json
{
  "version": 1,
  "pitch": "One sentence: what the product is.",
  "description": "One or two more sentences, shown beside the map.",
  "bands": [
    {
      "id": "screens",
      "name": "What people use",
      "caption": "Optional line under the band name",
      "groups": [
        { "id": "account", "name": "Your account", "areas": ["sign-in", "settings"] }
      ]
    }
  ],
  "ignore": ["pnpm-lock.yaml", "**/*.gen.ts", "vendor/**"],
  "outside": [
    { "id": "email-provider", "name": "Transactional email", "owner": "Postmark", "role": "Sends reset links" }
  ],
  "tour": [
    { "title": "Sign in", "text": "About 15 words on what happens here.", "areas": ["sign-in"], "outside": ["email-provider"] }
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `version` | yes | Always `1`. |
| `pitch` | yes | One sentence. |
| `description` | no | One or two sentences. |
| `bands` | yes | The overview's rows. Each band has `id`, `name`, optional `caption` and `groups`; each group has `id`, `name` and `areas`, a list of area ids. **Every area must be in exactly one group.** |
| `ignore` | no | Path patterns for files that belong to no area and should not count as unmapped: lock files, generated code, vendored code. |
| `outside` | no | Systems outside the repository that areas talk to. `owner` is who runs it ("GitHub", "Stripe", "Your backend"). |
| `tour` | no | 4 to 8 stops, each lighting some `areas` (and optionally `outside` ids) with about 15 words of `text`. |

## `.diffkit/areas/<area-id>.json`

One file per area, about a hundred lines. **The file name is the area's id**:
lowercase letters, digits and dashes, ending in `.json`. There is no `id`
field inside.

```json
{
  "name": "Sign-in",
  "icon": "lock",
  "tagline": "A few words, shown on hover",
  "summary": "One or two sentences: what it does for a user.",
  "paths": ["src/auth/**", "src/routes/{login,logout}.tsx"],
  "flow": [
    { "kind": "page", "label": "Login page", "note": "One sentence.", "path": "src/routes/login.tsx" },
    { "kind": "server", "label": "Session check", "note": "One sentence." },
    { "kind": "storage", "label": "Sessions table", "note": "One sentence." }
  ],
  "features": [
    { "name": "Password reset", "summary": "One sentence.", "path": "src/auth/reset.ts" },
    { "name": "Remember this device", "summary": "One sentence." }
  ],
  "dependsOn": ["database"],
  "outside": ["email-provider"]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Plain language. |
| `icon` | no | One of the names listed below. Any other value is an error; leave the field out for a neutral icon. |
| `tagline` | yes | A few words. |
| `summary` | yes | One or two sentences on what it does for a user. |
| `paths` | yes | The folders that are this area's own, as path patterns. See below. |
| `screen` | no | `{ "light": "…", "dark": "…" }`: repository paths of a screenshot per theme. |
| `flow` | no | The path one request takes, 3 to 6 steps. Each has `kind`, `label` and a one-sentence `note`. |
| `features` | no | The area's parts, 3 to 8. Each has `name` and a one-sentence `summary`. |
| `dependsOn` | no | Ids of other areas this one builds on. "Used by" is derived; do not write it. |
| `outside` | no | Ids from `outside` in `map.json`. Naming one that is not listed there is an error. |
| `issues` | no | `[{ "number": 137, "note": "…" }]`: issues about this area. Shown only while the issue is open on GitHub. |

A flow step or a feature may carry `path`: **one** file to open first. Use it
only when there is an obvious one, and leave it out otherwise. There is no
line number and no symbol: both go stale with every edit, and DiffKit shows
the area's most changed files without being told.

### Path patterns

Globs, not regular expressions. Write them at folder level.

| Pattern | Matches |
| --- | --- |
| `*` | Anything inside one path segment. `src/*.ts` is `src/a.ts`, not `src/x/a.ts`. |
| `**` | Anything, across segments. `src/**` is everything under `src`; `src/lib/api**` also matches `src/lib/api.ts`. |
| `**/` | A whole segment of `**` also matches no folder. `**/package.json` matches the root one too. |
| `{a,b}` | Either. `src/{auth,session}/**`. May nest: `biome.json{,c}`. |
| `?` | One character inside a segment. |
| `\` | Makes the next character literal. |

Limits: 300 characters, 8 wildcards and 64 brace alternatives per pattern.

**The most specific pattern wins.** When several patterns match a file, it
goes to the one that fixes the longest start of the path. `src/lib/github/**`
beats `src/**` for `src/lib/github/pulls.ts`, whichever area each belongs to
and in whatever order. So a broad pattern in one area and a narrow one in
another never conflict, and areas need no ordering.

A file matched by `ignore` in `map.json` belongs to no area, whatever else
matches it.

### `kind` values for flow steps

| Where it runs | Kinds |
| --- | --- |
| In the browser | `page`, `component`, `client` |
| On the server | `server`, `route` |
| Outside systems | `github`, `storage`, `external` |
| Tooling | `tool` |

### `icon` values

`actions`, `cache`, `code`, `command`, `comment`, `commit`, `compare`,
`computer`, `display`, `github`, `globe`, `home`, `inbox`, `issues`, `kit`,
`layers`, `lock`, `package`, `pull`, `refresh`, `repo`, `reviews`, `settings`,
`shell`, `tag`.

## What makes a map invalid

DiffKit rejects the whole map, and shows the list of problems, when:

- a file is not a JSON object, or `version` is not `1`;
- any object has a field this document does not list;
- a required text is missing or empty, or a field has the wrong type;
- `icon` or a flow step's `kind` is not one of the listed values;
- a file in `areas/` is not named `<id>.json` with a valid id;
- an area has no `paths`, or a pattern breaks a limit;
- `dependsOn`, a group, or a tour stop names an area that has no file;
- an area or a tour stop names an outside system `map.json` does not list;
- an area is in no group, or in more than one;
- a path points outside the repository (starts with `/` or contains `..`).

Limits: 200 areas, 100 patterns per area, 2,000 characters per text field.
