import { MapEditor } from "@/components/editor/map-editor";
import { loadAssetGroups } from "@/lib/asset-groups";
import { createFallbackPalette, type EditorPaletteAsset } from "@/lib/map-editor";
import { loadAssetManifest } from "@/lib/assets-manifest";
import { generateDungeon } from "@dm-instamap/generator";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const [manifest, groups, initialDocument] = await Promise.all([
    loadAssetManifest(),
    loadAssetGroups(),
    Promise.resolve(
      generateDungeon({
        heightCells: 36,
        requiredRooms: ["boss", "library"],
        roomCount: 8,
        theme: "crypt",
        widthCells: 52
      })
    )
  ]);
  const palette = createPalette(manifest.assets);
  const mapTheme = "crypt";

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Editor mappa</h1>
          <p>Stanze, porte, muri, asset piazzati e JSON del MapDocument locale.</p>
        </div>
      </header>

      <MapEditor assetGroups={groups.groups} initialDocument={initialDocument} mapTheme={mapTheme} palette={palette} />
    </main>
  );
}

function createPalette(assets: Array<{
  classification: string;
  id: string;
  relativePath: string;
  thumbnailUrl: string;
}>): EditorPaletteAsset[] {
  const preferredKinds = new Set(["prop", "furniture", "light", "terrain", "decoration"]);
  const palette = assets
    .filter((asset) => preferredKinds.has(asset.classification))
    .slice(0, 16)
    .map((asset) => ({
      id: asset.id,
      kind: asset.classification,
      name: getFileName(asset.relativePath),
      thumbnailUrl: asset.thumbnailUrl
    }));

  return palette.length > 0 ? palette : createFallbackPalette();
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}
