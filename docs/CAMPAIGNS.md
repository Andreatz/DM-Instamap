# Campaigns

Campaigns group local projects (maps) and a per-session timeline. The feature is
intentionally scoped for a single DM's personal usage: no sync, no sharing.

## Schema

`packages/core/src/campaign.ts` defines:

```ts
Campaign = {
  id: string,
  name: string,
  description?: string,
  tags: string[],
  createdAt: ISODate,
  updatedAt: ISODate,
  maps: CampaignMapLink[],     // { projectId, role, notes }
  sessions: CampaignSession[]  // { id, title, date, notes, mapProjectIds[] }
}
```

`createCampaign(input)` returns a Zod-validated `Campaign`.

## Storage layout

```txt
data/campaigns/<campaignId>/campaign.json
```

The `apps/web/src/lib/campaigns.ts` module wraps `read`, `list`, `write`,
`update`, and `delete` operations against this directory.

## API

- `GET /api/campaigns` - list with map / session counts.
- `POST /api/campaigns` - body `{ "name": "...", "description": "...", "tags": [...] }`.
- `GET /api/campaigns/[id]` - full payload.
- `PUT /api/campaigns/[id]` - overwrite maps/sessions/description.

## UI

- `/campaigns` lists existing campaigns and exposes a creation form.
- `/campaigns/[id]` shows linked maps and a sessions timeline.

## CLI

```bash
pnpm campaigns:list
pnpm campaigns:create --name "Whispering Woods" --tags hex-crawl,wilderness
```

Campaigns created from the CLI immediately appear in `/campaigns`.
