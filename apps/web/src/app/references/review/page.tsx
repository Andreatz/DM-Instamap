import { ReferenceReview } from "@/components/references/reference-review";
import { loadReferenceOverrides } from "@/lib/reference-overrides";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function ReferenceReviewPage() {
  const [manifest, overrides] = await Promise.all([loadReferenceMaps(), loadReferenceOverrides()]);

  return (
    <main className="asset-page review-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Reference Review</h1>
          <p>Correct map type, tags, score, and notes for local reference maps.</p>
        </div>
        <dl>
          <div>
            <dt>References</dt>
            <dd>{manifest.references.length}</dd>
          </div>
          <div>
            <dt>Overrides</dt>
            <dd>{Object.keys(overrides.overrides).length}</dd>
          </div>
        </dl>
      </header>

      {manifest.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>No Reference Registry Found</h2>
          <p>
            Run <code>pnpm references:scan &lt;folder&gt;</code>.
          </p>
        </section>
      ) : (
        <ReferenceReview initialOverrides={overrides} references={manifest.references} />
      )}
    </main>
  );
}
