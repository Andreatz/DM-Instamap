import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [projects, assetGroups, references] = await Promise.all([
    listProjects(),
    loadAssetGroups(),
    loadReferenceMaps()
  ]);
  const recentProjects = projects.slice(0, 4);

  return (
    <main className="home-shell">
      <section className="home-hero">
        <strong>DM-Instamap</strong>
        <h1>Plan your next session, locally.</h1>
        <p>
          Build editable D&amp;D maps from your own asset library, with reference style DNA, narrative blueprints,
          auto-furnish, and player-safe exports. No cloud, no login, no API required.
        </p>
        <div className="home-status">
          <span className="pill">{assetGroups.groupCount} asset groups</span>
          <span className="pill">{references.references.length} reference maps</span>
          <span className="pill">{projects.length} saved projects</span>
        </div>
        <div className="home-actions">
          <Link href="/projects/new">Start a New Map</Link>
          <Link className="secondary" href="/ai-bridge">
            Use ChatGPT Bridge
          </Link>
          <Link className="secondary" href="/projects">
            Open Projects
          </Link>
        </div>
      </section>

      <section className="home-grid">
        <section className="home-card">
          <h2>Recent Projects</h2>
          {recentProjects.length === 0 ? (
            <p className="muted">No saved projects yet. The wizard creates one for you.</p>
          ) : (
            <ul>
              {recentProjects.map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`}>
                    {project.name} <span className="muted">- {project.size.width}x{project.size.height}, {project.roomCount} rooms</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-card">
          <h2>Asset Library</h2>
          <p className="muted">{assetGroups.groupCount} groups indexed from local folders.</p>
          <ul>
            <li>
              <Link href="/assets">Browse Asset Library</Link>
            </li>
            <li>
              <Link href="/asset-groups">Browse Asset Groups</Link>
            </li>
            <li>
              <Link href="/assets/review">Asset Review Queue</Link>
            </li>
            <li>
              <Link href="/assets/review/batches">Batch Review (Critical / High / Duplicates)</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>References</h2>
          <p className="muted">{references.references.length} reference maps available.</p>
          <ul>
            <li>
              <Link href="/references">View Reference Maps</Link>
            </li>
            <li>
              <Link href="/references/review">Reference Review</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>Workflows</h2>
          <ul>
            <li>
              <Link href="/projects/new">Wizard: Create New Map</Link>
            </li>
            <li>
              <Link href="/generate">Quick Generator Preview</Link>
            </li>
            <li>
              <Link href="/ai-bridge">Manual ChatGPT Bridge</Link>
            </li>
          </ul>
        </section>

        <section className="home-card">
          <h2>How It Works</h2>
          <ol>
            <li>Index local assets and references.</li>
            <li>Generate a blueprint or paste a ChatGPT plan.</li>
            <li>Edit the map in the canvas.</li>
            <li>Auto-furnish and review.</li>
            <li>Export Player or GM map.</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
