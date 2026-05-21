import { AiAutoWorkspace } from "@/components/ai-bridge/ai-auto-workspace";
import { AiBridgeWorkspace } from "@/components/ai-bridge/ai-bridge-workspace";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function AiBridgePage() {
  const [assetGroups, references] = await Promise.all([loadAssetGroups(), loadReferenceMaps()]);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>AI Bridge</h1>
          <p>La modalita automatica parla con un provider configurato; quella manuale mantiene il flusso copia/incolla con ChatGPT.</p>
        </div>
        <dl>
          <div>
            <dt>Gruppi asset</dt>
            <dd>{assetGroups.groupCount}</dd>
          </div>
          <div>
            <dt>Riferimenti</dt>
            <dd>{references.references.length}</dd>
          </div>
        </dl>
      </header>

      <AiAutoWorkspace assetGroups={assetGroups.groups} references={references.references} />

      <AiBridgeWorkspace assetGroups={assetGroups.groups} references={references.references} />
    </main>
  );
}
