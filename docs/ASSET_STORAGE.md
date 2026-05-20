# Asset Storage

DM-Instamap is local-first, but large source asset libraries should not be
committed directly to Git.

Keep heavy asset packs in local or external storage, such as:

- `data/raw-assets/`
- `local-assets/`
- `assets-local/`
- `reference-maps-local/`
- external drives or cloud storage

The repository `.gitignore` excludes those folders and `*.dungeondraft_pack`
files to reduce the risk of accidentally committing large binary libraries.

Generated lightweight indexes and previews are allowed in the repository:

- `data/indexes/`
- `data/previews/`

Those files let the app remember local scan results, thumbnails, review
corrections, asset groups, embeddings, and reference metadata without storing
the original heavy art packs in Git.

Recommended workflow:

1. Store original asset packs outside Git or in one of the ignored local asset
   folders.
2. Run the scanner against that local folder.
3. Commit code, docs, indexes, and lightweight previews as needed.
4. Do not commit large original map packs, Dungeondraft packs, or raw asset
   archives.
