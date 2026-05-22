import { AssetGroupReviewWorkspace } from "@/components/assets/asset-group-review-workspace";
import {
  loadAssetGroupReviews,
  buildGroupReviewItems,
  calculateGroupReviewStats
} from "@/lib/asset-group-review";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadAssetManifest } from "@/lib/assets-manifest";

export const dynamic = "force-dynamic";

export default async function AssetGroupReviewPage() {
  const [groups, manifest, reviews] = await Promise.all([
    loadAssetGroups(),
    loadAssetManifest(),
    loadAssetGroupReviews()
  ]);
  const items = buildGroupReviewItems(groups.groups, manifest.assets, reviews);
  const stats = calculateGroupReviewStats(items);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Revisione gruppi asset</h1>
          <p>
            Revisiona migliaia di asset locali per gruppo, non un file alla
            volta.
          </p>
        </div>
        <dl>
          <div>
            <dt>Asset totali</dt>
            <dd>{stats.totalAssets}</dd>
          </div>
          <div>
            <dt>Asset revisionati</dt>
            <dd>{stats.reviewedAssets}</dd>
          </div>
          <div>
            <dt>Gruppi revisionati</dt>
            <dd>{stats.reviewedGroups}</dd>
          </div>
          <div>
            <dt>Sconosciuti</dt>
            <dd>{stats.unknownRemaining}</dd>
          </div>
          <div>
            <dt>Bassa affidabilita</dt>
            <dd>{stats.lowConfidenceRemaining}</dd>
          </div>
        </dl>
      </header>

      {groups.missing || manifest.missing ? (
        <section className="asset-empty">
          <h2>Indice revisione mancante</h2>
          <p>
            Esegui <code>pnpm assets:scan</code> e{" "}
            <code>pnpm assets:group</code> prima della revisione gruppi.
          </p>
        </section>
      ) : (
        <AssetGroupReviewWorkspace
          initialItems={items}
          initialReviews={reviews}
          initialStats={stats}
        />
      )}
    </main>
  );
}
