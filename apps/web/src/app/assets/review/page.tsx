import { AssetReview } from "@/components/assets/asset-review";
import { loadAssetManifest } from "@/lib/assets-manifest";
import { loadAssetOverrides } from "@/lib/asset-overrides";

export const dynamic = "force-dynamic";

export default async function AssetReviewPage() {
  const [manifest, overrides] = await Promise.all([loadAssetManifest(), loadAssetOverrides()]);

  return (
    <main className="asset-page review-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Revisione asset</h1>
          <p>Correggi le classificazioni locali e scrivi override manuali.</p>
        </div>
        <dl>
          <div>
            <dt>Asset</dt>
            <dd>{manifest.assets.length}</dd>
          </div>
          <div>
            <dt>Overrides</dt>
            <dd>{Object.keys(overrides.overrides).length}</dd>
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
        <AssetReview assets={manifest.assets} initialOverrides={overrides} />
      )}
    </main>
  );
}
