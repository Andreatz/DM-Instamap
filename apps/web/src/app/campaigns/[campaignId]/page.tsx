import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { CampaignNotFoundError, readCampaign } from "@/lib/campaigns";
import { listProjects, readProject } from "@/lib/projects";

type CampaignPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { campaignId } = await params;
  const campaign = await loadCampaignOrNotFound(campaignId);
  const projectSummaries = await listProjects();
  const projectOptions = await Promise.all(
    projectSummaries.map(async (summary) => {
      try {
        const project = await readProject(summary.id);
        return {
          documentId: project.document.id,
          id: project.id,
          name: project.name
        };
      } catch {
        return null;
      }
    })
  );
  const cleanOptions = projectOptions.filter((option): option is { documentId: string; id: string; name: string } => option !== null);

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>{campaign.name}</h1>
          <p>{campaign.description ?? "Local campaign dashboard."}</p>
        </div>
        <dl>
          <div>
            <dt>Maps</dt>
            <dd>{campaign.maps.length}</dd>
          </div>
          <div>
            <dt>Sessions</dt>
            <dd>{campaign.sessions.length}</dd>
          </div>
        </dl>
      </header>

      <section className="group-toolbar">
        <Link href="/campaigns">All Campaigns</Link>
        <Link href="/projects">All Projects</Link>
      </section>

      <CampaignEditor campaign={campaign} projectOptions={cleanOptions} />
    </main>
  );
}

async function loadCampaignOrNotFound(campaignId: string) {
  try {
    return await readCampaign(campaignId);
  } catch (error) {
    if (error instanceof CampaignNotFoundError) {
      notFound();
    }

    throw error;
  }
}
