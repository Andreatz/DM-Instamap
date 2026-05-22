import type { RoomNode } from "@dm-instamap/core";
import { ASSET_CLASSIFICATIONS, type AssetClassification } from "./classifier";

export type MatchableAssetGroup = {
  assetCount?: number;
  assetIds?: string[];
  id: string;
  kind?: string | null;
  name: string;
  qualityScore?: number | null;
  tags?: string[];
  theme?: string | null;
  themes?: string[];
  usableFor?: string[];
};

export type AssetMatchReason = {
  label: string;
  score: number;
  value: string;
};

export type AssetGroupMatch = {
  group: MatchableAssetGroup;
  reasons: AssetMatchReason[];
  score: number;
};

export type AssetMatcherInput = {
  groups: MatchableAssetGroup[];
  limit?: number;
  preferredKinds?: string[];
  room: RoomNode;
  theme?: string | null;
};

const DEFAULT_LIMIT = 6;
const SCORE_WEIGHTS = {
  kind: 0.34,
  quality: 0.12,
  tags: 0.26,
  theme: 0.18,
  usableFor: 0.1
} as const;

const ROOM_KIND_PREFERENCES: Record<RoomNode["kind"], AssetClassification[]> = {
  corridor: ["floor", "wall", "door", "light", "prop", "decoration"],
  entrance: ["door", "floor", "wall", "light", "prop", "decoration"],
  room: ["furniture", "prop", "decoration", "light", "floor", "terrain"],
  secret: ["door", "prop", "decoration", "wall", "light"],
  service: ["furniture", "prop", "floor", "wall", "light"],
  stairs: ["floor", "terrain", "prop", "wall", "decoration"]
};

export function matchAssetGroupsForRoom(
  input: AssetMatcherInput
): AssetGroupMatch[] {
  const limit = Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT));
  const preferredKinds = normalizeKinds(
    input.preferredKinds ?? inferPreferredKinds(input.room)
  );
  const roomTags = normalizeTokens([
    input.room.kind,
    input.room.label,
    ...input.room.tags
  ]);
  const roomTheme = normalizeToken(
    input.theme ?? findThemeInRoomTags(input.room.tags)
  );
  const roomUseTerms = normalizeTokens([
    input.room.kind,
    input.room.label,
    ...input.room.tags
  ]);

  return input.groups
    .map((group) =>
      scoreGroup({ group, preferredKinds, roomTags, roomTheme, roomUseTerms })
    )
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.group.qualityScore ?? 0) - (left.group.qualityScore ?? 0) ||
        left.group.name.localeCompare(right.group.name)
    )
    .slice(0, limit);
}

function scoreGroup(input: {
  group: MatchableAssetGroup;
  preferredKinds: AssetClassification[];
  roomTags: string[];
  roomTheme: string;
  roomUseTerms: string[];
}): AssetGroupMatch {
  const kind = normalizeKind(input.group.kind);
  const tags = normalizeTokens(input.group.tags ?? []);
  const themes = normalizeTokens([
    input.group.theme ?? "",
    ...(input.group.themes ?? []),
    ...tags
  ]);
  const usableFor = normalizeTokens(input.group.usableFor ?? []);
  const reasons: AssetMatchReason[] = [];

  const kindScore = scoreKind(kind, input.preferredKinds);
  if (kindScore > 0) {
    reasons.push({
      label: "kind",
      score: roundScore(kindScore * SCORE_WEIGHTS.kind),
      value: kind ? `${kind} fits this room` : "unknown kind fallback"
    });
  }

  const tagMatches = intersect(tags, input.roomTags);
  const tagScore =
    input.roomTags.length > 0
      ? Math.min(1, tagMatches.length / Math.min(4, input.roomTags.length))
      : 0;
  if (tagMatches.length > 0) {
    reasons.push({
      label: "tags",
      score: roundScore(tagScore * SCORE_WEIGHTS.tags),
      value: tagMatches.join(", ")
    });
  }

  const themeMatches = input.roomTheme
    ? intersect(themes, [input.roomTheme])
    : [];
  const themeScore = themeMatches.length > 0 ? 1 : 0;
  if (themeMatches.length > 0) {
    reasons.push({
      label: "theme",
      score: roundScore(themeScore * SCORE_WEIGHTS.theme),
      value: themeMatches.join(", ")
    });
  }

  const usableForMatches = intersect(usableFor, input.roomUseTerms);
  const usableForScore =
    input.roomUseTerms.length > 0
      ? Math.min(
          1,
          usableForMatches.length / Math.min(3, input.roomUseTerms.length)
        )
      : 0;
  if (usableForMatches.length > 0) {
    reasons.push({
      label: "usableFor",
      score: roundScore(usableForScore * SCORE_WEIGHTS.usableFor),
      value: usableForMatches.join(", ")
    });
  }

  const qualityScore = normalizeQualityScore(input.group.qualityScore);
  if (qualityScore > 0) {
    reasons.push({
      label: "quality",
      score: roundScore(qualityScore * SCORE_WEIGHTS.quality),
      value: `${Math.round(qualityScore * 100)}`
    });
  }

  return {
    group: input.group,
    reasons,
    score: roundScore(
      kindScore * SCORE_WEIGHTS.kind +
        tagScore * SCORE_WEIGHTS.tags +
        themeScore * SCORE_WEIGHTS.theme +
        usableForScore * SCORE_WEIGHTS.usableFor +
        qualityScore * SCORE_WEIGHTS.quality
    )
  };
}

function inferPreferredKinds(room: RoomNode): AssetClassification[] {
  const kinds = new Set<AssetClassification>(ROOM_KIND_PREFERENCES[room.kind]);
  const tags = normalizeTokens(room.tags);

  if (tags.some((tag) => tag === "boss" || tag === "final")) {
    for (const kind of ["furniture", "decoration", "light", "prop"] as const) {
      kinds.add(kind);
    }
  }

  if (tags.some((tag) => tag === "library" || tag === "study")) {
    for (const kind of ["furniture", "decoration", "prop"] as const) {
      kinds.add(kind);
    }
  }

  return [...kinds];
}

function scoreKind(
  kind: AssetClassification | null,
  preferredKinds: AssetClassification[]
): number {
  if (!kind) {
    return 0;
  }

  if (preferredKinds.includes(kind)) {
    const index = preferredKinds.indexOf(kind);
    return Math.max(0.45, 1 - index * 0.1);
  }

  return kind === "unknown" ? 0.05 : 0;
}

function findThemeInRoomTags(tags: string[]): string {
  const ignored = new Set([
    "room",
    "entrance",
    "final",
    "boss",
    "corridor",
    "connects"
  ]);
  return (
    normalizeTokens(tags).find(
      (tag) => !ignored.has(tag) && !tag.startsWith("connects")
    ) ?? ""
  );
}

function normalizeKinds(values: string[]): AssetClassification[] {
  return values
    .map(normalizeKind)
    .filter((value): value is AssetClassification => value !== null);
}

function normalizeKind(
  value: string | null | undefined
): AssetClassification | null {
  const normalized = normalizeToken(value ?? "");
  return ASSET_CLASSIFICATIONS.includes(normalized as AssetClassification)
    ? (normalized as AssetClassification)
    : null;
}

function normalizeTokens(values: string[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(/[^a-z0-9]+/iu).map(normalizeToken))
        .filter(Boolean)
    )
  ];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeQualityScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value > 1 ? value / 100 : value));
}

function intersect(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function roundScore(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(3));
}
