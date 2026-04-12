# DiffKit Extension

Standalone browser extension for redirecting only selected GitHub URLs to DiffKit.

## What it does

- Redirects matching GitHub URLs at page start
- Lets you keep the extension globally enabled or disabled
- Shows one toggle per redirect rule in the popup
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

## Package for Chrome Web Store / Firefox Add-ons

Store uploads expect **`manifest.json` at the root of the ZIP** (not inside a parent folder). Create the archive from inside this directory:

```bash
cd extensions/diffkit-redirect
zip -r ../../diffkit-redirect.zip . -x "*.DS_Store"
```

Then upload `diffkit-redirect.zip`.

Firefox (AMO) requires a **Gecko add-on ID** and **`data_collection_permissions`** in MV3 (`required: ["none"]` here — no developer telemetry). Minimum versions are set for desktop **140+** and Android **142+** to match Firefox data-consent support and `options_page` compatibility. Chrome ignores `browser_specific_settings`.

## Scope

This version is intentionally limited to `github.com` in `manifest.json`. If you later want redirects from other source hosts, add those hosts to the extension matches and permissions.

## Popup behavior

The popup keeps all default rules enabled unless you turn specific ones off. Use the master switch to pause all redirects without losing your per-rule selections.
