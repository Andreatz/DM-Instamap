import { z } from "zod";

const IdSchema = z.string().trim().min(1);
const NameSchema = z.string().trim().min(1);
const TagsSchema = z.array(z.string().trim().min(1)).default([]);
const TimestampSchema = z.string().datetime();

export const CampaignMapLinkSchema = z
  .object({
    documentId: IdSchema,
    label: z.string().trim().min(1).max(120),
    notes: z.string().trim().max(2000).optional(),
    projectId: IdSchema,
    tags: TagsSchema
  })
  .strict();

export type CampaignMapLink = z.infer<typeof CampaignMapLinkSchema>;

export const CampaignSessionSchema = z
  .object({
    date: z.string().trim().min(1).max(40),
    id: IdSchema,
    mapDocumentIds: z.array(IdSchema).default([]),
    summary: z.string().trim().max(2000).optional(),
    title: z.string().trim().min(1).max(160)
  })
  .strict();

export type CampaignSession = z.infer<typeof CampaignSessionSchema>;

export const CampaignSchema = z
  .object({
    createdAt: TimestampSchema.optional(),
    description: z.string().trim().max(2000).optional(),
    id: IdSchema,
    maps: z.array(CampaignMapLinkSchema).default([]),
    name: NameSchema,
    sessions: z.array(CampaignSessionSchema).default([]),
    tags: TagsSchema,
    updatedAt: TimestampSchema.optional(),
    version: z.literal(1)
  })
  .strict();

export type Campaign = z.infer<typeof CampaignSchema>;

export type CreateCampaignInput = {
  description?: string;
  id: string;
  maps?: CampaignMapLink[];
  name: string;
  sessions?: CampaignSession[];
  tags?: string[];
};

export function createCampaign(input: CreateCampaignInput): Campaign {
  const now = new Date().toISOString();

  return CampaignSchema.parse({
    createdAt: now,
    description: input.description,
    id: input.id,
    maps: input.maps ?? [],
    name: input.name,
    sessions: input.sessions ?? [],
    tags: input.tags ?? [],
    updatedAt: now,
    version: 1
  });
}
