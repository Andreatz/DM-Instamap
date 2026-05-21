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
            <h1>{project.name} - Piani</h1>
            <p>Questo progetto non e collegato ad altri piani.</p>
          </div>
        </header>
        <section className="group-toolbar">
          <Link href={`/projects/${project.id}`}>Torna al progetto</Link>
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
          <h1>{project.name} - Piani</h1>
          <p>
            Dungeon multipiano con {floors.length} progetti collegati. Ogni scheda apre il progetto corrispondente;
            usali durante la sessione per saltare tra i piani.
          </p>
        </div>
        <dl>
          <div>
            <dt>Piani</dt>
            <dd>{floors.length}</dd>
          </div>
          <div>
            <dt>Stanze totali</dt>
            <dd>{floors.reduce((sum, floor) => sum + (floor.document.plan?.rooms.length ?? 0), 0)}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href={`/projects/${project.id}`}>Torna al progetto</Link>
      </section>

      <section className="reference-grid">
        {floors.map((floor, index) => (
          <article className="reference-card" key={floor.id}>
            <div className="reference-card-body">
              <div className="group-title-row">
                <h2>Piano {index + 1}</h2>
                <span>
                  {floor.document.width} x {floor.document.height}
                </span>
              </div>
              <p className="muted">{floor.name}</p>
              <dl>
                <div>
                  <dt>Stanze</dt>
                  <dd>{floor.document.plan?.rooms.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Porte</dt>
                  <dd>{floor.document.plan?.doors.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Luci</dt>
                  <dd>{floor.document.plan?.lights.length ?? 0}</dd>
                </div>
              </dl>
              <FloorMinimap floor={floor} />
              <div className="tag-list">
                <Link href={`/projects/${floor.id}`}>Apri</Link>
                <Link href={`/projects/${floor.id}/editor`}>Editor</Link>
                <Link href={`/projects/${floor.id}/export`}>Esporta</Link>
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
    <div className="manifest-note" aria-label="Statistiche minimap piano">
      <span className="pill">griglia {width}x{height}</span>
      <span className="pill">pavimento {floorRatio}%</span>
      <span className="pill">muri {wallRatio}%</span>
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
