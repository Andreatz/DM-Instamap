import Link from "next/link";
import { ProjectThumbnail } from "@/components/projects/project-thumbnail";
import { computeProjectReadiness } from "@/lib/project-readiness";
import {
  listProjects,
  readProject,
  type DmInstamapProject
} from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const summaries = await listProjects();
  const projects = (
    await Promise.all(
      summaries.map(async (summary) => {
        try {
          return await readProject(summary.id);
        } catch {
          return null;
        }
      })
    )
  ).filter((project): project is DmInstamapProject => project !== null);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Progetti</h1>
          <p>Mappe modificabili locali salvate in data/projects.</p>
        </div>
        <dl>
          <div>
            <dt>Progetti</dt>
            <dd>{projects.length}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href="/projects/new">Crea nuovo progetto</Link>
      </section>

      {projects.length === 0 ? (
        <section className="asset-empty">
          <h2>Nessun progetto</h2>
          <p>
            Crea la tua prima mappa locale: potrai modificarla nel canvas,
            salvarla ed esportarla per il tavolo.
          </p>
          <p>
            <Link href="/projects/new">Crea il primo progetto</Link>
          </p>
        </section>
      ) : (
        <section className="reference-grid">
          {projects.map((project) => {
            const readiness = computeProjectReadiness(project.document);

            return (
              <article className="reference-card" key={project.id}>
                <div className="reference-preview">
                  <ProjectThumbnail document={project.document} />
                </div>
                <div className="reference-card-body">
                  <div className="group-title-row">
                    <h2>{project.name}</h2>
                    <span>
                      {project.document.width} x {project.document.height}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Stanze</dt>
                      <dd>{project.document.plan?.rooms.length ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Stato</dt>
                      <dd>
                        {readiness.isSessionReady
                          ? "Pronto"
                          : `${readiness.requiredPassed}/${readiness.requiredTotal} requisiti`}
                      </dd>
                    </div>
                    <div>
                      <dt>Aggiornato</dt>
                      <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                  <div className="tag-list">
                    <Link href={`/projects/${project.id}`}>Apri</Link>
                    <Link href={`/projects/${project.id}/editor`}>Editor</Link>
                    <Link href={`/projects/${project.id}/session-ready`}>
                      Sessione
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
