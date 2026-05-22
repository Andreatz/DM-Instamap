import { MapPlanSchema } from "@dm-instamap/core";
import type { MapPlan, PlacedAsset, RoomNode } from "@dm-instamap/core";
import type { ZodError } from "zod";
import { summarizeAssetGroupForSearch, tokenize } from "./prompt";
import type {
  AssetReplacementSuggestion,
  BridgeValidationResult,
  MissingAssetReport,
  RepairPlanInput,
  RepairPlanResult,
  SemanticIssue,
  SemanticValidationContext,
  SemanticValidationResult,
  SuggestionInput
} from "./types";

export function validateBridgeResponse(value: string): BridgeValidationResult {
  try {
    const parsed = JSON.parse(stripCodeFence(value));
    const result = MapPlanSchema.safeParse(parsed);

    if (result.success) {
      return {
        data: result.data,
        ok: true
      };
    }

    return {
      errors: formatZodErrors(result.error),
      ok: false
    };
  } catch (error) {
    return {
      errors: [
        error instanceof Error ? error.message : "Response is not valid JSON."
      ],
      ok: false
    };
  }
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1] ?? trimmed;
}

export function validatePlanSemantics(
  plan: MapPlan,
  context: SemanticValidationContext = { assetGroups: [] }
): SemanticValidationResult {
  const issues: SemanticIssue[] = [];
  const seenIds = new Set<string>();
  const roomIds = new Set<string>();
  const knownAssetIds = new Set([
    ...(context.knownAssetIds ?? []),
    ...context.assetGroups.map((group) => group.id),
    ...(context.assetSearchResults ?? []).map((result) => result.assetId)
  ]);
  const missingAssetMap = new Map<string, MissingAssetReport>();
  const mapWidth = context.mapWidth ?? Number.POSITIVE_INFINITY;
  const mapHeight = context.mapHeight ?? Number.POSITIVE_INFINITY;

  for (const room of plan.rooms) {
    pushDuplicate(issues, seenIds, room.id, `rooms[${room.id}]`);
    roomIds.add(room.id);

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (room.bounds.x < 0 ||
        room.bounds.y < 0 ||
        room.bounds.x + room.bounds.width > mapWidth ||
        room.bounds.y + room.bounds.height > mapHeight)
    ) {
      issues.push({
        level: "error",
        message: `Room ${room.id} bounds (${room.bounds.x},${room.bounds.y} ${room.bounds.width}x${room.bounds.height}) escape map ${mapWidth}x${mapHeight}.`,
        path: `rooms[${room.id}].bounds`,
        roomId: room.id,
        type: "room_out_of_bounds"
      });
    }
  }

  for (const room of plan.rooms) {
    for (const connection of room.connections) {
      if (!roomIds.has(connection)) {
        issues.push({
          level: "warning",
          message: `Room ${room.id} connects to unknown room ${connection}.`,
          path: `rooms[${room.id}].connections`,
          roomId: room.id,
          type: "missing_room_reference"
        });
      }
    }
  }

  for (const wall of plan.walls) {
    pushDuplicate(issues, seenIds, wall.id, `walls[${wall.id}]`);

    if (wall.start.x === wall.end.x && wall.start.y === wall.end.y) {
      issues.push({
        level: "error",
        message: `Wall ${wall.id} has zero length (start equals end).`,
        path: `walls[${wall.id}]`,
        type: "wall_zero_length",
        wallId: wall.id
      });
    }

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(wall.start.x, mapWidth) ||
        outOfBounds(wall.start.y, mapHeight) ||
        outOfBounds(wall.end.x, mapWidth) ||
        outOfBounds(wall.end.y, mapHeight))
    ) {
      issues.push({
        level: "warning",
        message: `Wall ${wall.id} extends outside the map bounds.`,
        path: `walls[${wall.id}]`,
        type: "wall_out_of_bounds",
        wallId: wall.id
      });
    }

    for (const roomId of wall.roomIds) {
      if (!roomIds.has(roomId)) {
        issues.push({
          level: "warning",
          message: `Wall ${wall.id} references unknown room ${roomId}.`,
          path: `walls[${wall.id}].roomIds`,
          type: "missing_room_reference",
          wallId: wall.id
        });
      }
    }
  }

  for (const door of plan.doors) {
    pushDuplicate(issues, seenIds, door.id, `doors[${door.id}]`);

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(door.position.x, mapWidth) ||
        outOfBounds(door.position.y, mapHeight))
    ) {
      issues.push({
        doorId: door.id,
        level: "error",
        message: `Door ${door.id} position (${door.position.x},${door.position.y}) is outside the map.`,
        path: `doors[${door.id}].position`,
        type: "door_out_of_bounds"
      });
    }

    for (const roomId of door.roomIds) {
      if (!roomIds.has(roomId)) {
        issues.push({
          doorId: door.id,
          level: "warning",
          message: `Door ${door.id} references unknown room ${roomId}.`,
          path: `doors[${door.id}].roomIds`,
          type: "missing_room_reference"
        });
      }
    }
  }

  for (const light of plan.lights) {
    pushDuplicate(issues, seenIds, light.id, `lights[${light.id}]`);

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(light.position.x, mapWidth) ||
        outOfBounds(light.position.y, mapHeight))
    ) {
      issues.push({
        level: "warning",
        lightId: light.id,
        message: `Light ${light.id} position (${light.position.x},${light.position.y}) is outside the map.`,
        path: `lights[${light.id}].position`,
        type: "light_out_of_bounds"
      });
    }

    if (!Number.isFinite(light.radius) || light.radius <= 0) {
      issues.push({
        level: "error",
        lightId: light.id,
        message: `Light ${light.id} has invalid radius ${light.radius}.`,
        path: `lights[${light.id}].radius`,
        type: "light_invalid_radius"
      });
    }
  }

  for (const asset of plan.assetPlacements) {
    pushDuplicate(issues, seenIds, asset.id, `assetPlacements[${asset.id}]`);

    if (knownAssetIds.size > 0 && !knownAssetIds.has(asset.assetId)) {
      issues.push({
        assetId: asset.assetId,
        level: "warning",
        message: `Placed asset ${asset.id} references unknown asset ${asset.assetId}.`,
        path: `assetPlacements[${asset.id}].assetId`,
        type: "missing_asset"
      });
      const existing = missingAssetMap.get(asset.assetId);

      if (existing) {
        existing.placedAssetId = existing.placedAssetId ?? asset.id;
      } else {
        missingAssetMap.set(asset.assetId, {
          assetId: asset.assetId,
          placedAssetId: asset.id,
          suggestions: suggestAssetReplacements(asset.assetId, {
            assetGroups: context.assetGroups,
            assetSearchResults: context.assetSearchResults ?? [],
            limit: 3
          })
        });
      }
    }

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(asset.position.x, mapWidth) ||
        outOfBounds(asset.position.y, mapHeight))
    ) {
      issues.push({
        assetId: asset.assetId,
        level: "warning",
        message: `Placed asset ${asset.id} position (${asset.position.x},${asset.position.y}) is outside the map.`,
        path: `assetPlacements[${asset.id}].position`,
        type: "asset_out_of_bounds"
      });
    }
  }

  const missingAssets = [...missingAssetMap.values()];
  const hasErrors = issues.some((issue) => issue.level === "error");

  return {
    issues,
    missingAssets,
    ok: !hasErrors
  };
}

export function suggestAssetReplacements(
  missingAssetId: string,
  input: SuggestionInput
): AssetReplacementSuggestion[] {
  const tokens = tokenize(missingAssetId);
  const limit = Math.max(1, Math.min(10, input.limit ?? 3));
  const groupSuggestions = input.assetGroups.map((group) => {
    const text = summarizeAssetGroupForSearch(group);
    const score = tokens.reduce(
      (sum, token) => sum + (text.includes(token) ? 1 : 0),
      0
    );
    const reason =
      score === 0
        ? "fallback (no token overlap)"
        : `matches ${tokens.filter((token) => text.includes(token)).join(", ")}`;
    return {
      reason,
      score,
      suggestionId: group.id
    };
  });
  const searchSuggestions = (input.assetSearchResults ?? []).map((result) => ({
    reason: `local search hit (${Math.round(result.score * 100)}% — ${result.reason || result.relativePath})`,
    score: 0.5 + result.score,
    suggestionId: result.assetId
  }));
  const combined = [...groupSuggestions, ...searchSuggestions]
    .filter((suggestion) => suggestion.suggestionId !== missingAssetId)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.suggestionId.localeCompare(right.suggestionId)
    );
  const seen = new Set<string>();
  const unique: AssetReplacementSuggestion[] = [];

  for (const suggestion of combined) {
    if (seen.has(suggestion.suggestionId)) {
      continue;
    }

    seen.add(suggestion.suggestionId);
    unique.push(suggestion);

    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

export function repairPlanLocally(input: RepairPlanInput): RepairPlanResult {
  const mapWidth = input.context.mapWidth ?? Number.POSITIVE_INFINITY;
  const mapHeight = input.context.mapHeight ?? Number.POSITIVE_INFINITY;
  const removed = {
    duplicateIds: [] as string[],
    invalidLights: [] as string[],
    invalidWalls: [] as string[],
    outOfBoundsAssets: [] as string[],
    outOfBoundsDoors: [] as string[]
  };
  const appliedSubstitutions: Array<{
    from: string;
    placedAssetId: string;
    to: string;
  }> = [];
  const seenIds = new Set<string>();
  const rooms = dedupe(input.plan.rooms, removed.duplicateIds, seenIds);
  const roomIds = new Set(rooms.map((room) => room.id));
  const sanitizedRooms = rooms.map((room) => ({
    ...room,
    connections: room.connections.filter((connection) =>
      roomIds.has(connection)
    )
  }));
  const walls = dedupe(input.plan.walls, removed.duplicateIds, seenIds).filter(
    (wall) => {
      if (wall.start.x === wall.end.x && wall.start.y === wall.end.y) {
        removed.invalidWalls.push(wall.id);
        return false;
      }

      return true;
    }
  );
  const doors = dedupe(input.plan.doors, removed.duplicateIds, seenIds).filter(
    (door) => {
      if (
        outOfBounds(door.position.x, mapWidth) ||
        outOfBounds(door.position.y, mapHeight)
      ) {
        removed.outOfBoundsDoors.push(door.id);
        return false;
      }

      return true;
    }
  );
  const lights = dedupe(
    input.plan.lights,
    removed.duplicateIds,
    seenIds
  ).filter((light) => {
    if (!Number.isFinite(light.radius) || light.radius <= 0) {
      removed.invalidLights.push(light.id);
      return false;
    }

    return true;
  });
  const knownAssetIds = new Set([
    ...(input.context.knownAssetIds ?? []),
    ...input.context.assetGroups.map((group) => group.id),
    ...(input.context.assetSearchResults ?? []).map((result) => result.assetId)
  ]);
  const apply = input.applyAssetSubstitutions ?? true;
  const placements = dedupe(
    input.plan.assetPlacements,
    removed.duplicateIds,
    seenIds
  )
    .filter((placement) => {
      if (
        outOfBounds(placement.position.x, mapWidth) ||
        outOfBounds(placement.position.y, mapHeight)
      ) {
        removed.outOfBoundsAssets.push(placement.id);
        return false;
      }

      return true;
    })
    .map<PlacedAsset>((placement) => {
      if (
        !apply ||
        knownAssetIds.size === 0 ||
        knownAssetIds.has(placement.assetId)
      ) {
        return placement;
      }

      const suggestions = suggestAssetReplacements(placement.assetId, {
        assetGroups: input.context.assetGroups,
        assetSearchResults: input.context.assetSearchResults ?? [],
        limit: 1
      });
      const replacement = suggestions[0]?.suggestionId;

      if (!replacement) {
        return placement;
      }

      appliedSubstitutions.push({
        from: placement.assetId,
        placedAssetId: placement.id,
        to: replacement
      });

      return {
        ...placement,
        assetId: replacement
      };
    });
  const repairedPlan: MapPlan = MapPlanSchema.parse({
    ...input.plan,
    assetPlacements: placements,
    doors,
    lights,
    rooms: sanitizedRooms,
    walls
  });
  const validation = validatePlanSemantics(repairedPlan, input.context);

  return {
    appliedSubstitutions,
    plan: repairedPlan,
    remainingIssues: validation.issues,
    removed
  };
}

function dedupe<T extends { id: string }>(
  items: T[],
  removedIds: string[],
  seenIds: Set<string>
): T[] {
  const localSeen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (localSeen.has(item.id) || seenIds.has(item.id)) {
      removedIds.push(item.id);
      continue;
    }

    localSeen.add(item.id);
    seenIds.add(item.id);
    result.push(item);
  }

  return result;
}

function outOfBounds(value: number, max: number): boolean {
  return !Number.isFinite(value) || value < 0 || value > max;
}

function pushDuplicate(
  issues: SemanticIssue[],
  seenIds: Set<string>,
  id: string,
  path: string
): void {
  if (seenIds.has(id)) {
    issues.push({
      level: "error",
      message: `Duplicate id ${id} at ${path}.`,
      path,
      type: "duplicate_id"
    });
    return;
  }

  seenIds.add(id);
}

export function listRoomLabels(
  plan: MapPlan
): Array<{ id: string; label: string }> {
  return plan.rooms.map((room: RoomNode) => ({
    id: room.id,
    label: room.label
  }));
}
