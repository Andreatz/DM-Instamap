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
  type BridgeAssetSearchSummary,
  type MissingAssetReport,
  type SemanticIssue
} from "@dm-instamap/ai-bridge";
import type { AssetGroupView } from "@/lib/asset-groups";
import type { AssetSearchApiResult } from "@/lib/asset-search";
import type { ReferenceMapView } from "@/lib/references";
import { toBridgeAssetGroup, toBridgeReference } from "@/lib/bridge-mappers";

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

export function AiBridgeWorkspace({
  assetGroups,
  references
}: AiBridgeWorkspaceProps) {
  const [userRequest, setUserRequest] = useState(
    "Crea un dungeon cripta con ingresso, cappella, biblioteca, sala del tesoro e stanza del boss."
  );
  const [pastedResponse, setPastedResponse] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState<
    AssetSearchApiResult[]
  >([]);
  const [status, setStatus] = useState("Bridge manuale pronto");
  const [importMode, setImportMode] = useState<ImportMode>("new-project");
  const [importProjectId, setImportProjectId] = useState("");
  const [importedProjectId, setImportedProjectId] = useState<string | null>(
    null
  );
  const [importIssues, setImportIssues] = useState<SemanticIssue[]>([]);
  const [importMissing, setImportMissing] = useState<MissingAssetReport[]>([]);
  const [autoRepair, setAutoRepair] = useState(true);
  const [busy, setBusy] = useState(false);
  const groupSummaries = useMemo(
    () => assetGroups.map(toBridgeAssetGroup),
    [assetGroups]
  );
  const referenceSummaries = useMemo(
    () => references.map(toBridgeReference),
    [references]
  );
  const searchSummaries = useMemo(
    () => assetSearchResults.map(toBridgeAssetSearchResult),
    [assetSearchResults]
  );
  const knownAssetIds = useMemo(
    () => collectKnownAssetIds(assetGroups),
    [assetGroups]
  );
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
  const validation = useMemo(
    () => validateBridgeResponse(pastedResponse),
    [pastedResponse]
  );
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
    setStatus(`${label} copiato`);
  }

  function downloadPacket() {
    const blob = new Blob([promptPacket], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "dm-instamap-prompt-packet.md";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Pacchetto prompt scaricato");
  }

  async function searchLocalAssetsForPrompt() {
    const query = userRequest.trim();

    if (!query) {
      setAssetSearchResults([]);
      setStatus("Scrivi una richiesta prima di cercare asset locali");
      return;
    }

    setStatus("Ricerca asset locali per il prompt");

    try {
      const response = await fetch(
        `/api/assets/search?q=${encodeURIComponent(query)}&limit=8`
      );
      const payload = (await response.json()) as {
        results?: AssetSearchApiResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ricerca asset locale fallita");
      }

      setAssetSearchResults(payload.results ?? []);
      setStatus(
        `${payload.results?.length ?? 0} asset locali aggiunti al contesto prompt`
      );
    } catch (error) {
      setAssetSearchResults([]);
      setStatus(
        error instanceof Error ? error.message : "Ricerca asset locale fallita"
      );
    }
  }

  async function importPlan() {
    if (!validation.ok) {
      setStatus("Correggi gli errori di validazione JSON prima di importare");
      return;
    }

    if (importMode === "update-project" && !importProjectId.trim()) {
      setStatus("Fornisci un ID progetto da aggiornare");
      return;
    }

    setBusy(true);
    setStatus(
      importMode === "new-project"
        ? "Creazione progetto"
        : "Aggiornamento progetto"
    );

    try {
      const response = await fetch("/api/ai-bridge/import-plan", {
        body: JSON.stringify({
          applyAutoRepair: autoRepair,
          mode: importMode,
          projectId:
            importMode === "update-project"
              ? importProjectId.trim()
              : undefined,
          response: pastedResponse,
          sourceRequest: userRequest,
          userRequest
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as ImportResponse;

      if (!response.ok || !payload.ok) {
        const message =
          payload.error ?? payload.errors?.join("; ") ?? "Importazione fallita";
        throw new Error(message);
      }

      setImportedProjectId(payload.project?.id ?? null);
      setImportIssues(payload.issues ?? []);
      setImportMissing(payload.missingAssets ?? []);
      setStatus(
        `Piano importato in ${payload.project?.name ?? "progetto"} (${payload.project?.id ?? ""})`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Importazione fallita"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bridge-shell" aria-label="Bridge manuale ChatGPT">
      <section className="asset-filters bridge-request-panel">
        <h2>Richiesta</h2>
        <label className="field">
          <span>Richiesta mappa</span>
          <textarea
            className="bridge-textarea bridge-request"
            onChange={(event) => setUserRequest(event.target.value)}
            value={userRequest}
          />
        </label>

        <section className="detail-block">
          <h3>Contesto locale</h3>
          <p>{context.assetGroups.length} gruppi asset selezionati</p>
          <p>{context.assetSearchResults.length} asset cercati selezionati</p>
          <p>{context.references.length} riferimenti selezionati</p>
          <button onClick={searchLocalAssetsForPrompt} type="button">
            Cerca asset locali
          </button>
        </section>

        <section className="bridge-context-list">
          <h3>Gruppi asset</h3>
          {context.assetGroups.map((group) => (
            <article key={group.id}>
              <strong>{group.name}</strong>
              <span>
                {group.kind} - {group.assetCount} asset
              </span>
            </article>
          ))}
        </section>

        <section className="bridge-context-list">
          <h3>Ricerca asset</h3>
          {context.assetSearchResults.map((result) => (
            <article key={result.assetId}>
              <strong>{result.relativePath}</strong>
              <span>
                {result.classification} - {Math.round(result.score * 100)}% -{" "}
                {result.reason}
              </span>
            </article>
          ))}
        </section>

        <section className="bridge-context-list">
          <h3>Riferimenti</h3>
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
                Copia prompt
              </button>
              <button
                onClick={() => copyText(promptPacket, "Prompt packet")}
                type="button"
              >
                Copia pacchetto (.md)
              </button>
              <button onClick={downloadPacket} type="button">
                Scarica pacchetto
              </button>
            </div>
          </header>
          <textarea
            className="bridge-textarea bridge-prompt"
            readOnly
            value={prompt}
          />
        </section>

        <section className="asset-details bridge-response-panel">
          <header className="bridge-panel-header">
            <h2>Validazione risposta</h2>
            <span className={validation.ok ? "bridge-valid" : "bridge-invalid"}>
              {pastedResponse.trim()
                ? validation.ok
                  ? "JSON MapPlan valido"
                  : "JSON non valido"
                : "In attesa di incolla"}
            </span>
          </header>
          <textarea
            className="bridge-textarea bridge-response"
            onChange={(event) => setPastedResponse(event.target.value)}
            placeholder="Incolla qui la risposta JSON di ChatGPT"
            spellCheck={false}
            value={pastedResponse}
          />

          {pastedResponse.trim() && !validation.ok ? (
            <section className="bridge-errors">
              <h3>Errori schema</h3>
              <ul>
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {validation.ok && semantic ? (
            <section className="bridge-valid-summary">
              <h3>Piano interpretato</h3>
              <p>
                {validation.data.name} - {validation.data.rooms.length} stanze,{" "}
                {validation.data.assetPlacements.length} piazzamenti
              </p>
              {semantic.ok ? (
                <p className="bridge-valid">
                  Nessun problema semantico rilevato.
                </p>
              ) : (
                <section className="bridge-semantic">
                  <h4>Problemi semantici</h4>
                  <ul>
                    {semantic.issues.map((issue) => (
                      <li key={`${issue.path}:${issue.message}`}>
                        <strong>
                          {issue.level === "error" ? "Errore" : "Avviso"}
                        </strong>{" "}
                        [{issue.type}]: {issue.message}
                      </li>
                    ))}
                  </ul>
                  {semantic.missingAssets.length > 0 ? (
                    <section className="bridge-missing-assets">
                      <h4>Suggerimenti asset mancanti</h4>
                      {semantic.missingAssets.map((report) => (
                        <article key={report.assetId}>
                          <strong>{report.assetId}</strong>
                          <ul>
                            {report.suggestions.map((suggestion) => (
                              <li key={suggestion.suggestionId}>
                                {suggestion.suggestionId} - {suggestion.reason}
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </section>
                  ) : null}
                  {repairPreview ? (
                    <p>
                      L'autoriparazione locale rimuoverebbe{" "}
                      {repairPreview.removed.invalidWalls.length} muri non
                      validi, {repairPreview.removed.outOfBoundsDoors.length}{" "}
                      porte e applicherebbe{" "}
                      {repairPreview.appliedSubstitutions.length} sostituzioni
                      asset.
                    </p>
                  ) : null}
                </section>
              )}
            </section>
          ) : null}

          {validation.ok ? (
            <section className="bridge-import">
              <h3>Importa piano nel progetto</h3>
              <label className="field">
                <span>Modalita</span>
                <select
                  onChange={(event) =>
                    setImportMode(event.target.value as ImportMode)
                  }
                  value={importMode}
                >
                  <option value="new-project">Crea nuovo progetto</option>
                  <option value="update-project">
                    Aggiorna progetto esistente
                  </option>
                </select>
              </label>
              {importMode === "update-project" ? (
                <label className="field">
                  <span>ID progetto</span>
                  <input
                    onChange={(event) => setImportProjectId(event.target.value)}
                    placeholder="es. cripta-sotto-la-cattedrale"
                    value={importProjectId}
                  />
                </label>
              ) : null}
              <label className="editor-checkbox">
                <input
                  checked={autoRepair}
                  onChange={(event) => setAutoRepair(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Applica autoriparazione locale prima del salvataggio
                </span>
              </label>
              <button
                className="save-correction"
                disabled={busy || !validation.ok}
                onClick={importPlan}
                type="button"
              >
                {busy ? "Elaborazione..." : "Importa piano"}
              </button>
              {importedProjectId ? (
                <p>
                  Importato in{" "}
                  <a href={`/projects/${importedProjectId}`}>
                    {importedProjectId}
                  </a>
                </p>
              ) : null}
              {importIssues.length > 0 ? (
                <section className="bridge-import-issues">
                  <h4>Problemi residui dopo l'import</h4>
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
                  <h4>Asset mancanti nel piano salvato</h4>
                  <ul>
                    {importMissing.map((report) => (
                      <li key={report.assetId}>
                        {report.assetId} - suggeriti:{" "}
                        {report.suggestions
                          .map((suggestion) => suggestion.suggestionId)
                          .join(", ") || "nessun suggerimento"}
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
                <h3>Prompt di riparazione</h3>
                <button
                  onClick={() => copyText(repairPrompt, "Repair prompt")}
                  type="button"
                >
                  Copia riparazione
                </button>
              </header>
              <textarea
                className="bridge-textarea bridge-repair-text"
                readOnly
                value={repairPrompt}
              />
            </section>
          ) : null}

          <p>{status}</p>
        </section>
      </section>
    </section>
  );
}

function toBridgeAssetSearchResult(
  result: AssetSearchApiResult
): BridgeAssetSearchSummary {
  return {
    assetId: result.assetId,
    classification: result.classification,
    reason: result.reason,
    relativePath: result.relativePath,
    score: result.score,
    tags: result.tags
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
