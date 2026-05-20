import Link from "next/link";
import { PackImporterForm } from "@/components/assets/pack-importer-form";

export const dynamic = "force-dynamic";

export default function ImportPackPage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Import Asset Pack</h1>
          <p>
            Apply preset-specific auto-tagging on top of the standard scanner. Works on Forgotten Adventures, 2-Minute
            Tabletop, Czepeku layouts, or as a generic fallback.
          </p>
        </div>
      </header>

      <section className="group-toolbar">
        <Link href="/assets">All Assets</Link>
        <Link href="/asset-groups">Asset Groups</Link>
      </section>

      <PackImporterForm />
    </main>
  );
}
