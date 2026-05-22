import type { MapDocument } from "@dm-instamap/core/server";
import type {
  ProjectExportFormat,
  ProjectExportMode
} from "./project-export-history";

export type ReadinessLevel = "required" | "recommended";

export type ReadinessCheck = {
  hint: string;
  id: string;
  label: string;
  level: ReadinessLevel;
  passed: boolean;
};

export type ProjectReadiness = {
  checks: ReadinessCheck[];
  isSessionReady: boolean;
  recommendedPassed: number;
  recommendedTotal: number;
  requiredPassed: number;
  requiredTotal: number;
  score: number;
};

export type RecommendedExport = {
  description: string;
  format: ProjectExportFormat;
  id: string;
  label: string;
  mode: ProjectExportMode;
};

/**
 * Map-ready exports a DM can fire in a single click from the project page.
 * Order matters: the first entry is the headline "ready for the table" action.
 */
export const RECOMMENDED_EXPORTS: RecommendedExport[] = [
  {
    description:
      "ZIP completo per il tavolo: mappa GM, mappa giocatori, note e iniziativa.",
    format: "session-pack",
    id: "session-pack-gm",
    label: "Session Pack",
    mode: "gm"
  },
  {
    description:
      "PNG sicuro per i giocatori, senza segreti, trappole o note GM.",
    format: "png",
    id: "player-png",
    label: "PNG giocatori",
    mode: "player"
  }
];

/**
 * Inspects a MapDocument and reports whether it is ready to bring to a session.
 * Pure and deterministic so it can drive both the UI checklist and tests.
 */
export function computeProjectReadiness(
  document: MapDocument
): ProjectReadiness {
  const tiles = document.tiles ?? [];
  const floorCount = tiles.filter((tile) => tile.kind === "floor").length;
  const wallTileCount = tiles.filter((tile) => tile.kind === "wall").length;
  const rooms = (document.plan?.rooms ?? []).filter(
    (room) => room.kind === "room" || room.kind === "entrance"
  );
  const hasEntrance = (document.plan?.rooms ?? []).some(
    (room) => room.kind === "entrance"
  );
  const labelledRooms = rooms.filter(
    (room) => room.label.trim().length > 0
  ).length;
  const wallSegments = document.plan?.walls.length ?? 0;
  const lights = document.plan?.lights.length ?? 0;
  const gmNotes = document.plan?.gmNotes.length ?? 0;
  const placedAssets = document.assets.length;

  const checks: ReadinessCheck[] = [
    {
      hint: "Usa lo strumento Pavimento nell'editor per disegnare le aree calpestabili.",
      id: "floor",
      label: "La mappa ha del pavimento disegnato",
      level: "required",
      passed: floorCount > 0
    },
    {
      hint: "Aggiungi muri con lo strumento Muro o lascia che il generatore racchiuda le stanze.",
      id: "walls",
      label: "Ci sono muri o contorni",
      level: "required",
      passed: wallTileCount > 0 || wallSegments > 0
    },
    {
      hint: "Genera o disegna almeno una stanza per dare struttura alla mappa.",
      id: "rooms",
      label: "Almeno una stanza e definita",
      level: "required",
      passed: rooms.length > 0
    },
    {
      hint: "Marca una stanza come ingresso cosi i giocatori sanno da dove entrare.",
      id: "entrance",
      label: "C'e un ingresso",
      level: "required",
      passed: hasEntrance
    },
    {
      hint: "Dai un nome a ogni stanza per ritrovarti durante la sessione.",
      id: "room-labels",
      label: "Tutte le stanze hanno un nome",
      level: "recommended",
      passed: rooms.length > 0 && labelledRooms === rooms.length
    },
    {
      hint: "Posiziona luci con lo strumento Luce per abilitare l'anteprima nebbia.",
      id: "lighting",
      label: "Illuminazione posizionata",
      level: "recommended",
      passed: lights > 0
    },
    {
      hint: "Trascina o arreda asset per dare carattere agli ambienti.",
      id: "assets",
      label: "Asset piazzati sulla mappa",
      level: "recommended",
      passed: placedAssets > 0
    },
    {
      hint: "Aggiungi note GM per ricordarti incontri, trappole e segreti.",
      id: "gm-notes",
      label: "Note GM presenti",
      level: "recommended",
      passed: gmNotes > 0
    }
  ];

  const required = checks.filter((check) => check.level === "required");
  const recommended = checks.filter((check) => check.level === "recommended");
  const requiredPassed = required.filter((check) => check.passed).length;
  const recommendedPassed = recommended.filter((check) => check.passed).length;
  const passedTotal = requiredPassed + recommendedPassed;

  return {
    checks,
    isSessionReady: requiredPassed === required.length,
    recommendedPassed,
    recommendedTotal: recommended.length,
    requiredPassed,
    requiredTotal: required.length,
    score: checks.length === 0 ? 0 : passedTotal / checks.length
  };
}
