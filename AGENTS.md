# Notes for coding agents

## Product map

`.diffkit/` describes this product as areas: `map.json` is the overview and
each file in `areas/` covers one area and lists the folders that belong to it.
When a change adds, moves, renames or removes a feature, screen, module or
folder, update the matching area file in the same pull request. The
`product-map` skill in `skills/product-map/` has the format and a checker:

```bash
node skills/product-map/scripts/changed.mjs      # what this change asks of the map
node skills/product-map/scripts/check.mjs --fix  # validate the map against the code
```

The skill's `scripts/lib/` is generated from
`apps/dashboard/src/lib/product-map/`. After changing those modules, run
`node scripts/build-map-skill.mjs`.
