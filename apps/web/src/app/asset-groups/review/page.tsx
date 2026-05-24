import { AssetTaxonomyReviewWorkspace } from "@/components/assets/asset-taxonomy-review-workspace";
import { loadTaxonomyGroups } from "@/lib/asset-taxonomy-groups";
import {
  countAssetOverrides,
  loadTaxonomyOverrides
} from "@/lib/taxonomy-overrides";

export const dynamic = "force-dynamic";

export default async function AssetGroupReviewPage() {
  const [data, overrides] = await Promise.all([
    loadTaxonomyGroups(),
    loadTaxonomyOverrides()
  ]);
  const overrideCount = countAssetOverrides(overrides);
  const attentionGroups = data.groups.filter(
    (group) =>
      group.statusCounts["needs-review"] +
        group.statusCounts.quarantine +
        group.statusCounts.rejected >
      0
  ).length;

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Revisione gruppi semantici</h1>
          <p>
            Revisiona i gruppi della tassonomia: approva, cambia stato o
            correggi macroCategory/assetGroups/themeTags. Le correzioni vengono
            salvate in <code>asset-overrides.json</code> e applicate con{" "}
            <code>pnpm assets:manifest</code>.{" "}
            <a href="/asset-groups">Torna ai gruppi</a>
          </p>
        </div>
        <dl>
          <div>
            <dt>Gruppi</dt>
            <dd>{data.summary.groupCount}</dd>
          </div>
          <div>
            <dt>Da revisionare</dt>
            <dd>{attentionGroups}</dd>
          </div>
          <div>
            <dt>Needs-review</dt>
            <dd>{data.summary.needsReview}</dd>
          </div>
          <div>
            <dt>Override</dt>
            <dd>{overrideCount}</dd>
          </div>
        </dl>
      </header>

      {data.missing ? (
        <section className="asset-empty">
          <h2>Manifest mancante</h2>
          <p>
            Genera la tassonomia con <code>pnpm assets:import-tags</code>,{" "}
            <code>assets:map-taxonomy</code> e <code>assets:manifest</code>{" "}
            prima della revisione.
          </p>
        </section>
      ) : (
        <AssetTaxonomyReviewWorkspace
          generatedAt={data.generatedAt}
          groups={data.groups}
          initialOverrideCount={overrideCount}
          summary={data.summary}
        />
      )}
    </main>
  );
}
