import type { MapDocument, MapTile, RoomNode } from "@dm-instamap/core/browser";

export type MapQualityRating = "poor" | "usable" | "strong";

export type MapQualityMetric = {
  label: string;
  score: number;
  target: string;
  value: number;
};

export type MapQualityDebugTile = {
  kind: "dead-end" | "disconnected" | "narrow";
  reason: string;
  x: number;
  y: number;
};

export type MapQualityReport = {
  debugTiles: MapQualityDebugTile[];
  metrics: {
    connectivity: MapQualityMetric;
    deadEnds: MapQualityMetric;
    lineOfSightBreaks: MapQualityMetric;
    pointsOfInterest: MapQualityMetric;
    roomUtility: MapQualityMetric;
    tacticalCover: MapQualityMetric;
    walkableBalance: MapQualityMetric;
  };
  rating: MapQualityRating;
  score: number;
  summary: string;
  warnings: string[];
};

type TileKey = `${number},${number}`;

const WALKABLE_KINDS = new Set<MapTile["kind"]>(["floor", "door"]);

export function scoreMapQuality(document: MapDocument): MapQualityReport {
  const tileMap = createTileMap(document.tiles);
  const walkable = document.tiles.filter((tile) =>
    WALKABLE_KINDS.has(tile.kind)
  );
  const totalTiles = Math.max(1, document.width * document.height);
  const walkableRatio = walkable.length / totalTiles;
  const connected = collectConnectedWalkableTiles(walkable, tileMap);
  const connectivityRatio =
    walkable.length === 0 ? 0 : connected.size / walkable.length;
  const disconnectedTiles = walkable.filter(
    (tile) => !connected.has(tileKey(tile.x, tile.y))
  );
  const deadEndTiles = walkable.filter(
    (tile) => countWalkableNeighbors(tile, tileMap) <= 1
  );
  const narrowTiles = walkable.filter(
    (tile) => countWalkableNeighbors(tile, tileMap) === 2
  );
  const deadEndRatio =
    walkable.length === 0 ? 1 : deadEndTiles.length / walkable.length;
  const rooms = collectPlayableRooms(document);
  const isolatedRooms = rooms.filter((room) => isRoomIsolated(room, document));
  const pointOfInterestCount = countPointsOfInterest(document);
  const coverTiles = document.tiles.filter(
    (tile) => tile.kind === "wall" && hasAdjacentWalkableTile(tile, tileMap)
  );
  const tacticalCoverRatio =
    walkable.length === 0 ? 0 : coverTiles.length / walkable.length;
  const lineOfSightBreakCount = coverTiles.filter(
    (tile) =>
      tile.x > 0 &&
      tile.y > 0 &&
      tile.x < document.width - 1 &&
      tile.y < document.height - 1
  ).length;

  const metrics = {
    connectivity: metric(
      "Connettivita",
      connectivityRatio,
      Math.round(connectivityRatio * 100),
      "almeno 90% delle celle camminabili collegate"
    ),
    deadEnds: metric(
      "Vicolo cieco",
      deadEndRatio,
      Math.round(100 - clamp01(deadEndRatio / 0.18) * 100),
      "meno del 18% di celle camminabili terminali"
    ),
    lineOfSightBreaks: metric(
      "Linee di vista",
      lineOfSightBreakCount,
      Math.round(
        clamp01(lineOfSightBreakCount / Math.max(4, rooms.length * 2)) * 100
      ),
      "ostacoli interni sufficienti a spezzare linee lunghe"
    ),
    pointsOfInterest: metric(
      "Punti di interesse",
      pointOfInterestCount,
      Math.round(
        clamp01(pointOfInterestCount / Math.max(3, rooms.length)) * 100
      ),
      "porte, note, luci, asset o stanze speciali"
    ),
    roomUtility: metric(
      "Utilita stanze",
      rooms.length === 0 ? 0 : isolatedRooms.length,
      rooms.length === 0
        ? 0
        : Math.round(100 - clamp01(isolatedRooms.length / rooms.length) * 100),
      "stanze collegate o raggiungibili da porte"
    ),
    tacticalCover: metric(
      "Coperture tattiche",
      tacticalCoverRatio,
      Math.round(clamp01(tacticalCoverRatio / 0.28) * 100),
      "muri o ostacoli adiacenti agli spazi giocabili"
    ),
    walkableBalance: metric(
      "Bilanciamento spazio",
      walkableRatio,
      scoreWalkableRatio(walkableRatio),
      "tra 22% e 82% della mappa camminabile"
    )
  };
  const score = Math.round(
    metrics.connectivity.score * 0.28 +
      metrics.walkableBalance.score * 0.16 +
      metrics.roomUtility.score * 0.16 +
      metrics.deadEnds.score * 0.12 +
      metrics.tacticalCover.score * 0.14 +
      metrics.pointsOfInterest.score * 0.08 +
      metrics.lineOfSightBreaks.score * 0.06
  );
  const warnings = collectWarnings({
    connectivityRatio,
    deadEndRatio,
    isolatedRooms,
    lineOfSightBreakCount,
    pointOfInterestCount,
    rooms,
    tacticalCoverRatio,
    walkable,
    walkableRatio
  });
  const rating = score >= 80 ? "strong" : score >= 60 ? "usable" : "poor";

  return {
    debugTiles: [
      ...deadEndTiles.slice(0, 24).map((tile) => ({
        kind: "dead-end" as const,
        reason: "Cella camminabile con una sola uscita cardinale.",
        x: tile.x,
        y: tile.y
      })),
      ...disconnectedTiles.slice(0, 24).map((tile) => ({
        kind: "disconnected" as const,
        reason: "Cella camminabile fuori dalla regione principale.",
        x: tile.x,
        y: tile.y
      })),
      ...narrowTiles.slice(0, 24).map((tile) => ({
        kind: "narrow" as const,
        reason:
          "Passaggio stretto: utile se intenzionale, rischioso se ripetuto.",
        x: tile.x,
        y: tile.y
      }))
    ],
    metrics,
    rating,
    score,
    summary: summarizeQuality(score, rating, warnings),
    warnings
  };
}

function createTileMap(tiles: MapTile[]): Map<TileKey, MapTile> {
  return new Map(tiles.map((tile) => [tileKey(tile.x, tile.y), tile]));
}

function collectConnectedWalkableTiles(
  walkable: MapTile[],
  tileMap: Map<TileKey, MapTile>
): Set<TileKey> {
  const start = walkable[0];
  const seen = new Set<TileKey>();

  if (!start) {
    return seen;
  }

  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift() as MapTile;
    const currentKey = tileKey(current.x, current.y);

    if (seen.has(currentKey)) {
      continue;
    }

    seen.add(currentKey);

    for (const neighbor of cardinalNeighbors(current)) {
      const tile = tileMap.get(tileKey(neighbor.x, neighbor.y));

      if (
        tile &&
        WALKABLE_KINDS.has(tile.kind) &&
        !seen.has(tileKey(tile.x, tile.y))
      ) {
        queue.push(tile);
      }
    }
  }

  return seen;
}

function countWalkableNeighbors(
  tile: MapTile,
  tileMap: Map<TileKey, MapTile>
): number {
  return cardinalNeighbors(tile).filter((neighbor) => {
    const target = tileMap.get(tileKey(neighbor.x, neighbor.y));
    return target ? WALKABLE_KINDS.has(target.kind) : false;
  }).length;
}

function hasAdjacentWalkableTile(
  tile: MapTile,
  tileMap: Map<TileKey, MapTile>
): boolean {
  return cardinalNeighbors(tile).some((neighbor) => {
    const target = tileMap.get(tileKey(neighbor.x, neighbor.y));
    return target ? WALKABLE_KINDS.has(target.kind) : false;
  });
}

function cardinalNeighbors(
  tile: Pick<MapTile, "x" | "y">
): Array<{ x: number; y: number }> {
  return [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 }
  ];
}

function collectPlayableRooms(document: MapDocument): RoomNode[] {
  return (document.plan?.rooms ?? []).filter(
    (room) =>
      room.kind === "entrance" ||
      room.kind === "room" ||
      room.kind === "secret" ||
      room.kind === "service" ||
      room.kind === "stairs"
  );
}

function isRoomIsolated(room: RoomNode, document: MapDocument): boolean {
  if (room.kind === "service" || room.kind === "stairs") {
    return false;
  }

  const doorLinked = (document.plan?.doors ?? []).some((door) =>
    door.roomIds.includes(room.id)
  );
  return room.connections.length === 0 && !doorLinked;
}

function countPointsOfInterest(document: MapDocument): number {
  const rooms = document.plan?.rooms ?? [];
  const specialRooms = rooms.filter(
    (room) =>
      room.kind === "secret" ||
      room.kind === "stairs" ||
      room.tags.some((tag) =>
        /boss|final|treasure|altar|chapel|library|forge|shrine|water|river/u.test(
          tag
        )
      )
  );

  return (
    (document.plan?.doors.length ?? 0) +
    (document.plan?.lights.length ?? 0) +
    (document.plan?.gmNotes.length ?? 0) +
    (document.plan?.assetPlacements.length ?? 0) +
    document.assets.length +
    specialRooms.length
  );
}

function collectWarnings(input: {
  connectivityRatio: number;
  deadEndRatio: number;
  isolatedRooms: RoomNode[];
  lineOfSightBreakCount: number;
  pointOfInterestCount: number;
  rooms: RoomNode[];
  tacticalCoverRatio: number;
  walkable: MapTile[];
  walkableRatio: number;
}): string[] {
  const warnings: string[] = [];

  if (input.walkable.length === 0) {
    warnings.push("La mappa non contiene celle camminabili.");
  }

  if (input.connectivityRatio < 0.9) {
    warnings.push(
      "Alcune aree camminabili non sono collegate alla regione principale."
    );
  }

  if (input.walkableRatio < 0.18) {
    warnings.push("La mappa ha troppo poco spazio giocabile.");
  } else if (input.walkableRatio > 0.88) {
    warnings.push("La mappa e molto aperta: valuta piu ostacoli o coperture.");
  }

  if (input.deadEndRatio > 0.18) {
    warnings.push(
      "Ci sono molti vicoli ciechi o passaggi senza scelta tattica."
    );
  }

  if (input.isolatedRooms.length > 0) {
    warnings.push(
      `${input.isolatedRooms.length} stanze non hanno collegamenti o porte.`
    );
  }

  if (input.rooms.length < 2) {
    warnings.push("La mappa ha poche aree distinte.");
  }

  if (
    input.pointOfInterestCount < Math.max(2, Math.ceil(input.rooms.length / 3))
  ) {
    warnings.push(
      "Aggiungi piu punti di interesse: porte, luci, note, asset o stanze speciali."
    );
  }

  if (input.tacticalCoverRatio < 0.08) {
    warnings.push(
      "La mappa offre poche coperture tattiche vicino agli spazi giocabili."
    );
  }

  if (
    input.lineOfSightBreakCount <
    Math.max(2, Math.floor(input.rooms.length / 2))
  ) {
    warnings.push(
      "Le linee di vista sono poco spezzate: valuta ostacoli interni."
    );
  }

  return warnings;
}

function scoreWalkableRatio(ratio: number): number {
  if (ratio >= 0.22 && ratio <= 0.82) {
    return 100;
  }

  if (ratio < 0.22) {
    return Math.round(clamp01((ratio - 0.08) / 0.14) * 100);
  }

  return Math.round(clamp01((0.95 - ratio) / 0.13) * 100);
}

function metric(
  label: string,
  value: number,
  score: number,
  target: string
): MapQualityMetric {
  return {
    label,
    score: clampScore(score),
    target,
    value
  };
}

function summarizeQuality(
  score: number,
  rating: MapQualityRating,
  warnings: string[]
): string {
  if (rating === "strong") {
    return warnings.length > 0
      ? `Solida (${score}/100), con ${warnings.length} punti da rifinire.`
      : `Solida (${score}/100), pronta per una rifinitura manuale leggera.`;
  }

  if (rating === "usable") {
    return `Usabile (${score}/100), ma conviene controllare i warning prima della sessione.`;
  }

  return `Debole (${score}/100): richiede interventi prima di usarla al tavolo.`;
}

function tileKey(x: number, y: number): TileKey {
  return `${x},${y}`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
