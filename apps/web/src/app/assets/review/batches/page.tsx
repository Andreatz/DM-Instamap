import Link from "next/link";
import { AssetAuditBatches } from "@/components/assets/asset-audit-batches";
import { buildAuditBatches, loadAssetAudit } from "@/lib/asset-audit";

export const dynamic = "force-dynamic";

export default async function AssetReviewBatchesPage() {
  const audit = await loadAssetAudit();
  const batches = buildAuditBatches(audit);

  return (
    <main className="asset-page review-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Asset Review Batches</h1>
          <p>
            Intelligent batching of the audit queue. Tackle the most impactful issues first instead of reviewing
            thousands of assets one by one.
          </p>
        </div>
        <dl>
          <div>
            <dt>Assets</dt>
            <dd>{audit.assetCount}</dd>
          </div>
          <div>
            <dt>Needs Review</dt>
            <dd>{audit.needsReviewCount}</dd>
          </div>
          <div>
            <dt>Duplicate Groups</dt>
            <dd>{audit.duplicateGroupCount}</dd>
          </div>
          <div>
            <dt>Low Quality</dt>
            <dd>{audit.lowQualityCount}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href="/assets/review">Go to Per-Asset Review</Link>
      </section>

      {audit.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>No Audit Report Yet</h2>
          <p>
            Run <code>pnpm assets:audit</code> after scanning your assets to generate{" "}
            <code>data/indexes/asset-audit.json</code>. The batch review reads from that file.
          </p>
        </section>
      ) : (
        <AssetAuditBatches batches={batches} />
      )}
    </main>
  );
}
