import Link from "next/link";
import { PackImporterForm } from "@/components/assets/pack-importer-form";

export const dynamic = "force-dynamic";

export default function ImportPackPage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Importa pacchetto di asset</h1>
          <p>
            Applica tag automatici specifici del preset sopra lo scanner
            standard. Funziona con Forgotten Adventures, 2-Minute Tabletop,
            layout Czepeku o come fallback generico.
          </p>
        </div>
      </header>

      <section className="group-toolbar">
        <Link href="/assets">Tutti gli asset</Link>
        <Link href="/asset-groups">Gruppi di asset</Link>
      </section>

      <PackImporterForm />
    </main>
  );
}
