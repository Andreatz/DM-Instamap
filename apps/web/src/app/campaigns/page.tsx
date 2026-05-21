import Link from "next/link";
import { NewCampaignForm } from "@/components/campaigns/new-campaign-form";
import { listCampaigns } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Campagne</h1>
          <p>Raggruppa mappe locali e registra sessioni per campagna. Salvate in data/campaigns.</p>
        </div>
      </header>

      <section className="group-toolbar">
        <Link href="/projects">Tutti i progetti</Link>
        <Link href="/">Home</Link>
      </section>

      <section className="asset-details">
        <h2>Campagne esistenti</h2>
        {campaigns.length === 0 ? <p className="muted">Nessuna campagna.</p> : null}
        {campaigns.length > 0 ? (
          <ul className="campaign-list">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link href={`/campaigns/${campaign.id}`}>
                  <strong>{campaign.name}</strong>
                  <span className="muted">
                    {" "}
                    - {campaign.maps.length} mappe, {campaign.sessions.length} sessioni
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <NewCampaignForm />
    </main>
  );
}
