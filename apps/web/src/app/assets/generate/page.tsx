import Link from "next/link";
import { AssetGeneratorForm } from "@/components/assets/asset-generator-form";

export const dynamic = "force-dynamic";

export default function GenerateAssetPage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Genera asset da prompt</h1>
          <p>Invia un prompt a Replicate o a un server locale Automatic1111 e salva il risultato nella libreria asset.</p>
        </div>
      </header>

      <section className="group-toolbar">
        <Link href="/assets">Tutti gli asset</Link>
        <Link href="/assets/import-pack">Importa pacchetto</Link>
      </section>

      <AssetGeneratorForm />
    </main>
  );
}
