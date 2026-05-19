import { AssetBrowser } from "@/components/assets/asset-browser";
import { createAssetBrowserOptions } from "@/lib/asset-browser";
import { loadAssetManifest } from "@/lib/assets-manifest";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const manifest = await loadAssetManifest();
  const options = createAssetBrowserOptions(manifest.assets);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Asset Browser</h1>
          <p>Local manifest - thumbnails - classification signals</p>
        </div>
        <dl>
          <div>
            <dt>Assets</dt>
            <dd>{manifest.assets.length}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{manifest.missing ? "Missing" : "Loaded"}</dd>
          </div>
        </dl>
      </header>

      {manifest.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>No Manifest Found</h2>
          <p>
            Run <code>pnpm assets:scan &lt;folder&gt;</code>.
          </p>
        </section>
      ) : (
        <AssetBrowser
          assets={manifest.assets}
          generatedAt={manifest.generatedAt}
          options={options}
          sourceRoot={manifest.sourceRoot}
        />
      )}
    </main>
  );
}
