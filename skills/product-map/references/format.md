# The `.diffkit` folder format

Two kinds of file, both JSON. Paths are relative to the repository root.
Anything not listed here is ignored.

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

One file per area. **The file name is the area's id**: lowercase letters,
digits and dashes, ending in `.json`. There is no `id` field inside.

```json
{
  "name": "Sign-in",
  "icon": "lock",
  "tagline": "A few words, shown on hover",
  "summary": "One or two sentences: what it does for a user.",
  "paths": ["src/auth/**", "src/routes/{login,logout}.tsx"],
  "flow": [
    { "kind": "page", "label": "Login page", "note": "One sentence.", "path": "src/routes/login.tsx" },
    { "kind": "server", "label": "createSession", "note": "One sentence.", "path": "src/auth/session.ts" },
    { "kind": "storage", "label": "sessions table", "note": "One sentence." }
  ],
  "features": [
    {
      "name": "Password reset",
      "summary": "One or two sentences.",
      "entry": [{ "path": "src/auth/reset.ts", "line": 12, "symbol": "requestReset" }]
    }
  ],
  "entryPoints": [
    { "path": "src/auth/session.ts", "symbol": "getSession", "role": "Where a request finds its user" }
  ],
  "dependsOn": ["database"],
  "outside": ["email-provider"],
  "goodParts": ["What is done well, with the file or number that shows it."],
  "watch": ["What looks rough, with the file or number that shows it."],
  "issues": [{ "number": 137, "note": "Optional: why it matters here." }],
  "screen": { "light": ".diffkit/screens/sign-in-light.jpg", "dark": ".diffkit/screens/sign-in-dark.jpg" }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Plain language. |
| `tagline` | yes | A few words. |
| `summary` | yes | One or two sentences on what it does for a user. |
| `paths` | yes | At least one path pattern. See below. |
| `icon` | no | One of the names listed below; anything else gets a neutral icon. |
| `flow` | no | The path one request takes, 3 to 6 steps. `path` is optional per step. |
| `features` | no | The area's parts, each with code links in `entry`. |
| `entryPoints` | no | Where to start reading. `role` says what the file is for. |
| `dependsOn` | no | Ids of other areas this one builds on. "Used by" is derived; do not write it. |
| `outside` | no | Ids from `outside` in `map.json`. |
| `goodParts`, `watch` | no | Short notes with their evidence. |
| `issues` | no | Issue numbers about this area. Shown only while the issue is open on GitHub, so stale ones do no harm. |
| `screen` | no | Repository paths of a screenshot per theme. |

In `entry` and `entryPoints`, `path` is required; `line` and `symbol` are
optional. Include a `line` only if you checked it.

### Path patterns

Globs, not regular expressions.

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
- a file in `areas/` is not named `<id>.json` with a valid id;
- an area has no `paths`, or a pattern breaks a limit;
- `dependsOn`, a group, or a tour stop names an area that has no file;
- an area is in no group, or in more than one;
- a path points outside the repository (starts with `/` or contains `..`).

Limits: 200 areas, 100 patterns per area, 2,000 characters per text field.
