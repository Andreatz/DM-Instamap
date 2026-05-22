# Asset Pack Importer

The pack importer reuses the local `scanAssets` pipeline and applies preset
rules to tag and reclassify assets coming from popular community packs.

## Presets

```ts
import { PACK_PRESETS, type PackPreset } from "@dm-instamap/assets";
```

Currently supported:

- `forgotten-adventures`
- `two-minute-tabletop`
- `czepeku`
- `generic`

Each preset has filename + folder regexes that map common substrings to
classifications/tags (for example `Forgotten Adventures/Doors/...` maps to
classification `door`, tags `forgotten-adventures`, `wood`).

## API

```ts
importAssetPack({ assetRoot, preset, defaultTags, outputRoot })
```

Behaviour:

- Runs `scanAssets(assetRoot, { outputRoot })`.
- For every entry whose `classificationSource` is `unknown` or `heuristic`,
  applies the preset rules; manually classified assets are left alone.
- Adds preset tags and the optional `defaultTags` to every imported asset.

The returned summary lists `added` entries, `presetTagsApplied`,
`reclassifiedCount`, and the underlying `manifest`.

## Web endpoint

`POST /api/assets/import-pack` body:

```json
{
  "assetRoot": "C:/Assets/ForgottenAdventures",
  "preset": "forgotten-adventures",
  "defaultTags": ["imported", "needs-review"]
}
```

The web UI form (`PackImporterForm`) also offers a "Run on local worker"
toggle that delegates the work to the FastAPI worker and shows a
`JobProgressBar` polling `/api/jobs/<id>`.

## CLI

```bash
pnpm assets:import-pack --root ./local-assets/fa --preset forgotten-adventures --default-tags fa,dungeon
```

The CLI prints the imported count, preset tags applied, reclassified count,
and any manifest errors.

## Integration with the scanner

`applyPackRulesToEntry(entry, preset, defaultTags)` is exposed independently
to retro-tag entries already in the manifest without re-running the importer.
