import Link from "next/link";
import { AssetGeneratorForm } from "@/components/assets/asset-generator-form";

export const dynamic = "force-dynamic";

export default function GenerateAssetPage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Generate Asset from Prompt</h1>
          <p>Send a prompt to Replicate or a local Automatic1111 server and save the result to the asset library.</p>
        </div>
      </header>

      <section className="group-toolbar">
        <Link href="/assets">All Assets</Link>
        <Link href="/assets/import-pack">Import Pack</Link>
      </section>

      <AssetGeneratorForm />
    </main>
  );
}
