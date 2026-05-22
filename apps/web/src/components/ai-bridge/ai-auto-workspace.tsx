"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapPlan } from "@dm-instamap/core/browser";
import type { AssetGroupView } from "@/lib/asset-groups";
import type { ReferenceMapView } from "@/lib/references";
import { toBridgeAssetGroup, toBridgeReference } from "@/lib/bridge-mappers";

type AiAutoWorkspaceProps = {
  assetGroups: AssetGroupView[];
  references: ReferenceMapView[];
};

type AiStatus =
  | { enabled: false; mode: "manual-only"; reason?: string }
  | {
      enabled: true;
      mode: "api";
      model?: string;
      provider: "anthropic" | "openai";
    };

type PlanResult = {
  attempts: number;
  errors?: string[];
  ok: boolean;
  plan?: MapPlan;
  providerId?: string;
  rawResponses?: string[];
};

type BlueprintResult = {
  attempts: number;
  blueprint?: {
    globalTags: string[];
    mood: string;
    name: string;
    rooms: Array<{ label: string; purpose: string; tacticalRole: string }>;
    scale: string;
    structure: string;
    theme: string;
  };
  errors?: string[];
  ok: boolean;
};

export function AiAutoWorkspace({
  assetGroups,
  references
}: AiAutoWorkspaceProps) {
  const router = useRouter();
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [request, setRequest] = useState(
    "Cripta sotto la cattedrale. I morti sono vincolati, non ostili. Sei stanze."
  );
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [blueprintResult, setBlueprintResult] =
    useState<BlueprintResult | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [status, setStatus] = useState("");
  const groupSummaries = useMemo(
    () => assetGroups.map(toBridgeAssetGroup),
    [assetGroups]
  );
  const referenceSummaries = useMemo(
    () => references.map(toBridgeReference),
    [references]
  );

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/ai/status");
        const payload = (await response.json()) as { status?: AiStatus };
        setAiStatus(payload.status ?? null);
      } catch {
        setAiStatus(null);
      }
    })();
  }, []);

  async function runBlueprint() {
    setBlueprintBusy(true);
    setStatus("Chiamata AI per blueprint narrativo...");

    try {
      const response = await fetch("/api/ai/blueprint", {
        body: JSON.stringify({ request }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as BlueprintResult;
      setBlueprintResult(payload);
      setStatus(payload.ok ? "Blueprint ricevuto." : "Blueprint fallito.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Blueprint fallito.");
    } finally {
      setBlueprintBusy(false);
    }
  }

  async function runPlan() {
    setPlanBusy(true);
    setStatus("Chiamata AI per piano mappa...");
    setPlanResult(null);

    try {
      const response = await fetch("/api/ai/plan", {
        body: JSON.stringify({
          assetGroups: groupSummaries,
          references: referenceSummaries,
          userRequest: request
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as PlanResult;
      setPlanResult(payload);
      setStatus(
        payload.ok
          ? `Piano ricevuto in ${payload.attempts} tentativi.`
          : "Piano fallito."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Piano fallito.");
    } finally {
      setPlanBusy(false);
    }
  }

  async function importPlanAsProject() {
    if (!planResult?.plan) {
      return;
    }

    setImportBusy(true);
    setStatus("Importazione piano AI in un nuovo progetto locale...");

    try {
      const response = await fetch("/api/ai-bridge/import", {
        body: JSON.stringify({
          autoRepair: true,
          mode: "new-project",
          plan: planResult.plan,
          projectName: planResult.plan.name || "Piano AI",
          sourceRequest: request
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        project?: { id: string };
      };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Importazione fallita.");
      }

      router.push(`/projects/${payload.project.id}/editor`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Importazione fallita."
      );
    } finally {
      setImportBusy(false);
    }
  }

  const disabled = aiStatus?.enabled !== true;

  return (
    <section className="asset-details">
      <h2>Modalita AI automatica (D1)</h2>
      <p className="muted">
        Chiama direttamente il provider configurato (senza copia/incolla
        manuale). Configura con variabili ambiente:{" "}
        <code>AI_PROVIDER=anthropic|openai</code>, <code>AI_API_KEY=...</code>,
        optional <code>AI_MODEL</code>.
      </p>

      <div className="manifest-note">
        {aiStatus === null ? <span>Caricamento stato...</span> : null}
        {aiStatus?.enabled ? (
          <>
            <span className="pill">provider: {aiStatus.provider}</span>
            {aiStatus.model ? (
              <span className="pill">modello: {aiStatus.model}</span>
            ) : null}
          </>
        ) : null}
        {aiStatus && !aiStatus.enabled ? (
          <span className="pill">
            disattivato: {aiStatus.reason ?? "config env mancante"}
          </span>
        ) : null}
        <span className="pill">{groupSummaries.length} gruppi asset</span>
        <span className="pill">{referenceSummaries.length} riferimenti</span>
      </div>

      <label className="field">
        <span>Richiesta</span>
        <textarea
          onChange={(event) => setRequest(event.target.value)}
          rows={4}
          value={request}
        />
      </label>

      <div className="field-row">
        <button
          className="save-correction"
          disabled={disabled || blueprintBusy || request.trim().length === 0}
          onClick={() => void runBlueprint()}
          type="button"
        >
          {blueprintBusy ? "Esecuzione..." : "Genera blueprint"}
        </button>
        <button
          className="save-correction"
          disabled={disabled || planBusy || request.trim().length === 0}
          onClick={() => void runPlan()}
          type="button"
        >
          {planBusy ? "Esecuzione..." : "Genera piano mappa"}
        </button>
      </div>

      {blueprintResult ? (
        <section className="detail-block">
          <h3>Blueprint</h3>
          {blueprintResult.ok && blueprintResult.blueprint ? (
            <>
              <p>
                <strong>{blueprintResult.blueprint.name}</strong> - struttura{" "}
                {blueprintResult.blueprint.structure}, scala{" "}
                {blueprintResult.blueprint.scale}, mood{" "}
                {blueprintResult.blueprint.mood}.
              </p>
              <div className="tag-list">
                {blueprintResult.blueprint.globalTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <ul>
                {blueprintResult.blueprint.rooms.map((room, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: anteprima statica, le stanze del blueprint non vengono riordinate
                  <li key={`${room.label}-${index}`}>
                    <strong>{room.label}</strong>{" "}
                    <span className="muted">({room.tacticalRole})</span>
                    <p>{room.purpose}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul>
              {(blueprintResult.errors ?? []).map((message, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lista di errori statica e di sola lettura
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {planResult ? (
        <section className="detail-block">
          <h3>Piano mappa</h3>
          {planResult.ok && planResult.plan ? (
            <>
              <p>
                Piano <strong>{planResult.plan.name}</strong> -{" "}
                {planResult.plan.rooms.length} stanze,{" "}
                {planResult.plan.walls.length} muri,{" "}
                {planResult.plan.doors.length} porte. Provider:{" "}
                {planResult.providerId}.
              </p>
              <button
                className="save-correction"
                disabled={importBusy}
                onClick={() => void importPlanAsProject()}
                type="button"
              >
                {importBusy ? "Importazione..." : "Importa come nuovo progetto"}
              </button>
            </>
          ) : (
            <ul>
              {(planResult.errors ?? []).map((message, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lista di errori statica e di sola lettura
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {status ? <p>{status}</p> : null}
    </section>
  );
}
