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
          <h1>Manual ChatGPT Bridge</h1>
          <p>Build compact prompts from local context, then validate pasted JSON locally.</p>
        </div>
        <dl>
          <div>
            <dt>Asset Groups</dt>
            <dd>{assetGroups.groupCount}</dd>
          </div>
          <div>
            <dt>References</dt>
            <dd>{references.references.length}</dd>
          </div>
        </dl>
      </header>

      <AiBridgeWorkspace assetGroups={assetGroups.groups} references={references.references} />
    </main>
  );
}
