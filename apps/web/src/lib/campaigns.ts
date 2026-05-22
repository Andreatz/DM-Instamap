import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CampaignSchema,
  createCampaign,
  type Campaign
} from "@dm-instamap/core/server";
import { findWorkspaceRoot } from "./assets-manifest";
import { assertSafeWorkspaceId } from "./local-paths";

const CAMPAIGNS_DIR = path.join("data", "campaigns");
const CAMPAIGN_FILE = "campaign.json";

export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign not found: ${campaignId}`);
  }
}

export class InvalidCampaignIdError extends Error {
  constructor(campaignId: string) {
    super(`Invalid campaign id: ${campaignId}`);
  }
}

function isSafeCampaignId(id: string): boolean {
  // Shared workspace-id policy (traversal safety) + campaign slug rule.
  try {
    assertSafeWorkspaceId(id, "campaignId");
  } catch {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/iu.test(id);
}

export function createCampaignSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 56) || `campaign-${Date.now()}`
  );
}

export async function getCampaignsRoot(outputRoot?: string): Promise<string> {
  const workspaceRoot = outputRoot
    ? path.resolve(outputRoot)
    : await findWorkspaceRoot(process.cwd());
  return path.join(workspaceRoot, CAMPAIGNS_DIR);
}

export async function listCampaigns(outputRoot?: string): Promise<Campaign[]> {
  const root = await getCampaignsRoot(outputRoot);

  try {
    const entries = await readdir(root, { withFileTypes: true });
    const campaigns: Campaign[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      try {
        const raw = await readFile(
          path.join(root, entry.name, CAMPAIGN_FILE),
          "utf8"
        );
        const parsed = CampaignSchema.parse(JSON.parse(raw));
        campaigns.push(parsed);
      } catch {}
    }

    return campaigns.sort((left, right) =>
      (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "")
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function readCampaign(
  campaignId: string,
  outputRoot?: string
): Promise<Campaign> {
  if (!isSafeCampaignId(campaignId)) {
    throw new InvalidCampaignIdError(campaignId);
  }

  const root = await getCampaignsRoot(outputRoot);

  try {
    const raw = await readFile(
      path.join(root, campaignId, CAMPAIGN_FILE),
      "utf8"
    );
    return CampaignSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new CampaignNotFoundError(campaignId);
    }

    throw error;
  }
}

export type CreateCampaignBody = {
  description?: string;
  name: string;
  tags?: string[];
};

export async function createCampaignProject(
  body: CreateCampaignBody,
  outputRoot?: string
): Promise<Campaign> {
  const id = createCampaignSlug(body.name);

  if (!isSafeCampaignId(id)) {
    throw new InvalidCampaignIdError(id);
  }

  const campaign = createCampaign({
    description: body.description,
    id,
    name: body.name,
    tags: body.tags ?? []
  });
  const root = await getCampaignsRoot(outputRoot);
  await mkdir(path.join(root, id), { recursive: true });
  await writeFile(
    path.join(root, id, CAMPAIGN_FILE),
    `${JSON.stringify(campaign, null, 2)}\n`,
    "utf8"
  );
  return campaign;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<
    Pick<Campaign, "description" | "maps" | "name" | "sessions" | "tags">
  >,
  outputRoot?: string
): Promise<Campaign> {
  const current = await readCampaign(campaignId, outputRoot);
  const next: Campaign = CampaignSchema.parse({
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
    version: 1
  });
  const root = await getCampaignsRoot(outputRoot);
  await writeFile(
    path.join(root, campaignId, CAMPAIGN_FILE),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8"
  );
  return next;
}

export async function deleteCampaign(
  campaignId: string,
  outputRoot?: string
): Promise<void> {
  if (!isSafeCampaignId(campaignId)) {
    throw new InvalidCampaignIdError(campaignId);
  }

  const root = await getCampaignsRoot(outputRoot);
  await rm(path.join(root, campaignId), { force: true, recursive: true });
}
