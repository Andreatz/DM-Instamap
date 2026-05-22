import { NewProjectWizard } from "@/components/projects/new-project-wizard";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const [assetGroups, references] = await Promise.all([
    loadAssetGroups(),
    loadReferenceMaps()
  ]);

  return (
    <NewProjectWizard
      assetGroups={assetGroups.groups}
      references={references.references}
    />
  );
}
