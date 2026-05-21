export type UiSmokeFlow = {
  coveredBy: string[];
  critical: boolean;
  id: string;
  localOnly: true;
  name: string;
  requiresExternalApi: false;
  route: `/${string}`;
};

export const UI_SMOKE_FLOWS: UiSmokeFlow[] = [
  {
    coveredBy: ["apps/web/src/lib/starter-project.test.ts"],
    critical: true,
    id: "home-loads",
    localOnly: true,
    name: "Home e stato progetto locale",
    requiresExternalApi: false,
    route: "/"
  },
  {
    coveredBy: ["apps/web/src/lib/projects.test.ts", "apps/web/src/app/api/projects/route.test.ts"],
    critical: true,
    id: "create-project-wizard",
    localOnly: true,
    name: "Creazione progetto da wizard",
    requiresExternalApi: false,
    route: "/projects/new"
  },
  {
    coveredBy: ["apps/web/src/components/generate/dungeon-generator-preview.test.ts"],
    critical: true,
    id: "generate-preview",
    localOnly: true,
    name: "Anteprima generatore con debug qualita",
    requiresExternalApi: false,
    route: "/generate"
  },
  {
    coveredBy: ["apps/web/src/lib/map-editor.test.ts", "apps/web/src/lib/projects.test.ts"],
    critical: true,
    id: "editor-save-reopen",
    localOnly: true,
    name: "Editor salva e riapre documento",
    requiresExternalApi: false,
    route: "/projects/[projectId]/editor"
  },
  {
    coveredBy: [
      "apps/web/src/lib/projects.test.ts",
      "apps/web/src/app/api/projects/[projectId]/snapshots/[contentHash]/diff/route.test.ts"
    ],
    critical: true,
    id: "snapshots-diff-restore",
    localOnly: true,
    name: "Snapshot, diff e restore",
    requiresExternalApi: false,
    route: "/projects/[projectId]"
  },
  {
    coveredBy: ["packages/exporters/tests/exporters.test.ts"],
    critical: true,
    id: "export-session-pack",
    localOnly: true,
    name: "Export pagina progetto e Session Pack",
    requiresExternalApi: false,
    route: "/projects/[projectId]/export"
  },
  {
    coveredBy: ["apps/web/src/app/api/campaigns/route.test.ts"],
    critical: false,
    id: "campaigns-open",
    localOnly: true,
    name: "Pagina campagne e aggregazione mappe",
    requiresExternalApi: false,
    route: "/campaigns"
  },
  {
    coveredBy: ["apps/web/src/lib/asset-browser.test.ts"],
    critical: true,
    id: "asset-browser-empty-manifest",
    localOnly: true,
    name: "Asset browser senza manifest",
    requiresExternalApi: false,
    route: "/assets"
  },
  {
    coveredBy: ["apps/web/src/lib/references.test.ts", "apps/web/src/lib/reference-review.test.ts"],
    critical: false,
    id: "references-review",
    localOnly: true,
    name: "Reference browser e review metadata",
    requiresExternalApi: false,
    route: "/references"
  },
  {
    coveredBy: ["apps/web/src/lib/ai-bridge-import.test.ts", "apps/web/src/app/api/ai/blueprint/route.test.ts"],
    critical: false,
    id: "manual-ai-bridge",
    localOnly: true,
    name: "AI Bridge manuale senza provider remoto",
    requiresExternalApi: false,
    route: "/ai-bridge"
  }
];

export function validateUiSmokeFlows(flows: UiSmokeFlow[] = UI_SMOKE_FLOWS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const flow of flows) {
    if (ids.has(flow.id)) {
      errors.push(`Flow duplicato: ${flow.id}`);
    }

    ids.add(flow.id);

    if (!flow.route.startsWith("/")) {
      errors.push(`Route non locale per ${flow.id}: ${flow.route}`);
    }

    if (flow.requiresExternalApi) {
      errors.push(`Flow ${flow.id} richiede una API esterna.`);
    }

    if (flow.coveredBy.length === 0) {
      errors.push(`Flow ${flow.id} non dichiara test di copertura.`);
    }
  }

  if (flows.length < 8) {
    errors.push("Servono almeno 8 flussi UI principali coperti.");
  }

  return errors;
}
