# Asset Scanner

The first DM-Instamap asset scanner is local-only and runs from the monorepo
root:

```bash
pnpm assets:scan <folder>
```

It recursively scans `png`, `jpg`, `jpeg`, `webp`, and `svg` files. The scanner
extracts a stable asset id, relative path, SHA-256 file hash, image dimensions,
extension, detectable transparency, and sampled dominant colors.

Results are written to:

- `data/indexes/assets.manifest.json`
- `data/previews/assets/*.webp`

The scanner uses CPU-only local image processing and does not call paid APIs.
