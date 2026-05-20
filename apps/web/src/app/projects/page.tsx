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
          <h1>Projects</h1>
          <p>Local editable maps stored in data/projects.</p>
        </div>
        <dl>
          <div>
            <dt>Projects</dt>
            <dd>{projects.length}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href="/projects/new">Create New Project</Link>
      </section>

      {projects.length === 0 ? (
        <section className="asset-empty">
          <h2>No Projects Yet</h2>
          <p>Create a local project to save, reopen, edit, and export a MapDocument.</p>
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
                    <dt>Rooms</dt>
                    <dd>{project.roomCount}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
                <div className="tag-list">
                  <Link href={`/projects/${project.id}`}>Open</Link>
                  <Link href={`/projects/${project.id}/editor`}>Editor</Link>
                  <Link href={`/projects/${project.id}/export`}>Export</Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
