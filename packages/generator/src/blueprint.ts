import type { MapDocument } from "@dm-instamap/core";
import { generateDungeon } from "./index";
import {
  generateCaveDungeon,
  generateOutdoorMap,
  generateVillageMap
} from "./algorithms";

export type BlueprintScale = "small" | "medium" | "large";
export type BlueprintMood =
  | "safe"
  | "tense"
  | "hostile"
  | "ominous"
  | "festive";
export type BlueprintStructure =
  | "dungeon"
  | "building"
  | "cave"
  | "city"
  | "village"
  | "outdoor"
  | "ship";

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
  hasVegetation: boolean;
  hasWater: boolean;
  id: string;
  mapKind: "dungeon" | "building" | "city" | "cave" | "ship";
  mood: BlueprintMood;
  name: string;
  rooms: NarrativeRoom[];
  ruinLevel: number;
  scale: BlueprintScale;
  structure: BlueprintStructure;
  theme: string;
};

export type NarrativeGenerationInput = {
  heightCells?: number;
  request: string;
  roomCount?: number;
  theme?: string;
  widthCells?: number;
};

export function createNarrativeBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const theme = input.theme?.trim() || inferTheme(request);

  if (
    theme === "crypt" ||
    /crypt|cripta|cathedral|cattedrale|undead|morti|tomb|tomba|reliquary|reliquiario|chapel|cappella/u.test(
      request
    )
  ) {
    return generateCryptBlueprint(input);
  }

  if (/cave|cavern|grotta|caverna|natural cavern/u.test(request)) {
    return generateCaveBlueprint(input);
  }

  if (/village|villaggio|town|city|urban|street|borgo|hamlet/u.test(request)) {
    return generateVillageBlueprint(input);
  }

  if (
    /forest|foresta|wood|bosco|clearing|outdoor|esterno|river|fiume|outdoors/u.test(
      request
    )
  ) {
    return generateOutdoorBlueprint(input);
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
  const heightCells =
    options.heightCells ?? dimensionForScale(blueprint.scale, "height");
  const widthCells =
    options.widthCells ?? dimensionForScale(blueprint.scale, "width");

  if (blueprint.structure === "cave") {
    return mergeBlueprintInto(
      blueprint,
      generateCaveDungeon({
        heightCells,
        seed: blueprint.id,
        theme: blueprint.theme,
        widthCells
      })
    );
  }

  if (blueprint.structure === "village" || blueprint.structure === "city") {
    return mergeBlueprintInto(
      blueprint,
      generateVillageMap({
        blockCount: Math.max(4, blueprint.rooms.length + 2),
        heightCells,
        seed: blueprint.id,
        theme: blueprint.theme,
        widthCells
      })
    );
  }

  if (blueprint.structure === "outdoor") {
    return mergeBlueprintInto(
      blueprint,
      generateOutdoorMap({
        heightCells,
        river: blueprint.hasWater,
        seed: blueprint.id,
        theme: blueprint.theme,
        treeDensity: blueprint.hasVegetation ? 0.15 : 0.05,
        widthCells
      })
    );
  }

  const requiredRooms = blueprint.rooms
    .filter((room) => room.tacticalRole !== "entrance")
    .map((room) => room.label);
  const map = generateDungeon({
    heightCells,
    requiredRooms: requiredRooms.map((room) =>
      isBossRoom(room, blueprint) ? "boss" : room
    ),
    roomCount: Math.max(blueprint.rooms.length, 3),
    theme: blueprint.theme,
    widthCells
  });
  const roomBlueprints = blueprint.rooms.filter(
    (room) => room.tacticalRole !== "transition"
  );
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
          ? blueprint.rooms.find(
              (candidate) => candidate.tacticalRole === "entrance"
            )
          : room.id === "room-final"
            ? blueprint.rooms.find(
                (candidate) => candidate.tacticalRole === "boss"
              )
            : (roomBlueprints[index] ?? roomBlueprints[index - 1]);

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
    ...blueprint.rooms.flatMap((room) =>
      room.suggestedNotes.map((note) => `${room.label}: ${note}`)
    )
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

export function generateCryptBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const nonHostileUndead =
    /non hostile|non-hostile|not hostile|prisoner|prigion|bound|chained|incaten|prigionieri/u.test(
      request
    );
  const cathedral = /cathedral|cattedrale|chapel|sacristy|temple|chiesa/u.test(
    request
  );
  const rooms: NarrativeRoom[] = [
    createRoom({
      id: "entrance-from-cathedral",
      label: cathedral ? "Entrance from Cathedral Sacristy" : "Crypt Entrance",
      purpose: "A threshold from the world above into the buried complex.",
      role: "entrance",
      tags: [
        "entrance",
        "crypt",
        cathedral ? "cathedral" : "stairs",
        "threshold"
      ],
      assets: ["stairs", "stone arch", "dust", "holy symbol"],
      lights: ["cold daylight", "torch"],
      notes: [
        "This room should orient players and clearly show the exit route."
      ],
      shape: "wide"
    }),
    createRoom({
      id: "hall-of-bound-spirits",
      label: nonHostileUndead
        ? "Hall of Bound Spirits"
        : "Hall of Restless Dead",
      purpose: nonHostileUndead
        ? "A social encounter where undead are trapped rather than hostile."
        : "A tense encounter chamber for restless crypt guardians.",
      role: nonHostileUndead ? "social" : "combat",
      tags: [
        "crypt",
        "undead",
        nonHostileUndead ? "non-hostile" : "hostile",
        "bound",
        "social"
      ],
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
      purpose:
        "A puzzle room around reliquaries, vows, and old sacred failures.",
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
      purpose:
        "A hazard chamber showing that the dead were imprisoned below the cathedral.",
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
      {
        from: "entrance-from-cathedral",
        to: "hall-of-bound-spirits",
        type: "door"
      },
      {
        from: "hall-of-bound-spirits",
        to: "reliquary-of-broken-vows",
        type: "door"
      },
      {
        from: "reliquary-of-broken-vows",
        to: "sealed-prison-tomb",
        type: "locked"
      },
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
    hasVegetation: false,
    hasWater: /water|flood|allagat/u.test(request),
    id: "blueprint-crypt-cathedral",
    mapKind: "dungeon",
    mood: nonHostileUndead ? "ominous" : "hostile",
    name: cathedral ? "Crypt Beneath the Cathedral" : "Narrative Crypt",
    rooms,
    ruinLevel: /ruin|rovin|collapsed|crollat|broken/u.test(request) ? 0.7 : 0.4,
    scale: inferScale(request, "medium"),
    structure: "dungeon",
    theme: "crypt"
  };
}

export function generateCaveBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const theme = input.theme?.trim() || "cave";
  const flooded = /water|flood|lago|river|fiume|allagat/u.test(request);
  const mossy = /moss|muschio|fungo|fungal|mushroom/u.test(request);
  const rooms = [
    createRoom({
      id: "cave-mouth",
      label: "Cave Mouth",
      purpose:
        "The opening through which the party enters the natural complex.",
      role: "entrance",
      tags: [theme, "entrance", "natural", "mouth"],
      assets: ["rocks", "debris", "moss"],
      lights: ["daylight"],
      notes: [
        "A natural threshold; give a clear silhouette of what waits inside."
      ],
      shape: "organic"
    }),
    createRoom({
      id: "main-chamber",
      label: "Main Cavern",
      purpose: "A large, irregular cavern that anchors the encounter.",
      role: "combat",
      tags: [theme, "cavern", "organic", flooded ? "flooded" : "dry"],
      assets: [
        "stalagmites",
        "boulders",
        ...(flooded ? ["water pool"] : []),
        ...(mossy ? ["moss"] : [])
      ],
      lights: ["torch", ...(mossy ? ["bioluminescent"] : [])],
      notes: ["Use uneven cover and irregular sight lines; not a square room."],
      shape: "organic"
    }),
    createRoom({
      id: "hidden-alcove",
      label: "Hidden Alcove",
      purpose: "A side recess containing a secret or treasure.",
      role: "treasure",
      tags: [theme, "alcove", "secret"],
      assets: ["chest", "bones", "scratches"],
      lights: ["dim ambient"],
      notes: [
        "Reward investigation: not visible from the main cavern entrance."
      ],
      shape: "square"
    }),
    createRoom({
      id: "deep-pool",
      label: flooded ? "Deep Pool" : "Pit Chamber",
      purpose: "An environmental hazard that complicates movement.",
      role: "hazard",
      tags: [theme, "hazard", flooded ? "water" : "pit"],
      assets: [flooded ? "water" : "chasm", "rope"],
      lights: ["dim ambient"],
      notes: [
        flooded
          ? "The pool is deeper than it looks."
          : "The pit drops to an unknown depth."
      ],
      shape: "wide"
    })
  ];

  return {
    connections: [
      { from: "cave-mouth", to: "main-chamber", type: "open" },
      { from: "main-chamber", to: "hidden-alcove", type: "secret" },
      { from: "main-chamber", to: "deep-pool", type: "open" }
    ],
    globalTags: unique([
      theme,
      "natural",
      "organic",
      ...(flooded ? ["water", "flooded"] : []),
      ...(mossy ? ["moss", "fungal"] : [])
    ]),
    gmNotes: [
      "Caves should feel organic; avoid right-angle dressing and grid-perfect placement."
    ],
    hasVegetation: mossy,
    hasWater: flooded,
    id: `blueprint-${theme}-cave`,
    mapKind: "cave",
    mood: "ominous",
    name: `${toTitle(theme)} Cave`,
    rooms,
    ruinLevel: 0.2,
    scale: inferScale(request, "medium"),
    structure: "cave",
    theme
  };
}

export function generateVillageBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const theme = input.theme?.trim() || "village";
  const market = /market|mercato|fair|fiera/u.test(request);
  const docks = /port|dock|fishing|pescat|harbor/u.test(request);
  const rooms = [
    createRoom({
      id: "village-square",
      label: market ? "Market Square" : "Village Square",
      purpose: "The main public gathering area.",
      role: "entrance",
      tags: [
        theme,
        "entrance",
        "social",
        "square",
        ...(market ? ["market"] : [])
      ],
      assets: [
        "well",
        "signpost",
        ...(market ? ["stalls", "crates"] : ["bench"])
      ],
      lights: ["lantern", "daylight"],
      notes: ["Establish whoever runs the village right at the square."],
      shape: "wide"
    }),
    createRoom({
      id: "tavern",
      label: "Tavern",
      purpose: "Social hub for rumors, jobs, and rest.",
      role: "social",
      tags: [theme, "tavern", "social", "interior"],
      assets: ["tables", "chairs", "bar", "fireplace"],
      lights: ["fire", "lantern"],
      notes: ["Likely first stop; populate with at least one named NPC."],
      shape: "rectangular"
    }),
    createRoom({
      id: "smithy",
      label: "Smithy",
      purpose: "Equipment, repairs, and a possible quest hook.",
      role: "social",
      tags: [theme, "smithy", "forge", "interior"],
      assets: ["anvil", "forge", "weapons rack"],
      lights: ["fire"],
      notes: ["Use the forge as visual centerpiece."],
      shape: "square"
    }),
    createRoom({
      id: "chapel-or-shrine",
      label: "Shrine",
      purpose: "A small sacred space anchoring local belief.",
      role: "puzzle",
      tags: [theme, "shrine", "sacred", "interior"],
      assets: ["altar", "candles", "offerings"],
      lights: ["candle"],
      notes: ["Carries setting-specific lore."],
      shape: "square"
    }),
    ...(docks
      ? [
          createRoom({
            id: "docks",
            label: "Docks",
            purpose: "Boats, fishing gear, and routes out of town.",
            role: "transition",
            tags: [theme, "docks", "transition", "water"],
            assets: ["crates", "nets", "boats"],
            lights: ["lantern"],
            notes: ["Optional water-side exit route."],
            shape: "long"
          })
        ]
      : [])
  ];

  return {
    connections: rooms.slice(1).map((room) => ({
      from: "village-square",
      to: room.id,
      type: "open"
    })),
    globalTags: unique([
      theme,
      "village",
      "settlement",
      ...(market ? ["market"] : []),
      ...(docks ? ["docks", "water"] : [])
    ]),
    gmNotes: [
      "Village maps should privilege named buildings and clear circulation around the square."
    ],
    hasVegetation: /forest|wood|bosco|tree|alber/u.test(request),
    hasWater: docks,
    id: `blueprint-${theme}-village`,
    mapKind: "city",
    mood: market ? "festive" : "safe",
    name: `${toTitle(theme)} Village`,
    rooms,
    ruinLevel: /abandon|ruin|rovin|deserted/u.test(request) ? 0.6 : 0.0,
    scale: inferScale(request, "medium"),
    structure: "village",
    theme
  };
}

export function generateOutdoorBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
  const request = normalizeText(input.request);
  const theme = input.theme?.trim() || "forest";
  const river = /river|fiume|stream|torrent/u.test(request);
  const dense = /dense|fitto|thick|impenetrable/u.test(request);
  const rooms = [
    createRoom({
      id: "trail-entry",
      label: "Trail Entry",
      purpose: "A clear approach into the outdoor area.",
      role: "entrance",
      tags: [theme, "entrance", "trail"],
      assets: ["path", "signpost"],
      lights: ["daylight"],
      notes: ["Mark direction of approach clearly."],
      shape: "long"
    }),
    createRoom({
      id: "clearing",
      label: "Clearing",
      purpose: "An open area large enough for tactical movement.",
      role: "combat",
      tags: [theme, "clearing", "outdoor", "open"],
      assets: ["fallen log", "rocks", "ferns"],
      lights: ["daylight"],
      notes: ["Use scattered cover, not symmetric obstacles."],
      shape: "organic"
    }),
    ...(river
      ? [
          createRoom({
            id: "river-bend",
            label: "River Bend",
            purpose: "A water obstacle with a crossing point.",
            role: "hazard",
            tags: [theme, "river", "water", "hazard"],
            assets: ["stones", "fallen tree", "bridge"],
            lights: ["daylight"],
            notes: ["Provide at least one safe crossing."],
            shape: "wide"
          })
        ]
      : []),
    createRoom({
      id: "old-shrine",
      label: "Old Shrine",
      purpose: "A small narrative landmark deeper in the area.",
      role: "puzzle",
      tags: [theme, "shrine", "lore"],
      assets: ["stone marker", "offerings", "moss"],
      lights: ["dim ambient"],
      notes: ["Optional lore hook for the location."],
      shape: "square"
    })
  ];

  return {
    connections: rooms.slice(1).map((room, index) => ({
      from: index === 0 ? "trail-entry" : (rooms[index] as NarrativeRoom).id,
      to: room.id,
      type: "open"
    })),
    globalTags: unique([
      theme,
      "outdoor",
      "wilderness",
      ...(river ? ["water", "river"] : []),
      ...(dense ? ["dense"] : [])
    ]),
    gmNotes: [
      "Outdoor maps should privilege cover, sight lines, and discoverable landmarks."
    ],
    hasVegetation: true,
    hasWater: river,
    id: `blueprint-${theme}-outdoor`,
    mapKind: "dungeon",
    mood: dense ? "tense" : "safe",
    name: `${toTitle(theme)} Wilderness`,
    rooms,
    ruinLevel: 0,
    scale: inferScale(request, "large"),
    structure: "outdoor",
    theme
  };
}

export function generateBuildingBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
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
    gmNotes: [
      "Building maps should prioritize readable circulation and practical room adjacency."
    ],
    hasVegetation: false,
    hasWater: false,
    id: `blueprint-${theme}`,
    mapKind: "building",
    mood: request.includes("combat") ? "tense" : "safe",
    name: `${toTitle(theme)} Interior`,
    rooms,
    ruinLevel: /ruin|rovin|abandon/u.test(request) ? 0.5 : 0,
    scale: inferScale(request, "medium"),
    structure: "building",
    theme
  };
}

export function generateDungeonBlueprint(
  input: NarrativeGenerationInput
): MapGenerationBlueprint {
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
    gmNotes: [
      "Generic narrative dungeon generated from local heuristics only."
    ],
    hasVegetation: false,
    hasWater: false,
    id: `blueprint-${theme}-dungeon`,
    mapKind: "dungeon",
    mood: "hostile",
    name: `${toTitle(theme)} Narrative Dungeon`,
    rooms,
    ruinLevel: 0.3,
    scale: inferScale(input.request, "medium"),
    structure: "dungeon",
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

function inferMinSize(shape: NarrativeRoom["preferredShape"]): {
  height: number;
  width: number;
} {
  switch (shape) {
    case "long":
      return { height: 4, width: 8 };
    case "wide":
      return { height: 5, width: 9 };
    case "square":
      return { height: 6, width: 6 };
    case "organic":
      return { height: 7, width: 7 };
    default:
      return { height: 5, width: 7 };
  }
}

function inferTheme(request: string): string {
  if (
    /crypt|cripta|cathedral|cattedrale|undead|morti|tomb|tomba|chapel|cappella/u.test(
      request
    )
  ) {
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
  return (
    room?.tacticalRole === "boss" || /boss|final/u.test(normalizeText(label))
  );
}

function inferScale(request: string, fallback: BlueprintScale): BlueprintScale {
  if (/small|piccol|tiny|minor/u.test(request)) {
    return "small";
  }

  if (/huge|massive|sprawl|grande|enorme|vast/u.test(request)) {
    return "large";
  }

  return fallback;
}

function dimensionForScale(
  scale: BlueprintScale,
  axis: "height" | "width"
): number {
  const base = axis === "height" ? 44 : 64;

  if (scale === "small") {
    return Math.floor(base * 0.6);
  }

  if (scale === "large") {
    return Math.floor(base * 1.4);
  }

  return base;
}

function mergeBlueprintInto(
  blueprint: MapGenerationBlueprint,
  base: MapDocument
): MapDocument {
  const blueprintRooms = blueprint.rooms;
  const planRooms = base.plan?.rooms ?? [];
  const updatedRooms = planRooms.map((room, index) => {
    const narrativeRoom =
      room.kind === "entrance"
        ? blueprintRooms.find(
            (candidate) => candidate.tacticalRole === "entrance"
          )
        : (blueprintRooms.filter(
            (candidate) => candidate.tacticalRole !== "entrance"
          )[index - 1] ??
          blueprintRooms.find(
            (candidate) => candidate.tacticalRole === "boss"
          ));

    if (!narrativeRoom) {
      return {
        ...room,
        tags: unique([...room.tags, blueprint.theme, `mood-${blueprint.mood}`])
      };
    }

    return {
      ...room,
      label: narrativeRoom.label,
      tags: unique([
        ...room.tags,
        ...narrativeRoom.tags,
        `role-${narrativeRoom.tacticalRole}`,
        `blueprint-${narrativeRoom.id}`,
        `mood-${blueprint.mood}`,
        `scale-${blueprint.scale}`
      ])
    };
  });
  const notes = [
    `Blueprint: ${blueprint.name}`,
    `Mood: ${blueprint.mood}, scale: ${blueprint.scale}, ruin: ${blueprint.ruinLevel.toFixed(2)}.`,
    ...blueprint.gmNotes,
    ...blueprint.rooms.flatMap((room) =>
      room.suggestedNotes.map((note) => `${room.label}: ${note}`)
    )
  ];

  return {
    ...base,
    id: blueprint.id,
    name: blueprint.name,
    plan: base.plan
      ? {
          ...base.plan,
          id: `${blueprint.id}-plan`,
          name: `${blueprint.name} Plan`,
          notes,
          requestId: blueprint.id,
          rooms: updatedRooms
        }
      : undefined
  };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "");
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
