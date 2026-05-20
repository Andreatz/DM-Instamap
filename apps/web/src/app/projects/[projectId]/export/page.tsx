import { notFound } from "next/navigation";
import { ProjectExportPanel } from "@/components/projects/project-export-panel";
import { ProjectNotFoundError, readProject } from "@/lib/projects";

type ProjectExportPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ProjectExportPage({ params }: ProjectExportPageProps) {
  const { projectId } = await params;
  const project = await loadProjectOrNotFound(projectId);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>{project.name} Export</h1>
          <p>Export the current saved MapDocument.</p>
        </div>
      </header>

      <ProjectExportPanel document={project.document} projectId={project.id} />
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
