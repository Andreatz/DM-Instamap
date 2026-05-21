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
          <h1>Revisione asset a lotti</h1>
          <p>
            Raggruppamento intelligente della coda audit. Affronta prima i problemi piu impattanti invece di
            revisionare migliaia di asset uno per uno.
          </p>
        </div>
        <dl>
          <div>
            <dt>Asset</dt>
            <dd>{audit.assetCount}</dd>
          </div>
          <div>
            <dt>Da revisionare</dt>
            <dd>{audit.needsReviewCount}</dd>
          </div>
          <div>
            <dt>Gruppi duplicati</dt>
            <dd>{audit.duplicateGroupCount}</dd>
          </div>
          <div>
            <dt>Bassa qualita</dt>
            <dd>{audit.lowQualityCount}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href="/assets/review">Vai alla revisione per asset</Link>
      </section>

      {audit.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>Nessun report audit disponibile</h2>
          <p>
            Esegui <code>pnpm assets:audit</code> dopo aver indicizzato gli asset per generare{" "}
            <code>data/indexes/asset-audit.json</code>. La revisione a lotti legge quel file.
          </p>
        </section>
      ) : (
        <AssetAuditBatches batches={batches} />
      )}
    </main>
  );
}
