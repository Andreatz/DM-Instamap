import Link from "next/link";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

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
          <p>Crea un progetto locale per salvare, riaprire, modificare ed esportare un MapDocument.</p>
        </section>
      ) : (
        <section className="reference-grid">
          {projects.map((project) => (
            <article className="reference-card" key={project.id}>
              <div className="reference-card-body">
                <div className="group-title-row">
                  <h2>{project.name}</h2>
                  <span>{project.size.width} x {project.size.height}</span>
                </div>
                <dl>
                  <div>
                    <dt>Stanze</dt>
                    <dd>{project.roomCount}</dd>
                  </div>
                  <div>
                    <dt>Aggiornato</dt>
                    <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
                <div className="tag-list">
                  <Link href={`/projects/${project.id}`}>Apri</Link>
                  <Link href={`/projects/${project.id}/editor`}>Editor</Link>
                  <Link href={`/projects/${project.id}/export`}>Esporta</Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
