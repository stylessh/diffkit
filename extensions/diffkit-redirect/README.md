# DiffKit Extension

Standalone browser extension for redirecting only selected GitHub URLs to DiffKit.

## What it does

- Redirects matching GitHub URLs at page start
- Lets you keep the extension globally enabled or disabled
- Shows one switch per redirect rule in the popup
- Uses a configurable list of rules instead of redirecting every GitHub page
- Supports both exact URL redirects and regex-based route schemas
- Supports custom route remaps like GitHub PR changes pages to DiffKit review pages
- On the DiffKit web app (`diff-kit.com` and local dev), sets `data-diffkit-extension="1"` on `<html>` so the site can hide “install extension” prompts when the add-on is already loaded

## Default rule

The extension ships with these enabled rules:

- `https://github.com/`
- `https://diff-kit.com/`
- `https://github.com/pulls/*`
- `https://diff-kit.com/pulls`
- `https://github.com/issues/*`
- `https://diff-kit.com/issues`
- `https://github.com/:owner/:repo` (repository overview; excludes `orgs`, `settings`, etc.)
- `https://diff-kit.com/:owner/:repo`
- `https://github.com/:owner/:repo/pull/:number`
- `https://diff-kit.com/:owner/:repo/pull/:number`
- `https://github.com/:owner/:repo/pull/:number/changes`
- `https://diff-kit.com/:owner/:repo/review/:number`
- `https://github.com/:owner/:repo/issues/:number`
- `https://diff-kit.com/:owner/:repo/issues/:number`
- `https://github.com/:owner` (profile; excludes global pages like `/pulls`, `/explore`, etc.)
- `https://diff-kit.com/:owner`

## Rule format

```json
[
  {
    "id": "github-pull-details",
    "label": "Pull request details",
    "description": "Redirect GitHub pull request detail pages to DiffKit.",
    "enabled": true,
    "match": {
      "urlRegex": "^https://github\\.com/([^/?#]+)/([^/?#]+)/pull/(\\d+)/?$",
      "excludeUrlRegexes": []
    },
    "redirect": {
      "replacement": "https://diff-kit.com/$1/$2/pull/$3"
    }
  }
]
```

For an exact URL redirect, use:

```json
{
    "id": "one-off",
    "label": "Specific PR page",
    "description": "Single URL redirect",
    "enabled": true,
    "match": {
      "exactUrl": "https://github.com/org/repo/pull/123"
  },
  "redirect": {
    "url": "https://diff-kit.com/org/repo/pull/123"
  }
}
```

## Install locally

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `extensions/diffkit-redirect`

## Releasing to the stores

Bump `version` in `manifest.json` and merge to `main`. The
[Extension — publish to stores](../../.github/workflows/extension-publish.yml)
workflow packs the folder and, for each store that does not have that version
yet, uploads it and sends it to review. A store that already has the version is
left alone, so the workflow is safe to re-run after a failure.

- A pull request that changes the extension without a new version gets a
  warning, because merging it would publish nothing.
- Every run attaches the packed zip as the `diffkit-extension` artifact.
- On Chrome, if an older version is still in review and the store refuses the
  upload because of the item's state, that review is cancelled so the new
  version can take its place. Any other upload failure leaves the review alone.
- Only the package is updated. Store listing text and screenshots stay as they
  are in each developer dashboard.

To build the same zip locally (into `dist/`):

```bash
pnpm extension:pack
```

### One-time setup

Chrome Web Store:

This is already done for `stylessh/diffkit`; the steps are here for rotating a
key or setting up a fork. The service account lives in the Google Cloud project
`diffkit-extension`.

1. In a Google Cloud project, enable the **Chrome Web Store API** and create a
   service account (it needs no roles). Create a JSON key for it.
2. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/),
   add the service account's email under **Account**. A publisher can have one
   service account. The publisher ID is the UUID in the dashboard's URL.
3. Store both in the repository:

```bash
gh secret set CHROME_SERVICE_ACCOUNT_KEY < service-account-key.json
```

```bash
gh variable set CHROME_PUBLISHER_ID --body "<publisher id>"
```

Firefox Add-ons:

1. Create API credentials at
   <https://addons.mozilla.org/developers/addon/api/key/>. Mozilla emails a
   confirmation link first, and shows the full secret only once, on the page
   that generates it.
2. Store the JWT issuer and JWT secret (each command prompts for the value):

```bash
gh secret set AMO_JWT_ISSUER
```

```bash
gh secret set AMO_JWT_SECRET
```

Then prove the credentials without uploading anything:

```bash
gh workflow run extension-publish.yml -f mode=check
```

Firefox (AMO) requires a **Gecko add-on ID** and **`data_collection_permissions`** in MV3 (`required: ["none"]` here — no developer telemetry). Minimum versions are set for desktop **140+** and Android **142+** to match Firefox data-consent support and `options_page` compatibility. Chrome ignores `browser_specific_settings`.

## Scope

This version is intentionally limited to `github.com` in `manifest.json`. If you later want redirects from other source hosts, add those hosts to the extension matches and permissions.

## Popup and rules page

The popup lists one switch per rule under a master switch. Pausing with the
master switch keeps the per-rule choices. "Edit rules" opens the rules page,
where the rules are edited as JSON.

Both pages follow the system light or dark theme. `styles.css` carries a copy
of the dashboard tokens it uses (from `packages/ui/src/styles/globals.css`) and
the two fonts are bundled in `fonts/`, because an extension page cannot load
the dashboard's stylesheet.
