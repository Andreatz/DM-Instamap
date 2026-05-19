import { DungeonGeneratorPreview } from "@/components/generate/dungeon-generator-preview";

export default function GeneratePage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Generate Dungeon</h1>
          <p>Procedural rectangular rooms, corridors, doors, and walls.</p>
        </div>
      </header>

      <DungeonGeneratorPreview />
    </main>
  );
}
