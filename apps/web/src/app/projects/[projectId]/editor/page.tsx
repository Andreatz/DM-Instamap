import { notFound } from "next/navigation";
import { MapEditor } from "@/components/editor/map-editor";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadAssetManifest } from "@/lib/assets-manifest";
import { createFallbackPalette, type EditorPaletteAsset } from "@/lib/map-editor";
import { ProjectNotFoundError, readProject } from "@/lib/projects";

type ProjectEditorPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ProjectEditorPage({ params }: ProjectEditorPageProps) {
  const { projectId } = await params;
  const [project, manifest, groups] = await Promise.all([
    loadProjectOrNotFound(projectId),
    loadAssetManifest(),
    loadAssetGroups()
  ]);
  const palette = createPalette(manifest.assets);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Editor - {project.name}</h1>
          <p>Modifica del progetto locale {project.id}.</p>
        </div>
      </header>

      <MapEditor
        assetGroups={groups.groups}
        initialDocument={project.document}
        mapTheme={project.sourceRequest ?? "project"}
        palette={palette}
        projectId={project.id}
      />
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

function createPalette(assets: Array<{
  classification: string;
  id: string;
  relativePath: string;
  thumbnailUrl: string;
}>): EditorPaletteAsset[] {
  const preferredKinds = new Set(["prop", "furniture", "light", "terrain", "decoration"]);
  const palette = assets
    .filter((asset) => preferredKinds.has(asset.classification))
    .slice(0, 16)
    .map((asset) => ({
      id: asset.id,
      kind: asset.classification,
      name: getFileName(asset.relativePath),
      thumbnailUrl: asset.thumbnailUrl
    }));

  return palette.length > 0 ? palette : createFallbackPalette();
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}
