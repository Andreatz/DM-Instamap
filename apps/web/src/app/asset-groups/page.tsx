import { loadAssetGroups } from "@/lib/asset-groups";

export const dynamic = "force-dynamic";

export default async function AssetGroupsPage() {
  const groups = await loadAssetGroups();

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Asset Groups</h1>
          <p>Generated sets for browsing, generation hints, and future manual curation.</p>
        </div>
        <dl>
          <div>
            <dt>Groups</dt>
            <dd>{groups.groupCount}</dd>
          </div>
          <div>
            <dt>Index</dt>
            <dd>{groups.missing ? "Missing" : "Loaded"}</dd>
          </div>
        </dl>
      </header>

      {groups.missing ? (
        <section className="asset-empty" aria-live="polite">
          <h2>No Groups Found</h2>
          <p>
            Run <code>pnpm assets:group</code> after scanning assets.
          </p>
        </section>
      ) : (
        <>
          <section className="group-toolbar">
            <span>{groups.groups.length} groups shown</span>
            {groups.generatedAt ? <span>Grouped {new Date(groups.generatedAt).toLocaleString()}</span> : null}
            <span>Rename, merge, and split are planned for a later pass.</span>
          </section>

          <section className="group-grid" aria-label="Asset groups">
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
                      <dt>Assets</dt>
                      <dd>{group.assetCount}</dd>
                    </div>
                    <div>
                      <dt>Representative</dt>
                      <dd>{group.representativeAssetId ?? "none"}</dd>
                    </div>
                  </dl>
                  <div className="tag-list">
                    {group.tags.slice(0, 10).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <p>{group.sourceFolders.slice(0, 2).join(", ") || "No source folder"}</p>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
