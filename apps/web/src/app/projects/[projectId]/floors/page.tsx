import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ProjectNotFoundError,
  readProject,
  type DmInstamapProject
} from "@/lib/projects";

type FloorsPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ProjectFloorsPage({ params }: FloorsPageProps) {
  const { projectId } = await params;
  const project = await loadProjectOrNotFound(projectId);

  if (project.relatedProjectIds.length === 0) {
    return (
      <main className="asset-page">
        <header className="asset-hero">
          <div>
            <strong>DM-Instamap</strong>
            <h1>{project.name} — Floors</h1>
            <p>This project is not linked to any other floors.</p>
          </div>
        </header>
        <section className="group-toolbar">
          <Link href={`/projects/${project.id}`}>Back to project</Link>
        </section>
      </main>
    );
  }

  const linkedProjects = await Promise.all(
    project.relatedProjectIds.map(async (id) => {
      try {
        return await readProject(id);
      } catch {
        return null;
      }
    })
  );
  const floors = [project, ...linkedProjects.filter((entry): entry is DmInstamapProject => entry !== null)].sort(
    (left, right) => floorIndex(left) - floorIndex(right)
  );

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>{project.name} — Floors</h1>
          <p>
            Multi-floor dungeon with {floors.length} linked projects. Each tab below opens the matching project; use it
            during a session to jump between floors.
          </p>
        </div>
        <dl>
          <div>
            <dt>Floors</dt>
            <dd>{floors.length}</dd>
          </div>
          <div>
            <dt>Total rooms</dt>
            <dd>{floors.reduce((sum, floor) => sum + (floor.document.plan?.rooms.length ?? 0), 0)}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href={`/projects/${project.id}`}>Back to project</Link>
      </section>

      <section className="reference-grid">
        {floors.map((floor, index) => (
          <article className="reference-card" key={floor.id}>
            <div className="reference-card-body">
              <div className="group-title-row">
                <h2>Floor {index + 1}</h2>
                <span>
                  {floor.document.width} x {floor.document.height}
                </span>
              </div>
              <p className="muted">{floor.name}</p>
              <dl>
                <div>
                  <dt>Rooms</dt>
                  <dd>{floor.document.plan?.rooms.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Doors</dt>
                  <dd>{floor.document.plan?.doors.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Lights</dt>
                  <dd>{floor.document.plan?.lights.length ?? 0}</dd>
                </div>
              </dl>
              <FloorMinimap floor={floor} />
              <div className="tag-list">
                <Link href={`/projects/${floor.id}`}>Open</Link>
                <Link href={`/projects/${floor.id}/editor`}>Editor</Link>
                <Link href={`/projects/${floor.id}/export`}>Export</Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function FloorMinimap({ floor }: { floor: DmInstamapProject }) {
  const tiles = floor.document.tiles;
  const width = floor.document.width;
  const height = floor.document.height;
  const totalCells = Math.max(1, width * height);
  const floorCount = tiles.filter((tile) => tile.kind === "floor").length;
  const wallCount = tiles.filter((tile) => tile.kind === "wall").length;
  const floorRatio = Math.round((floorCount / totalCells) * 100);
  const wallRatio = Math.round((wallCount / totalCells) * 100);

  return (
    <div className="manifest-note" aria-label="Floor minimap stats">
      <span className="pill">grid {width}×{height}</span>
      <span className="pill">floor {floorRatio}%</span>
      <span className="pill">wall {wallRatio}%</span>
    </div>
  );
}

function floorIndex(project: DmInstamapProject): number {
  const match = project.id.match(/-floor-(\d+)$/u);
  if (!match || !match[1]) {
    return 0;
  }
  return Number.parseInt(match[1], 10);
}

async function loadProjectOrNotFound(projectId: string): Promise<DmInstamapProject> {
  try {
    return await readProject(projectId);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      notFound();
    }
    throw error;
  }
}
