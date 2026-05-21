import { DungeonGeneratorPreview } from "@/components/generate/dungeon-generator-preview";

export default function GeneratePage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Genera dungeon</h1>
          <p>Stanze rettangolari, corridoi, porte e muri procedurali.</p>
        </div>
      </header>

      <DungeonGeneratorPreview />
    </main>
  );
}
