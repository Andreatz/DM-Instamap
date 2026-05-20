"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapPlan } from "@dm-instamap/core";

type AiStatus =
  | { enabled: false; mode: "manual-only"; reason?: string }
  | { enabled: true; mode: "api"; model?: string; provider: "anthropic" | "openai" };

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

export function AiAutoWorkspace() {
  const router = useRouter();
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [request, setRequest] = useState(
    "Crypt below the cathedral. The dead are bound, not hostile. Six rooms."
  );
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [blueprintResult, setBlueprintResult] = useState<BlueprintResult | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [status, setStatus] = useState("");

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
    setStatus("Calling AI for narrative blueprint…");

    try {
      const response = await fetch("/api/ai/blueprint", {
        body: JSON.stringify({ request }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as BlueprintResult;
      setBlueprintResult(payload);
      setStatus(payload.ok ? "Blueprint received." : "Blueprint failed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Blueprint failed.");
    } finally {
      setBlueprintBusy(false);
    }
  }

  async function runPlan() {
    setPlanBusy(true);
    setStatus("Calling AI for map plan…");
    setPlanResult(null);

    try {
      const response = await fetch("/api/ai/plan", {
        body: JSON.stringify({
          assetGroups: [],
          references: [],
          userRequest: request
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as PlanResult;
      setPlanResult(payload);
      setStatus(payload.ok ? `Plan received in ${payload.attempts} attempts.` : "Plan failed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Plan failed.");
    } finally {
      setPlanBusy(false);
    }
  }

  async function importPlanAsProject() {
    if (!planResult?.plan) {
      return;
    }

    setImportBusy(true);
    setStatus("Importing AI plan into a new local project…");

    try {
      const response = await fetch("/api/ai-bridge/import", {
        body: JSON.stringify({
          autoRepair: true,
          mode: "new-project",
          plan: planResult.plan,
          projectName: planResult.plan.name || "AI Plan",
          sourceRequest: request
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string; project?: { id: string } };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Import failed.");
      }

      router.push(`/projects/${payload.project.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImportBusy(false);
    }
  }

  const disabled = aiStatus?.enabled !== true;

  return (
    <section className="asset-details">
      <h2>AI Auto Mode (D1)</h2>
      <p className="muted">
        Calls the configured provider directly (no manual copy/paste). Configure with environment variables:{" "}
        <code>AI_PROVIDER=anthropic|openai</code>, <code>AI_API_KEY=...</code>, optional <code>AI_MODEL</code>.
      </p>

      <div className="manifest-note">
        {aiStatus === null ? <span>Loading status…</span> : null}
        {aiStatus?.enabled ? (
          <>
            <span className="pill">provider: {aiStatus.provider}</span>
            {aiStatus.model ? <span className="pill">model: {aiStatus.model}</span> : null}
          </>
        ) : null}
        {aiStatus && !aiStatus.enabled ? (
          <span className="pill">disabled — {aiStatus.reason ?? "no env config"}</span>
        ) : null}
      </div>

      <label className="field">
        <span>Request</span>
        <textarea onChange={(event) => setRequest(event.target.value)} rows={4} value={request} />
      </label>

      <div className="field-row">
        <button
          className="save-correction"
          disabled={disabled || blueprintBusy || request.trim().length === 0}
          onClick={() => void runBlueprint()}
          type="button"
        >
          {blueprintBusy ? "Running…" : "Generate Blueprint"}
        </button>
        <button
          className="save-correction"
          disabled={disabled || planBusy || request.trim().length === 0}
          onClick={() => void runPlan()}
          type="button"
        >
          {planBusy ? "Running…" : "Generate Map Plan"}
        </button>
      </div>

      {blueprintResult ? (
        <section className="detail-block">
          <h3>Blueprint</h3>
          {blueprintResult.ok && blueprintResult.blueprint ? (
            <>
              <p>
                <strong>{blueprintResult.blueprint.name}</strong> — structure {blueprintResult.blueprint.structure},
                scale {blueprintResult.blueprint.scale}, mood {blueprintResult.blueprint.mood}.
              </p>
              <div className="tag-list">
                {blueprintResult.blueprint.globalTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <ul>
                {blueprintResult.blueprint.rooms.map((room, index) => (
                  <li key={`${room.label}-${index}`}>
                    <strong>{room.label}</strong> <span className="muted">({room.tacticalRole})</span>
                    <p>{room.purpose}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul>
              {(blueprintResult.errors ?? []).map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {planResult ? (
        <section className="detail-block">
          <h3>Map Plan</h3>
          {planResult.ok && planResult.plan ? (
            <>
              <p>
                Plan <strong>{planResult.plan.name}</strong> — {planResult.plan.rooms.length} rooms,{" "}
                {planResult.plan.walls.length} walls, {planResult.plan.doors.length} doors. Provider:{" "}
                {planResult.providerId}.
              </p>
              <button
                className="save-correction"
                disabled={importBusy}
                onClick={() => void importPlanAsProject()}
                type="button"
              >
                {importBusy ? "Importing…" : "Import as New Project"}
              </button>
            </>
          ) : (
            <ul>
              {(planResult.errors ?? []).map((message, index) => (
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
