import { ReferenceReview } from "@/components/references/reference-review";
import { loadReferenceOverrides } from "@/lib/reference-overrides";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function ReferenceReviewPage() {
  const [manifest, overrides] = await Promise.all([
    loadReferenceMaps(),
    loadReferenceOverrides()
  ]);

  return (
    <main className="asset-page review-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Revisione riferimenti</h1>
          <p>
            Correggi tipo mappa, tag, punteggio e note delle mappe di
            riferimento locali.
          </p>
        </div>
        <dl>
          <div>
            <dt>Riferimenti</dt>
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
          <h2>Nessun registro riferimenti trovato</h2>
          <p>
            Esegui <code>pnpm references:scan &lt;cartella&gt;</code>.
          </p>
        </section>
      ) : (
        <ReferenceReview
          initialOverrides={overrides}
          references={manifest.references}
        />
      )}
    </main>
  );
}
