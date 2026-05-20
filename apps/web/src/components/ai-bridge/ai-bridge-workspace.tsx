"use client";

import { useMemo, useState } from "react";
import {
  buildChatGptBridgePrompt,
  buildPromptPacket,
  buildRepairPrompt,
  repairPlanLocally,
  searchBridgeContext,
  validateBridgeResponse,
  validatePlanSemantics,
  type BridgeAssetGroupSummary,
  type BridgeAssetSearchSummary,
  type BridgeReferenceSummary,
  type MissingAssetReport,
  type SemanticIssue
} from "@dm-instamap/ai-bridge";
import type { AssetGroupView } from "@/lib/asset-groups";
import type { AssetSearchApiResult } from "@/lib/asset-search";
import type { ReferenceMapView } from "@/lib/references";

type AiBridgeWorkspaceProps = {
  assetGroups: AssetGroupView[];
  references: ReferenceMapView[];
};

type ImportMode = "new-project" | "update-project";

type ImportResponse = {
  error?: string;
  errors?: string[];
  issues?: SemanticIssue[];
  missingAssets?: MissingAssetReport[];
  ok: boolean;
  project?: { id: string; name: string };
};

export function AiBridgeWorkspace({ assetGroups, references }: AiBridgeWorkspaceProps) {
  const [userRequest, setUserRequest] = useState(
    "Create a crypt dungeon with an entrance, chapel, library, treasure room, and boss room."
  );
  const [pastedResponse, setPastedResponse] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState<AssetSearchApiResult[]>([]);
  const [status, setStatus] = useState("Manual bridge ready");
  const [importMode, setImportMode] = useState<ImportMode>("new-project");
  const [importProjectId, setImportProjectId] = useState("");
  const [importedProjectId, setImportedProjectId] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<SemanticIssue[]>([]);
  const [importMissing, setImportMissing] = useState<MissingAssetReport[]>([]);
  const [autoRepair, setAutoRepair] = useState(true);
  const [busy, setBusy] = useState(false);
  const groupSummaries = useMemo(() => assetGroups.map(toBridgeAssetGroup), [assetGroups]);
  const referenceSummaries = useMemo(() => references.map(toBridgeReference), [references]);
  const searchSummaries = useMemo(() => assetSearchResults.map(toBridgeAssetSearchResult), [assetSearchResults]);
  const knownAssetIds = useMemo(() => collectKnownAssetIds(assetGroups), [assetGroups]);
  const context = useMemo(
    () =>
      searchBridgeContext({
        assetGroups: groupSummaries,
        assetSearchResults: searchSummaries,
        references: referenceSummaries,
        userRequest
      }),
    [groupSummaries, referenceSummaries, searchSummaries, userRequest]
  );
  const prompt = useMemo(
    () =>
      buildChatGptBridgePrompt({
        assetGroups: groupSummaries,
        assetSearchResults: searchSummaries,
        references: referenceSummaries,
        userRequest
      }),
    [groupSummaries, referenceSummaries, searchSummaries, userRequest]
  );
  const promptPacket = useMemo(
    () =>
      buildPromptPacket({
        assetGroups: groupSummaries,
        assetSearchResults: searchSummaries,
        references: referenceSummaries,
        userRequest
      }),
    [groupSummaries, referenceSummaries, searchSummaries, userRequest]
  );
  const validation = useMemo(() => validateBridgeResponse(pastedResponse), [pastedResponse]);
  const semantic = useMemo(() => {
    if (!validation.ok) {
      return null;
    }

    return validatePlanSemantics(validation.data, {
      assetGroups: groupSummaries,
      assetSearchResults: searchSummaries,
      knownAssetIds
    });
  }, [validation, groupSummaries, searchSummaries, knownAssetIds]);
  const repairPreview = useMemo(() => {
    if (!validation.ok || !semantic || semantic.ok) {
      return null;
    }

    return repairPlanLocally({
      context: {
        assetGroups: groupSummaries,
        assetSearchResults: searchSummaries,
        knownAssetIds
      },
      plan: validation.data
    });
  }, [validation, semantic, groupSummaries, searchSummaries, knownAssetIds]);
  const repairPrompt = useMemo(
    () =>
      validation.ok
        ? ""
        : buildRepairPrompt({
            errors: validation.errors,
            originalPrompt: prompt,
            pastedResponse
          }),
    [pastedResponse, prompt, validation]
  );

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied`);
  }

  function downloadPacket() {
    const blob = new Blob([promptPacket], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "dm-instamap-prompt-packet.md";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Prompt packet downloaded");
  }

  async function searchLocalAssetsForPrompt() {
    const query = userRequest.trim();

    if (!query) {
      setAssetSearchResults([]);
      setStatus("Write a request before searching local assets");
      return;
    }

    setStatus("Searching local assets for prompt");

    try {
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}&limit=8`);
      const payload = (await response.json()) as { results?: AssetSearchApiResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Local asset search failed");
      }

      setAssetSearchResults(payload.results ?? []);
      setStatus(`${payload.results?.length ?? 0} local assets added to prompt context`);
    } catch (error) {
      setAssetSearchResults([]);
      setStatus(error instanceof Error ? error.message : "Local asset search failed");
    }
  }

  async function importPlan() {
    if (!validation.ok) {
      setStatus("Fix JSON validation errors before importing");
      return;
    }

    if (importMode === "update-project" && !importProjectId.trim()) {
      setStatus("Provide a project id to update");
      return;
    }

    setBusy(true);
    setStatus(importMode === "new-project" ? "Creating project" : "Updating project");

    try {
      const response = await fetch("/api/ai-bridge/import-plan", {
        body: JSON.stringify({
          applyAutoRepair: autoRepair,
          mode: importMode,
          projectId: importMode === "update-project" ? importProjectId.trim() : undefined,
          response: pastedResponse,
          sourceRequest: userRequest,
          userRequest
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as ImportResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.error ?? payload.errors?.join("; ") ?? "Import failed";
        throw new Error(message);
      }

      setImportedProjectId(payload.project?.id ?? null);
      setImportIssues(payload.issues ?? []);
      setImportMissing(payload.missingAssets ?? []);
      setStatus(`Plan imported into ${payload.project?.name ?? "project"} (${payload.project?.id ?? ""})`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bridge-shell" aria-label="Manual ChatGPT bridge">
      <section className="asset-filters bridge-request-panel">
        <h2>Request</h2>
        <label className="field">
          <span>Map request</span>
          <textarea
            className="bridge-textarea bridge-request"
            onChange={(event) => setUserRequest(event.target.value)}
            value={userRequest}
          />
        </label>

        <section className="detail-block">
          <h3>Local Context</h3>
          <p>{context.assetGroups.length} asset groups selected</p>
          <p>{context.assetSearchResults.length} searched assets selected</p>
          <p>{context.references.length} references selected</p>
          <button onClick={searchLocalAssetsForPrompt} type="button">
            Search Local Assets
          </button>
        </section>

        <section className="bridge-context-list">
          <h3>Asset Groups</h3>
          {context.assetGroups.map((group) => (
            <article key={group.id}>
              <strong>{group.name}</strong>
              <span>
                {group.kind} - {group.assetCount} assets
              </span>
            </article>
          ))}
        </section>

        <section className="bridge-context-list">
          <h3>Asset Search</h3>
          {context.assetSearchResults.map((result) => (
            <article key={result.assetId}>
              <strong>{result.relativePath}</strong>
              <span>
                {result.classification} - {Math.round(result.score * 100)}% - {result.reason}
              </span>
            </article>
          ))}
        </section>

        <section className="bridge-context-list">
          <h3>References</h3>
          {context.references.map((reference) => (
            <article key={reference.id}>
              <strong>{reference.path}</strong>
              <span>{reference.mapType}</span>
            </article>
          ))}
        </section>
      </section>

      <section className="bridge-main-panel">
        <section className="asset-details bridge-prompt-panel">
          <header className="bridge-panel-header">
            <h2>Prompt</h2>
            <div className="bridge-action-row">
              <button onClick={() => copyText(prompt, "Prompt")} type="button">
                Copy Prompt
              </button>
              <button onClick={() => copyText(promptPacket, "Prompt packet")} type="button">
                Copy Packet (.md)
              </button>
              <button onClick={downloadPacket} type="button">
                Download Packet
              </button>
            </div>
          </header>
          <textarea className="bridge-textarea bridge-prompt" readOnly value={prompt} />
        </section>

        <section className="asset-details bridge-response-panel">
          <header className="bridge-panel-header">
            <h2>Response Validation</h2>
            <span className={validation.ok ? "bridge-valid" : "bridge-invalid"}>
              {pastedResponse.trim() ? (validation.ok ? "Valid MapPlan JSON" : "Invalid JSON") : "Waiting for paste"}
            </span>
          </header>
          <textarea
            className="bridge-textarea bridge-response"
            onChange={(event) => setPastedResponse(event.target.value)}
            placeholder="Paste ChatGPT JSON response here"
            spellCheck={false}
            value={pastedResponse}
          />

          {pastedResponse.trim() && !validation.ok ? (
            <section className="bridge-errors">
              <h3>Schema Errors</h3>
              <ul>
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {validation.ok && semantic ? (
            <section className="bridge-valid-summary">
              <h3>Parsed Plan</h3>
              <p>
                {validation.data.name} - {validation.data.rooms.length} rooms,{" "}
                {validation.data.assetPlacements.length} placements
              </p>
              {semantic.ok ? (
                <p className="bridge-valid">No semantic issues detected.</p>
              ) : (
                <section className="bridge-semantic">
                  <h4>Semantic Issues</h4>
                  <ul>
                    {semantic.issues.map((issue) => (
                      <li key={`${issue.path}:${issue.message}`}>
                        <strong>{issue.level === "error" ? "Error" : "Warning"}</strong> [{issue.type}]: {issue.message}
                      </li>
                    ))}
                  </ul>
                  {semantic.missingAssets.length > 0 ? (
                    <section className="bridge-missing-assets">
                      <h4>Missing Asset Suggestions</h4>
                      {semantic.missingAssets.map((report) => (
                        <article key={report.assetId}>
                          <strong>{report.assetId}</strong>
                          <ul>
                            {report.suggestions.map((suggestion) => (
                              <li key={suggestion.suggestionId}>
                                {suggestion.suggestionId} — {suggestion.reason}
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </section>
                  ) : null}
                  {repairPreview ? (
                    <p>
                      Local auto-repair would remove {repairPreview.removed.invalidWalls.length} invalid walls,{" "}
                      {repairPreview.removed.outOfBoundsDoors.length} doors, and apply{" "}
                      {repairPreview.appliedSubstitutions.length} asset substitutions.
                    </p>
                  ) : null}
                </section>
              )}
            </section>
          ) : null}

          {validation.ok ? (
            <section className="bridge-import">
              <h3>Import Plan Into Project</h3>
              <label className="field">
                <span>Mode</span>
                <select onChange={(event) => setImportMode(event.target.value as ImportMode)} value={importMode}>
                  <option value="new-project">Create New Project</option>
                  <option value="update-project">Update Existing Project</option>
                </select>
              </label>
              {importMode === "update-project" ? (
                <label className="field">
                  <span>Project Id</span>
                  <input
                    onChange={(event) => setImportProjectId(event.target.value)}
                    placeholder="e.g. crypt-under-the-cathedral"
                    value={importProjectId}
                  />
                </label>
              ) : null}
              <label className="editor-checkbox">
                <input checked={autoRepair} onChange={(event) => setAutoRepair(event.target.checked)} type="checkbox" />
                <span>Apply local auto-repair before saving</span>
              </label>
              <button
                className="save-correction"
                disabled={busy || !validation.ok}
                onClick={importPlan}
                type="button"
              >
                {busy ? "Working..." : "Import Plan"}
              </button>
              {importedProjectId ? (
                <p>
                  Imported into <a href={`/projects/${importedProjectId}`}>{importedProjectId}</a>
                </p>
              ) : null}
              {importIssues.length > 0 ? (
                <section className="bridge-import-issues">
                  <h4>Residual Issues After Import</h4>
                  <ul>
                    {importIssues.map((issue) => (
                      <li key={`${issue.path}:${issue.message}`}>
                        [{issue.level}] {issue.message}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {importMissing.length > 0 ? (
                <section className="bridge-import-missing">
                  <h4>Missing Assets in Saved Plan</h4>
                  <ul>
                    {importMissing.map((report) => (
                      <li key={report.assetId}>
                        {report.assetId} — suggested:{" "}
                        {report.suggestions.map((suggestion) => suggestion.suggestionId).join(", ") || "no suggestions"}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </section>
          ) : null}

          {!validation.ok && pastedResponse.trim() ? (
            <section className="bridge-repair">
              <header className="bridge-panel-header">
                <h3>Repair Prompt</h3>
                <button onClick={() => copyText(repairPrompt, "Repair prompt")} type="button">
                  Copy Repair
                </button>
              </header>
              <textarea className="bridge-textarea bridge-repair-text" readOnly value={repairPrompt} />
            </section>
          ) : null}

          <p>{status}</p>
        </section>
      </section>
    </section>
  );
}

function toBridgeAssetSearchResult(result: AssetSearchApiResult): BridgeAssetSearchSummary {
  return {
    assetId: result.assetId,
    classification: result.classification,
    reason: result.reason,
    relativePath: result.relativePath,
    score: result.score,
    tags: result.tags
  };
}

function toBridgeAssetGroup(group: AssetGroupView): BridgeAssetGroupSummary {
  return {
    assetCount: group.assetCount,
    id: group.id,
    kind: group.kind,
    name: group.name,
    qualityScore: group.qualityScore,
    tags: group.tags,
    theme: group.theme,
    usableFor: group.usableFor
  };
}

function toBridgeReference(reference: ReferenceMapView): BridgeReferenceSummary {
  return {
    height: reference.height,
    id: reference.id,
    mapType: reference.mapType,
    mapTypeConfidence: reference.mapTypeConfidence,
    path: reference.path,
    styleDna: reference.styleDna
      ? {
          density: reference.styleDna.density,
          layoutTraits: reference.styleDna.layoutTraits,
          mood: reference.styleDna.mood,
          promptSummary: reference.styleDna.promptSummary,
          recommendedAssetTags: reference.styleDna.recommendedAssetTags,
          visualTags: reference.styleDna.visualTags
        }
      : null,
    tags: reference.tags,
    width: reference.width
  };
}

function collectKnownAssetIds(groups: AssetGroupView[]): string[] {
  const ids = new Set<string>();

  for (const group of groups) {
    ids.add(group.id);
    for (const assetId of group.assetIds ?? []) {
      ids.add(assetId);
    }
  }

  return [...ids];
}
