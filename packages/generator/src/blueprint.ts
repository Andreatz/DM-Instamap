import type { MapDocument } from "@dm-instamap/core";
import { generateDungeon } from "./index";

export type TacticalRole =
  | "entrance"
  | "social"
  | "combat"
  | "puzzle"
  | "treasure"
  | "hazard"
  | "boss"
  | "transition"
  | "secret"
  | "safe";

export type NarrativeRoom = {
  id: string;
  label: string;
  minSize: {
    height: number;
    width: number;
  };
  preferredShape: "rectangular" | "long" | "wide" | "square" | "organic";
  purpose: string;
  suggestedAssets: string[];
  suggestedLights: string[];
  suggestedNotes: string[];
  tacticalRole: TacticalRole;
  tags: string[];
};

export type MapGenerationBlueprint = {
  connections: Array<{
    from: string;
    to: string;
    type: "open" | "door" | "locked" | "secret" | "stairs";
  }>;
  globalTags: string[];
  gmNotes: string[];
  id: string;
  mapKind: "dungeon" | "building" | "city" | "cave" | "ship";
  name: string;
  rooms: NarrativeRoom[];
  theme: string;
};

export type NarrativeGenerationInput = {
  heightCells?: number;
  request: string;
  roomCount?: number;
  theme?: string;
  widthCells?: number;
};

export function createNarrativeBlueprint(input: NarrativeGenerationInput): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const theme = input.theme?.trim() || inferTheme(request);

  if (theme === "crypt" || /crypt|cripta|cathedral|cattedrale|undead|morti|tomb|tomba|reliquary|reliquiario|chapel|cappella/u.test(request)) {
    return generateCryptBlueprint(input);
  }

  if (/building|manor|house|keep|tower|inn|temple/u.test(request)) {
    return generateBuildingBlueprint(input);
  }

  return generateDungeonBlueprint(input);
}

export function generateMapFromBlueprint(
  blueprint: MapGenerationBlueprint,
  options: {
    heightCells?: number;
    widthCells?: number;
  } = {}
): MapDocument {
  const requiredRooms = blueprint.rooms
    .filter((room) => room.tacticalRole !== "entrance")
    .map((room) => room.label);
  const map = generateDungeon({
    heightCells: options.heightCells ?? 44,
    requiredRooms: requiredRooms.map((room) => (isBossRoom(room, blueprint) ? "boss" : room)),
    roomCount: Math.max(blueprint.rooms.length, 3),
    theme: blueprint.theme,
    widthCells: options.widthCells ?? 64
  });
  const roomBlueprints = blueprint.rooms.filter((room) => room.tacticalRole !== "transition");
  const updatedRooms =
    map.plan?.rooms.map((room, index) => {
      if (room.kind === "corridor") {
        return {
          ...room,
          tags: unique([...room.tags, "transition", blueprint.theme])
        };
      }

      const narrativeRoom =
        room.id === "room-entrance"
          ? blueprint.rooms.find((candidate) => candidate.tacticalRole === "entrance")
          : room.id === "room-final"
            ? blueprint.rooms.find((candidate) => candidate.tacticalRole === "boss")
            : roomBlueprints[index] ?? roomBlueprints[index - 1];

      if (!narrativeRoom) {
        return room;
      }

      return {
        ...room,
        id: room.id,
        label: narrativeRoom.label,
        tags: unique([
          ...room.tags,
          ...narrativeRoom.tags,
          `role-${narrativeRoom.tacticalRole}`,
          `blueprint-${narrativeRoom.id}`
        ])
      };
    }) ?? [];
  const notes = [
    `Blueprint: ${blueprint.name}`,
    ...blueprint.gmNotes,
    ...blueprint.rooms.flatMap((room) => room.suggestedNotes.map((note) => `${room.label}: ${note}`))
  ];

  return {
    ...map,
    id: blueprint.id,
    name: blueprint.name,
    plan: map.plan
      ? {
          ...map.plan,
          id: `${blueprint.id}-plan`,
          name: `${blueprint.name} Plan`,
          notes,
          requestId: blueprint.id,
          rooms: updatedRooms
        }
      : undefined
  };
}

export function generateCryptBlueprint(input: NarrativeGenerationInput): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const nonHostileUndead = /non hostile|non-hostile|not hostile|prisoner|prigion|bound|chained|incaten|prigionieri/u.test(request);
  const cathedral = /cathedral|cattedrale|chapel|sacristy|temple|chiesa/u.test(request);
  const rooms: NarrativeRoom[] = [
    createRoom({
      id: "entrance-from-cathedral",
      label: cathedral ? "Entrance from Cathedral Sacristy" : "Crypt Entrance",
      purpose: "A threshold from the world above into the buried complex.",
      role: "entrance",
      tags: ["entrance", "crypt", cathedral ? "cathedral" : "stairs", "threshold"],
      assets: ["stairs", "stone arch", "dust", "holy symbol"],
      lights: ["cold daylight", "torch"],
      notes: ["This room should orient players and clearly show the exit route."],
      shape: "wide"
    }),
    createRoom({
      id: "hall-of-bound-spirits",
      label: nonHostileUndead ? "Hall of Bound Spirits" : "Hall of Restless Dead",
      purpose: nonHostileUndead
        ? "A social encounter where undead are trapped rather than hostile."
        : "A tense encounter chamber for restless crypt guardians.",
      role: nonHostileUndead ? "social" : "combat",
      tags: ["crypt", "undead", nonHostileUndead ? "non-hostile" : "hostile", "bound", "social"],
      assets: ["chains", "memorial plaques", "spirit wisps", "broken seals"],
      lights: ["blue ghost light", "dim ambient"],
      notes: [
        nonHostileUndead
          ? "Undead want release from the binding ritual, not a fight."
          : "Guardians challenge intruders before the deeper tombs."
      ],
      shape: "rectangular"
    }),
    createRoom({
      id: "reliquary-of-broken-vows",
      label: "Reliquary of Broken Vows",
      purpose: "A puzzle room around reliquaries, vows, and old sacred failures.",
      role: "puzzle",
      tags: ["crypt", "reliquary", "puzzle", "sacred", "cathedral"],
      assets: ["reliquary", "altar", "candles", "inscriptions"],
      lights: ["warm candlelight", "holy glow"],
      notes: ["Solving the reliquary puzzle can weaken the final seal."],
      shape: "square"
    }),
    createRoom({
      id: "sealed-prison-tomb",
      label: "Sealed Prison Tomb",
      purpose: "A hazard chamber showing that the dead were imprisoned below the cathedral.",
      role: "hazard",
      tags: ["crypt", "prison", "tomb", "chains", "sealed", "undead"],
      assets: ["coffins", "chains", "bars", "seal circle"],
      lights: ["faint glyph light"],
      notes: ["The room should communicate containment more than evil."],
      shape: "long"
    }),
    createRoom({
      id: "ossuary-crossing",
      label: "Ossuary Crossing",
      purpose: "A transition chamber with cover, bones, and branching choices.",
      role: "transition",
      tags: ["crypt", "ossuary", "bones", "transition"],
      assets: ["bone piles", "alcoves", "urns"],
      lights: ["torch", "dim ambient"],
      notes: ["Good place for tactical cover without making it a boss room."],
      shape: "wide"
    }),
    createRoom({
      id: "final-ritual-chamber",
      label: "Final Ritual Chamber",
      purpose: "The source of the binding ritual and the final decision point.",
      role: "boss",
      tags: ["crypt", "boss", "ritual", "final", "seal", "undead"],
      assets: ["ritual circle", "sarcophagus", "broken altar", "chains"],
      lights: ["magic circle", "cold fire"],
      notes: [
        nonHostileUndead
          ? "The final conflict can be social, puzzle, or against the binding magic itself."
          : "The final chamber supports a conventional boss encounter."
      ],
      shape: "rectangular"
    })
  ];

  return {
    connections: [
      { from: "entrance-from-cathedral", to: "hall-of-bound-spirits", type: "door" },
      { from: "hall-of-bound-spirits", to: "reliquary-of-broken-vows", type: "door" },
      { from: "reliquary-of-broken-vows", to: "sealed-prison-tomb", type: "locked" },
      { from: "sealed-prison-tomb", to: "ossuary-crossing", type: "door" },
      { from: "ossuary-crossing", to: "final-ritual-chamber", type: "door" }
    ],
    globalTags: unique([
      "crypt",
      "stone",
      "undead",
      ...(cathedral ? ["cathedral", "sacred"] : []),
      ...(nonHostileUndead ? ["non-hostile", "prisoners", "bound"] : [])
    ]),
    gmNotes: [
      "Use sacred architecture and containment imagery rather than generic evil tomb dressing.",
      nonHostileUndead
        ? "The undead are prisoners; clues should make negotiation and release viable."
        : "The dead may be dangerous, but the map still supports investigation before combat."
    ],
    id: "blueprint-crypt-cathedral",
    mapKind: "dungeon",
    name: cathedral ? "Crypt Beneath the Cathedral" : "Narrative Crypt",
    rooms,
    theme: "crypt"
  };
}

export function generateBuildingBlueprint(input: NarrativeGenerationInput): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const theme = input.theme?.trim() || "building";
  const rooms = [
    createRoom({
      id: "front-entry",
      label: "Front Entry",
      purpose: "A clear arrival room with routes into the structure.",
      role: "entrance",
      tags: [theme, "entrance"],
      assets: ["door", "rug", "signage"],
      lights: ["lantern"],
      notes: ["Establish ownership, security, and mood immediately."],
      shape: "wide"
    }),
    createRoom({
      id: "main-hall",
      label: "Main Hall",
      purpose: "The primary social or navigation space.",
      role: request.includes("combat") ? "combat" : "social",
      tags: [theme, "hall", "social"],
      assets: ["table", "chairs", "banner"],
      lights: ["chandelier", "lantern"],
      notes: ["This room should connect most other rooms."],
      shape: "rectangular"
    }),
    createRoom({
      id: "private-chamber",
      label: "Private Chamber",
      purpose: "A quieter room for clues, treasure, or roleplay.",
      role: "treasure",
      tags: [theme, "private", "clue"],
      assets: ["desk", "bed", "chest"],
      lights: ["candle"],
      notes: ["Place documents or clues here."],
      shape: "square"
    }),
    createRoom({
      id: "service-passage",
      label: "Service Passage",
      purpose: "A secondary route through the building.",
      role: "transition",
      tags: [theme, "service", "transition"],
      assets: ["crates", "shelves"],
      lights: ["dim lantern"],
      notes: ["Good place for stealth and alternate routing."],
      shape: "long"
    })
  ];

  return {
    connections: [
      { from: "front-entry", to: "main-hall", type: "door" },
      { from: "main-hall", to: "private-chamber", type: "door" },
      { from: "main-hall", to: "service-passage", type: "door" }
    ],
    globalTags: [theme, "interior", "building"],
    gmNotes: ["Building maps should prioritize readable circulation and practical room adjacency."],
    id: `blueprint-${theme}`,
    mapKind: "building",
    name: `${toTitle(theme)} Interior`,
    rooms,
    theme
  };
}

export function generateDungeonBlueprint(input: NarrativeGenerationInput): MapGenerationBlueprint {
  const theme = input.theme?.trim() || inferTheme(normalizeText(input.request));
  const rooms = [
    createRoom({
      id: "entrance",
      label: "Dungeon Entrance",
      purpose: "Entry point with clear tactical approach.",
      role: "entrance",
      tags: [theme, "entrance"],
      assets: ["door", "stairs", "debris"],
      lights: ["torch"],
      notes: ["Give the party a readable first decision."],
      shape: "wide"
    }),
    createRoom({
      id: "guard-room",
      label: "Guard Room",
      purpose: "Early combat or negotiation checkpoint.",
      role: "combat",
      tags: [theme, "guard", "combat"],
      assets: ["table", "weapons", "barricade"],
      lights: ["torch"],
      notes: ["Add cover and at least two approaches."],
      shape: "rectangular"
    }),
    createRoom({
      id: "challenge-room",
      label: "Challenge Room",
      purpose: "Puzzle, hazard, or environmental obstacle.",
      role: "puzzle",
      tags: [theme, "challenge", "puzzle"],
      assets: ["runes", "statue", "mechanism"],
      lights: ["magic glow"],
      notes: ["Make the challenge legible from map dressing."],
      shape: "square"
    }),
    createRoom({
      id: "final-room",
      label: "Final Room",
      purpose: "Final encounter chamber.",
      role: "boss",
      tags: [theme, "boss", "final"],
      assets: ["throne", "altar", "treasure"],
      lights: ["dramatic light"],
      notes: ["Use space for movement, minions, and a focal object."],
      shape: "rectangular"
    })
  ];

  return {
    connections: [
      { from: "entrance", to: "guard-room", type: "door" },
      { from: "guard-room", to: "challenge-room", type: "door" },
      { from: "challenge-room", to: "final-room", type: "door" }
    ],
    globalTags: [theme, "dungeon"],
    gmNotes: ["Generic narrative dungeon generated from local heuristics only."],
    id: `blueprint-${theme}-dungeon`,
    mapKind: "dungeon",
    name: `${toTitle(theme)} Narrative Dungeon`,
    rooms,
    theme
  };
}

function createRoom(input: {
  assets: string[];
  id: string;
  label: string;
  lights: string[];
  notes: string[];
  purpose: string;
  role: TacticalRole;
  shape: NarrativeRoom["preferredShape"];
  tags: string[];
}): NarrativeRoom {
  return {
    id: input.id,
    label: input.label,
    minSize: inferMinSize(input.shape),
    preferredShape: input.shape,
    purpose: input.purpose,
    suggestedAssets: input.assets,
    suggestedLights: input.lights,
    suggestedNotes: input.notes,
    tacticalRole: input.role,
    tags: unique(input.tags)
  };
}

function inferMinSize(shape: NarrativeRoom["preferredShape"]): { height: number; width: number } {
  switch (shape) {
    case "long":
      return { height: 4, width: 8 };
    case "wide":
      return { height: 5, width: 9 };
    case "square":
      return { height: 6, width: 6 };
    case "organic":
      return { height: 7, width: 7 };
    case "rectangular":
    default:
      return { height: 5, width: 7 };
  }
}

function inferTheme(request: string): string {
  if (/crypt|cripta|cathedral|cattedrale|undead|morti|tomb|tomba|chapel|cappella/u.test(request)) {
    return "crypt";
  }

  if (/cave|cavern|natural/u.test(request)) {
    return "cave";
  }

  if (/city|urban|street/u.test(request)) {
    return "city";
  }

  if (/ship|deck|pirate/u.test(request)) {
    return "ship";
  }

  return "dungeon";
}

function isBossRoom(label: string, blueprint: MapGenerationBlueprint): boolean {
  const room = blueprint.rooms.find((candidate) => candidate.label === label);
  return room?.tacticalRole === "boss" || /boss|final/u.test(normalizeText(label));
}

function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/gu, "");
}

function toTitle(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
