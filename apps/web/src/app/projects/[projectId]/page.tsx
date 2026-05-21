import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectDescribeButton } from "@/components/projects/project-describe-button";
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
          <p>{project.sourceRequest ?? "Progetto locale modificabile."}</p>
        </div>
        <dl>
          <div>
            <dt>Griglia</dt>
            <dd>{project.document.width} x {project.document.height}</dd>
          </div>
          <div>
            <dt>Stanze</dt>
            <dd>{project.document.plan?.rooms.length ?? 0}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href={`/projects/${project.id}/editor`}>Apri editor</Link>
        <Link href={`/projects/${project.id}/export`}>Esporta</Link>
        <Link href="/projects">Tutti i progetti</Link>
      </section>

      <section className="asset-details">
        <h2>File del progetto</h2>
        <p>Salvati localmente in data/projects/{project.id}.</p>
        <dl>
          <div>
            <dt>Creato</dt>
            <dd>{new Date(project.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Aggiornato</dt>
            <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      {project.relatedProjectIds.length > 0 ? (
        <section className="asset-details">
          <h2>Piani collegati</h2>
          <p>Questo progetto è collegato a {project.relatedProjectIds.length} altro/i piano/i dello stesso dungeon.</p>
          <p>
            <Link href={`/projects/${project.id}/floors`}>Apri panoramica piani</Link>
          </p>
          <ul>
            {project.relatedProjectIds.map((relatedId) => (
              <li key={relatedId}>
                <Link href={`/projects/${relatedId}`}>{relatedId}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ProjectDescribeButton
        mapName={project.document.name || project.name}
        rooms={(project.document.plan?.rooms ?? []).map((room) => ({
          id: room.id,
          label: room.label,
          tags: room.tags
        }))}
        theme={project.sourceRequest}
      />

      <ProjectSnapshotsPanel projectId={project.id} />

      <section className="asset-details">
        <h2>Azioni progetto</h2>
        <p>L'eliminazione di un progetto rimuove la cartella locale da data/projects.</p>
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
