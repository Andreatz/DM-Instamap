import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function ReferencesPage() {
  const manifest = await loadReferenceMaps();

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Reference Maps</h1>
          <p>Local map references for layout inspiration and future generation planning.</p>
        </div>
        <dl>
          <div>
            <dt>References</dt>
            <dd>{manifest.references.length}</dd>
          </div>
          <div>
            <dt>Index</dt>
            <dd>{manifest.missing ? "Missing" : "Loaded"}</dd>
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
        <>
          <section className="group-toolbar">
            <span>{manifest.references.length} references shown</span>
            {manifest.generatedAt ? <span>Indexed {new Date(manifest.generatedAt).toLocaleString()}</span> : null}
            {manifest.sourceRoot ? <span title={manifest.sourceRoot}>Local source loaded</span> : null}
          </section>

          <section className="reference-grid" aria-label="Reference maps">
            {manifest.references.map((reference) => (
              <article className="reference-card" key={reference.id}>
                <div className="reference-preview">
                  <img alt="" loading="lazy" src={reference.previewUrl} />
                </div>
                <div className="reference-card-body">
                  <div className="group-title-row">
                    <h2>{getFileName(reference.path)}</h2>
                    <span>{reference.mapType}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Size</dt>
                      <dd>
                        {reference.width ?? "?"} x {reference.height ?? "?"}
                      </dd>
                    </div>
                    <div>
                      <dt>Format</dt>
                      <dd>{reference.extension}</dd>
                    </div>
                  </dl>
                  <div className="tag-list">
                    {reference.tags.slice(0, 12).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="color-list">
                    {reference.dominantColors.map((color) => (
                      <span key={color.hex} title={`${color.hex} (${color.population})`}>
                        <i style={{ backgroundColor: color.hex }} />
                        {color.hex}
                      </span>
                    ))}
                  </div>
                  {reference.styleDna ? (
                    <section className="detail-block">
                      <h3>Style DNA</h3>
                      <p>{reference.styleDna.promptSummary}</p>
                      <div className="tag-list">
                        {reference.styleDna.visualTags.slice(0, 8).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <p>{reference.path}</p>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function getFileName(referencePath: string): string {
  return referencePath.split(/[\\/]/u).at(-1) ?? referencePath;
}
