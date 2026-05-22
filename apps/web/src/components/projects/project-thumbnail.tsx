import type { MapDocument } from "@dm-instamap/core/server";
import { buildProjectThumbnailSvg } from "@/lib/project-thumbnail";

type ProjectThumbnailProps = {
  cell?: number;
  document: MapDocument;
};

/**
 * Renders a deterministic inline SVG mini-map for a project. The SVG is built
 * from trusted document geometry only (no user text), so inlining it is safe.
 */
export function ProjectThumbnail({ cell, document }: ProjectThumbnailProps) {
  const svg = buildProjectThumbnailSvg(document, { cell });

  return (
    <div
      className="project-thumb"
      aria-hidden="false"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG deterministico generato da geometria fidata del documento, nessun input utente
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
