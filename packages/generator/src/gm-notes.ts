import type { MapDocument, MapNote, RoomNode } from "@dm-instamap/core";
import type { TacticalRole } from "./blueprint";

const ROLE_VALUES: TacticalRole[] = [
  "entrance",
  "social",
  "combat",
  "puzzle",
  "treasure",
  "hazard",
  "boss",
  "transition",
  "secret",
  "safe"
];

const ROLE_TITLES: Record<TacticalRole, string> = {
  boss: "Scontro finale",
  combat: "Zona di combattimento",
  entrance: "Ingresso",
  hazard: "Pericolo ambientale",
  puzzle: "Enigma",
  safe: "Zona sicura",
  secret: "Stanza segreta",
  social: "Spazio sociale",
  transition: "Passaggio",
  treasure: "Tesoro"
};

const ROLE_NOTES: Record<TacticalRole, string> = {
  boss: "Riserva spazio per il manovrare: il boss deve poter usare l'intera stanza, con vie di fuga limitate per i giocatori.",
  combat: "Predisponi coperture e linee di vista spezzate; pensa a 2-3 punti di ingaggio.",
  entrance: "Orienta i giocatori e mostra chiaramente la via d'uscita; introduci il tono del luogo.",
  hazard: "Segnala il pericolo con indizi ambientali prima che diventi una trappola mortale.",
  puzzle: "L'enigma deve avere una soluzione leggibile dagli indizi presenti nella stanza.",
  safe: "Punto di respiro: niente incontri forzati, ideale per riposo breve o RP.",
  secret: "Ricompensa l'esplorazione: l'accesso non deve essere visibile dalla via principale.",
  social: "Popola con almeno un PNG con nome; pensa a cosa vogliono i presenti.",
  transition: "Buon punto per coperture tattiche senza trasformarlo in una stanza boss.",
  treasure: "Il bottino deve valere il rischio: lega la ricompensa a una scelta o a una guardia."
};

const PLAYABLE_KINDS = new Set<RoomNode["kind"]>(["entrance", "room", "secret", "service", "stairs"]);

const ROLE_TAG_PREFIX = "role-";

/**
 * Infers the tactical role of a room from its kind and tags. Blueprint-derived
 * rooms carry an explicit `role-<role>` tag which always wins; procedural rooms
 * fall back to deterministic keyword heuristics.
 */
export function inferRoomRole(room: RoomNode): TacticalRole {
  const explicit = room.tags
    .map((tag) => tag.toLowerCase())
    .find((tag) => tag.startsWith(ROLE_TAG_PREFIX) && ROLE_VALUES.includes(tag.slice(ROLE_TAG_PREFIX.length) as TacticalRole));

  if (explicit) {
    return explicit.slice(ROLE_TAG_PREFIX.length) as TacticalRole;
  }

  if (room.kind === "entrance") {
    return "entrance";
  }

  if (room.kind === "corridor") {
    return "transition";
  }

  if (room.kind === "secret") {
    return "secret";
  }

  if (room.kind === "stairs") {
    return "transition";
  }

  const haystack = `${room.label} ${room.tags.join(" ")}`.toLowerCase();

  if (/\b(boss|final|finale)\b/u.test(haystack)) {
    return "boss";
  }

  if (/treasure|tesoro|vault|hoard|reliquary|reliquia/u.test(haystack)) {
    return "treasure";
  }

  if (/altar|shrine|chapel|cappella|temple|tempio|library|biblioteca|puzzle|enigma|rune|sigil/u.test(haystack)) {
    return "puzzle";
  }

  if (/water|acqua|river|fiume|flood|pit|trap|trappola|hazard|lava|pozzo/u.test(haystack)) {
    return "hazard";
  }

  if (/tavern|taverna|inn|market|mercato|social|hall|salone|quarters|alloggi|square|piazza/u.test(haystack)) {
    return "social";
  }

  if (/camp|accampament|rest|riposo|safe|sicur/u.test(haystack)) {
    return "safe";
  }

  return "combat";
}

function roomCenter(room: RoomNode): { x: number; y: number } {
  return {
    x: room.bounds.x + Math.floor(room.bounds.width / 2),
    y: room.bounds.y + Math.floor(room.bounds.height / 2)
  };
}

/**
 * Produces one deterministic GM note per playable room, keyed on the inferred
 * tactical role. Corridors are skipped to avoid clutter. Output is stable for a
 * given document (ids derive from room ids, no randomness or timestamps).
 */
export function generateRoomRoleNotes(document: MapDocument): MapNote[] {
  const rooms = (document.plan?.rooms ?? []).filter((room) => PLAYABLE_KINDS.has(room.kind));

  return rooms.map((room) => {
    const role = inferRoomRole(room);

    return {
      id: `note-role-${room.id}`,
      position: roomCenter(room),
      text: `${room.label} - ${ROLE_NOTES[role]}`,
      title: ROLE_TITLES[role]
    } satisfies MapNote;
  });
}

/**
 * Returns a copy of the document with deterministic role notes merged into
 * `plan.gmNotes`. Existing notes with the same id are replaced, so the call is
 * idempotent.
 */
export function withRoomRoleNotes(document: MapDocument): MapDocument {
  if (!document.plan) {
    return document;
  }

  const generated = generateRoomRoleNotes(document);
  const generatedIds = new Set(generated.map((note) => note.id));
  const preserved = document.plan.gmNotes.filter((note) => !generatedIds.has(note.id));

  return {
    ...document,
    plan: {
      ...document.plan,
      gmNotes: [...preserved, ...generated]
    }
  };
}
