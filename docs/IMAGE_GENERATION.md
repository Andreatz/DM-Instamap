# Image Generation (D3)

DM-Instamap can call an external image-generation provider to produce assets on
demand and import them into the local asset library.

## Providers

Two adapters ship with `@dm-instamap/assets`:

- **Replicate** — `createReplicateImageGenerationProvider({ apiToken, model, version })`
  posts to `/v1/predictions`, polls the prediction, then downloads the resulting
  image.
- **Automatic1111** — `createAutomatic1111Provider({ baseUrl, endpoint })`
  posts to a local Stable Diffusion WebUI `/sdapi/v1/txt2img`.

`createCustomImageGenerationProvider({ generate })` is available for tests and
adapters not yet built in.

## Environment variables

```bash
IMAGE_GEN_PROVIDER=replicate|automatic1111
IMAGE_GEN_API_KEY=...       # Replicate token (or REPLICATE_API_TOKEN)
IMAGE_GEN_MODEL=...         # Replicate model id
IMAGE_GEN_VERSION=...       # Optional Replicate model version
IMAGE_GEN_BASE_URL=...      # Override base URL (Automatic1111 default: http://127.0.0.1:7860)
```

`createImageGenerationProviderFromEnv(process.env)` returns `null` when the
configuration is incomplete.

## Importing generated assets

`importGeneratedAssetToLibrary(provider, { request, result, classification, fileNameHint, outputRoot })`
writes the produced buffer to `data/assets/generated/<slug>-<seed>.<ext>` and
returns a `GeneratedAssetMetadata` payload.

When called through the web app (`POST /api/assets/generate`) or the CLI
(`pnpm assets:generate`) the workflow also runs `scanSingleAsset` and
`appendAssetToManifest` to add the new file to
`data/indexes/assets.manifest.json` without re-running the full scan (F3 / G2).
The route response returns `{ asset, manifestEntry, manifestUpdate }` so the
caller can confirm the manifest was patched.

## CLI

```bash
pnpm assets:generate --prompt "ornate iron door, top-down" --classification door --seed 42 --style-tags wood,iron
```

The CLI honours all environment variables above and prints the new asset id
plus manifest counts.

## Editor integration (I3 / I4)

The Map Editor exposes an "AI Assist" drawer with a "Generate asset from
prompt" action that calls the same endpoint. Newly generated assets show up in
a "Recently Generated" palette section (persisted in `localStorage`) and can be
dragged onto the canvas immediately.
