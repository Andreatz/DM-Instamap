import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectQuickExport } from "@/components/projects/project-quick-export";
import { ProjectThumbnail } from "@/components/projects/project-thumbnail";
import {
  describeExportFormat,
  describeExportMode,
  readProjectExportHistory
} from "@/lib/project-export-history";
import { computeProjectReadiness } from "@/lib/project-readiness";
import { ProjectNotFoundError, readProject } from "@/lib/projects";

type SessionReadyPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SessionReadyPage({
  params
}: SessionReadyPageProps) {
  const { projectId } = await params;
  const project = await loadProjectOrNotFound(projectId);
  const readiness = computeProjectReadiness(project.document);
  const exportHistory = await readProjectExportHistory(project.id);
  const requiredChecks = readiness.checks.filter(
    (check) => check.level === "required"
  );
  const recommendedChecks = readiness.checks.filter(
    (check) => check.level === "recommended"
  );

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Pronto per la sessione - {project.name}</h1>
          <p>
            {readiness.isSessionReady
              ? "Requisiti soddisfatti: questa mappa e pronta per il tavolo."
              : "Completa i requisiti qui sotto per portare la mappa al tavolo."}
          </p>
        </div>
        <dl>
          <div>
            <dt>Requisiti</dt>
            <dd>
              {readiness.requiredPassed}/{readiness.requiredTotal}
            </dd>
          </div>
          <div>
            <dt>Consigliati</dt>
            <dd>
              {readiness.recommendedPassed}/{readiness.recommendedTotal}
            </dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href={`/projects/${project.id}`}>Pagina progetto</Link>
        <Link href={`/projects/${project.id}/editor`}>Apri editor</Link>
        <Link href={`/projects/${project.id}/export`}>Export avanzato</Link>
      </section>

      <section className="session-ready-grid">
        <div className="reference-preview session-ready-preview">
          <ProjectThumbnail document={project.document} />
        </div>

        <div
          className={`session-ready-banner ${readiness.isSessionReady ? "is-ready" : "is-blocked"}`}
          role="status"
        >
          <strong>
            {readiness.isSessionReady
              ? "Mappa pronta"
              : "Mancano alcuni requisiti"}
          </strong>
          <span className="muted">
            Punteggio preparazione: {Math.round(readiness.score * 100)}%
          </span>
        </div>
      </section>

      <section className="asset-details">
        <h2>Requisiti</h2>
        <ul className="readiness-checklist">
          {requiredChecks.map((check) => (
            <li
              className={check.passed ? "is-passed" : "is-failed"}
              key={check.id}
            >
              <span className="readiness-mark" aria-hidden="true">
                {check.passed ? "OK" : "--"}
              </span>
              <span className="readiness-body">
                <strong>{check.label}</strong>
                {check.passed ? null : (
                  <small className="muted">{check.hint}</small>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="asset-details">
        <h2>Consigliati</h2>
        <ul className="readiness-checklist">
          {recommendedChecks.map((check) => (
            <li
              className={check.passed ? "is-passed" : "is-optional"}
              key={check.id}
            >
              <span className="readiness-mark" aria-hidden="true">
                {check.passed ? "OK" : "~"}
              </span>
              <span className="readiness-body">
                <strong>{check.label}</strong>
                {check.passed ? null : (
                  <small className="muted">{check.hint}</small>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ProjectQuickExport projectId={project.id} projectName={project.name} />

      <section className="asset-details">
        <h2>Export recenti</h2>
        {exportHistory.length === 0 ? (
          <p className="muted">Nessun export registrato per questo progetto.</p>
        ) : (
          <ul className="export-history-list">
            {exportHistory.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                <span className="pill">
                  {describeExportFormat(entry.format)}
                </span>
                <span className="pill">{describeExportMode(entry.mode)}</span>
                <span className="muted">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <span>{entry.filename}</span>
              </li>
            ))}
          </ul>
        )}
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
