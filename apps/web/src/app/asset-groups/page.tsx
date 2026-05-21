import { loadAssetGroups } from "@/lib/asset-groups";

export const dynamic = "force-dynamic";

export default async function AssetGroupsPage() {
  const groups = await loadAssetGroups();

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Gruppi di asset</h1>
          <p>Set generati per navigazione, suggerimenti di generazione e futura curatela manuale.</p>
        </div>
        <dl>
          <div>
            <dt>Gruppi</dt>
            <dd>{groups.groupCount}</dd>
          </div>
          <div>
            <dt>Index</dt>
            <dd>{groups.missing ? "Mancante" : "Caricato"}</dd>
          </div>
        </dl>
      </header>

      {groups.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>Nessun gruppo trovato</h2>
          <p>
            Esegui <code>pnpm assets:group</code> dopo aver indicizzato gli asset.
          </p>
        </section>
      ) : (
        <>
          <section className="group-toolbar">
            <span>{groups.groups.length} gruppi mostrati</span>
            {groups.generatedAt ? <span>Raggruppati {new Date(groups.generatedAt).toLocaleString()}</span> : null}
            <a href="/asset-groups/review">Revisiona gruppi a lotti</a>
          </section>

          <section className="group-grid" aria-label="Gruppi di asset">
            {groups.groups.map((group) => (
              <article className="group-card" key={group.id}>
                <div className="group-preview">
                  {group.previewUrl ? <img alt="" loading="lazy" src={group.previewUrl} /> : null}
                </div>
                <div className="group-card-body">
                  <div className="group-title-row">
                    <h2>{group.name}</h2>
                    <span>{group.kind}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Asset</dt>
                      <dd>{group.assetCount}</dd>
                    </div>
                    <div>
                      <dt>Rappresentativo</dt>
                      <dd>{group.representativeAssetId ?? "nessuno"}</dd>
                    </div>
                  </dl>
                  <div className="tag-list">
                    {group.tags.slice(0, 10).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <p>{group.sourceFolders.slice(0, 2).join(", ") || "Nessuna cartella sorgente"}</p>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
