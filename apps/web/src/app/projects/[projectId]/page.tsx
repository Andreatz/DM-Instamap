import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectDescribeButton } from "@/components/projects/project-describe-button";
import { ProjectQuickExport } from "@/components/projects/project-quick-export";
import { ProjectSnapshotsPanel } from "@/components/projects/project-snapshots-panel";
import { ProjectThumbnail } from "@/components/projects/project-thumbnail";
import { describeExportFormat, describeExportMode, readProjectExportHistory } from "@/lib/project-export-history";
import { computeProjectReadiness } from "@/lib/project-readiness";
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
  const readiness = computeProjectReadiness(project.document);
  const exportHistory = await readProjectExportHistory(project.id);

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
        <Link href={`/projects/${project.id}/session-ready`}>Pronto per la sessione</Link>
        <Link href={`/projects/${project.id}/export`}>Esporta</Link>
        <Link href="/projects">Tutti i progetti</Link>
      </section>

      <section className="project-overview">
        <div className="reference-preview project-overview-preview">
          <ProjectThumbnail document={project.document} />
        </div>
        <div className={`session-ready-banner ${readiness.isSessionReady ? "is-ready" : "is-blocked"}`} role="status">
          <strong>{readiness.isSessionReady ? "Pronto per la sessione" : "Da completare prima della sessione"}</strong>
          <span className="muted">
            Requisiti {readiness.requiredPassed}/{readiness.requiredTotal} - preparazione {Math.round(readiness.score * 100)}%
          </span>
          <Link href={`/projects/${project.id}/session-ready`}>Apri la checklist</Link>
        </div>
      </section>

      <ProjectQuickExport projectId={project.id} projectName={project.name} />

      <section className="asset-details">
        <h2>Export recenti</h2>
        {exportHistory.length === 0 ? (
          <p className="muted">Nessun export registrato. Usa "Esporta per la sessione" qui sopra.</p>
        ) : (
          <ul className="export-history-list">
            {exportHistory.slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <span className="pill">{describeExportFormat(entry.format)}</span>
                <span className="pill">{describeExportMode(entry.mode)}</span>
                <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                <span>{entry.filename}</span>
              </li>
            ))}
          </ul>
        )}
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
          <p>Questo progetto e collegato a {project.relatedProjectIds.length} altro/i piano/i dello stesso dungeon.</p>
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
