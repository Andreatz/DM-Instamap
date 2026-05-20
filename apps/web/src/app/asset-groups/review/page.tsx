import { AssetGroupReviewWorkspace } from "@/components/assets/asset-group-review-workspace";
import { loadAssetGroupReviews, buildGroupReviewItems, calculateGroupReviewStats } from "@/lib/asset-group-review";
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
          <h1>Group Asset Review</h1>
          <p>Review thousands of local assets by group, not one file at a time.</p>
        </div>
        <dl>
          <div>
            <dt>Total Assets</dt>
            <dd>{stats.totalAssets}</dd>
          </div>
          <div>
            <dt>Reviewed Assets</dt>
            <dd>{stats.reviewedAssets}</dd>
          </div>
          <div>
            <dt>Reviewed Groups</dt>
            <dd>{stats.reviewedGroups}</dd>
          </div>
          <div>
            <dt>Unknown</dt>
            <dd>{stats.unknownRemaining}</dd>
          </div>
          <div>
            <dt>Low Confidence</dt>
            <dd>{stats.lowConfidenceRemaining}</dd>
          </div>
        </dl>
      </header>

      {groups.missing || manifest.missing ? (
        <section className="asset-empty">
          <h2>Review Index Missing</h2>
          <p>
            Run <code>pnpm assets:scan</code> and <code>pnpm assets:group</code> before group review.
          </p>
        </section>
      ) : (
        <AssetGroupReviewWorkspace initialItems={items} initialReviews={reviews} initialStats={stats} />
      )}
    </main>
  );
}
