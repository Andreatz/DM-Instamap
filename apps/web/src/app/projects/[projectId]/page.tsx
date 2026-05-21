import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectSnapshotsPanel } from "@/components/projects/project-snapshots-panel";
import { ProjectNotFoundError, readProject } from "@/lib/projects";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const project = await loadProjectOrNotFound(projectId);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>{project.name}</h1>
          <p>{project.sourceRequest ?? "Local editable project."}</p>
        </div>
        <dl>
          <div>
            <dt>Grid</dt>
            <dd>{project.document.width} x {project.document.height}</dd>
          </div>
          <div>
            <dt>Rooms</dt>
            <dd>{project.document.plan?.rooms.length ?? 0}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href={`/projects/${project.id}/editor`}>Open Editor</Link>
        <Link href={`/projects/${project.id}/export`}>Export</Link>
        <Link href="/projects">All Projects</Link>
      </section>

      <section className="asset-details">
        <h2>Project Files</h2>
        <p>Stored locally under data/projects/{project.id}.</p>
        <dl>
          <div>
            <dt>Created</dt>
            <dd>{new Date(project.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      {project.relatedProjectIds.length > 0 ? (
        <section className="asset-details">
          <h2>Linked Floors</h2>
          <p>This project is linked with {project.relatedProjectIds.length} other floor(s) from the same dungeon.</p>
          <ul>
            {project.relatedProjectIds.map((relatedId) => (
              <li key={relatedId}>
                <Link href={`/projects/${relatedId}`}>{relatedId}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ProjectSnapshotsPanel projectId={project.id} />

      <section className="asset-details">
        <h2>Project Actions</h2>
        <p>Deleting a project removes its local folder from data/projects.</p>
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </section>
    </main>
  );
}

async function loadProjectOrNotFound(projectId: string) {
  try {
    return await readProject(projectId);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      notFound();
    }

    throw error;
  }
}
