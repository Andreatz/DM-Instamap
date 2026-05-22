import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadAssetManifest } from "@/lib/assets-manifest";
import { loadAssetAudit } from "@/lib/asset-audit";
import { summarizeAssetLibrary } from "@/lib/asset-library-status";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [projects, assetGroups, manifest, audit, references] = await Promise.all([
    listProjects(),
    loadAssetGroups(),
    loadAssetManifest(),
    loadAssetAudit(),
    loadReferenceMaps()
  ]);
  const recentProjects = projects.slice(0, 4);
  const libraryStatus = summarizeAssetLibrary({
    audit: {
      assetCount: audit.assetCount,
      classificationWarnings: audit.classificationWarnings,
      duplicateGroupCount: audit.duplicateGroupCount,
      generatedAt: audit.generatedAt,
      lowQualityCount: audit.lowQualityCount,
      missing: audit.missing,
      needsReviewCount: audit.needsReviewCount
    },
    groupCount: assetGroups.groupCount,
    manifest: {
      assetCount: manifest.assets.length,
      generatedAt: manifest.generatedAt,
      missing: manifest.missing
    }
  });

  return (
    <main className="home-shell">
      <section className="home-hero">
        <strong>DM-Instamap</strong>
        <h1>Prepara la prossima sessione, in locale.</h1>
        <p>
          Crea mappe D&amp;D modificabili a partire dalla tua libreria di asset, con Style DNA dei riferimenti,
          blueprint narrativi, arredamento automatico ed export per i giocatori o per il DM. Niente cloud, niente
          login, nessuna API richiesta.
        </p>
        <div className="home-status">
          <span className="pill">{libraryStatus.assetCount} asset indicizzati</span>
          <span className="pill">{assetGroups.groupCount} gruppi di asset</span>
          <span className="pill">{references.references.length} mappe di riferimento</span>
          <span className="pill">{projects.length} progetti salvati</span>
        </div>
        <div className="home-actions">
          <Link href="/projects/new">Crea una Nuova Mappa</Link>
          <Link className="secondary" href="/ai-bridge">
            Usa il ChatGPT Bridge
          </Link>
          <Link className="secondary" href="/projects">
            Apri Progetti
          </Link>
        </div>
      </section>

      <section className="home-grid">
        <section className="home-card">
          <h2>Progetti recenti</h2>
          {recentProjects.length === 0 ? (
            <p className="muted">
              Nessun progetto salvato. <Link href="/projects/new">Crea la tua prima mappa</Link> con il wizard.
            </p>
          ) : (
            <ul>
              {recentProjects.map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`}>
                    {project.name}{" "}
                    <span className="muted">
                      - {project.size.width}x{project.size.height}, {project.roomCount} stanze
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-card">
          <h2>Libreria asset</h2>
          <p className={`library-status library-status-${libraryStatus.tone}`}>{libraryStatus.headline}</p>
          <p className="muted">
            {libraryStatus.lastScan
              ? `Ultima scansione: ${new Date(libraryStatus.lastScan).toLocaleString()}`
              : "Nessuna scansione registrata."}
            {libraryStatus.duplicateGroupCount > 0 ? ` - ${libraryStatus.duplicateGroupCount} gruppi duplicati` : ""}
            {libraryStatus.needsReviewCount > 0 ? ` - ${libraryStatus.needsReviewCount} da rivedere` : ""}
          </p>
          <ul>
            <li>
              <Link href="/assets">Sfoglia la libreria asset</Link>
            </li>
            <li>
              <Link href="/asset-groups">Sfoglia i gruppi di asset</Link>
            </li>
            <li>
              <Link href="/assets/review">Coda di revisione asset</Link>
            </li>
            <li>
              <Link href="/assets/review/batches">Revisione a lotti (critici / alti / duplicati)</Link>
            </li>
            <li>
              <Link href="/assets/import-pack">Importa pacchetto di asset</Link>
            </li>
            <li>
              <Link href="/assets/generate">Genera asset da prompt</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>Campagne</h2>
          <p className="muted">Raggruppa le mappe e annota le sessioni.</p>
          <ul>
            <li>
              <Link href="/campaigns">Tutte le campagne</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>Riferimenti</h2>
          <p className="muted">{references.references.length} mappe di riferimento disponibili.</p>
          <ul>
            <li>
              <Link href="/references">Visualizza mappe di riferimento</Link>
            </li>
            <li>
              <Link href="/references/review">Revisione riferimenti</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>Flussi di lavoro</h2>
          <ul>
            <li>
              <Link href="/projects/new">Wizard: crea una nuova mappa</Link>
            </li>
            <li>
              <Link href="/generate">Anteprima rapida del generatore (cave / villaggio / outdoor / multipiano)</Link>
            </li>
            <li>
              <Link href="/ai-bridge">AI Bridge (automatico + manuale)</Link>
            </li>
            <li>
              <Link href="/assets/import-pack">Importa pacchetto di asset</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>Come funziona</h2>
          <ol>
            <li>Indicizza asset e riferimenti locali.</li>
            <li>Genera un blueprint oppure incolla un piano di ChatGPT.</li>
            <li>Modifica la mappa nel canvas.</li>
            <li>Arreda automaticamente e revisiona.</li>
            <li>Esporta la mappa per i giocatori o per il DM.</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
