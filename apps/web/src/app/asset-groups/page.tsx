import { AssetTaxonomyGroups } from "@/components/assets/asset-taxonomy-groups";
import { loadTaxonomyGroups } from "@/lib/asset-taxonomy-groups";

export const dynamic = "force-dynamic";

export default async function AssetGroupsPage() {
  const data = await loadTaxonomyGroups();

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Gruppi semantici di asset</h1>
          <p>
            Tassonomia multilivello da <code>asset-manifest.json</code>:
            macroCategoria / gruppo, con temi, source pack e stato.{" "}
            <a href="/asset-groups/review">Revisiona i gruppi</a>
          </p>
        </div>
        <dl>
          <div>
            <dt>Asset</dt>
            <dd>{data.summary.totalAssets}</dd>
          </div>
          <div>
            <dt>Gruppi</dt>
            <dd>{data.summary.groupCount}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{data.missing ? "Mancante" : "Caricato"}</dd>
          </div>
        </dl>
      </header>

      {data.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>Nessun manifest trovato</h2>
          <p>
            Genera la tassonomia con <code>pnpm assets:import-tags</code>,{" "}
            <code>assets:map-taxonomy</code> e <code>assets:manifest</code>.
          </p>
        </section>
      ) : (
        <>
          <section
            className="report-grid"
            aria-label="Riepilogo tassonomia asset"
          >
            <ReportCard label="Asset totali" value={data.summary.totalAssets} />
            <ReportCard
              label="Gruppi semantici"
              value={data.summary.groupCount}
            />
            <ReportCard label="Unknown" value={data.summary.unknown} />
            <ReportCard label="Needs-review" value={data.summary.needsReview} />
            <ReportCard
              label="Light sospette"
              value={data.summary.suspiciousLight}
            />
            <ReportCard
              label="Source pack"
              value={
                data.summary.topSourcePacks
                  .map((entry) => `${entry.pack} (${entry.count})`)
                  .join(", ") || "nessuno"
              }
            />
          </section>

          <AssetTaxonomyGroups
            generatedAt={data.generatedAt}
            groups={data.groups}
            summary={data.summary}
          />
        </>
      )}
    </main>
  );
}

function ReportCard({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <article className="report-card">
      <span className="report-label">{label}</span>
      <span className="report-value">{value}</span>
    </article>
  );
}
