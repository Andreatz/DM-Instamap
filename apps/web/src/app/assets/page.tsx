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
          <h1>Browser asset</h1>
          <p>Manifest locale - anteprime - segnali di classificazione</p>
        </div>
        <dl>
          <div>
            <dt>Asset</dt>
            <dd>{manifest.assets.length}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{manifest.missing ? "Mancante" : "Caricato"}</dd>
          </div>
        </dl>
      </header>

      {manifest.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>Nessun manifest trovato</h2>
          <p>
            Esegui <code>pnpm assets:scan &lt;cartella&gt;</code>.
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
