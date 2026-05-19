import { createStarterProject } from "@/lib/starter-project";

export default function Home() {
  const project = createStarterProject();

  return (
    <main className="shell">
      <header className="status-bar">
        <div>
          <strong>DM-Instamap</strong>
          <h1>{project.name}</h1>
        </div>
        <span>{project.map.tiles.length} editable tiles</span>
      </header>

      <section className="workspace-grid" aria-label="Map workspace">
        <aside className="panel">
          <h2>MVP Modules</h2>
          <ul>
            {project.modules.map((module) => (
              <li key={module}>{module}</li>
            ))}
          </ul>
        </aside>

        <section className="panel">
          <h2>Editable Map Draft</h2>
          <div className="map-preview" aria-label="Starter dungeon preview">
            {project.map.tiles.map((tile) => (
              <span
                className={`tile tile-${tile.kind}`}
                key={`${tile.x}-${tile.y}`}
                title={`${tile.kind} tile ${tile.x},${tile.y}`}
              />
            ))}
          </div>
          <p>
            This placeholder editor surface proves the web app can consume shared
            map types and generator output before real editing tools arrive.
          </p>
        </section>
      </section>
    </main>
  );
}
