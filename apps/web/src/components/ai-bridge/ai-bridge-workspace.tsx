"use client";

import { useMemo, useState } from "react";
import {
  buildChatGptBridgePrompt,
  buildRepairPrompt,
  searchBridgeContext,
  validateBridgeResponse,
  type BridgeAssetGroupSummary,
  type BridgeReferenceSummary
} from "@dm-instamap/ai-bridge";
import type { AssetGroupView } from "@/lib/asset-groups";
import type { ReferenceMapView } from "@/lib/references";

type AiBridgeWorkspaceProps = {
  assetGroups: AssetGroupView[];
  references: ReferenceMapView[];
};

export function AiBridgeWorkspace({ assetGroups, references }: AiBridgeWorkspaceProps) {
  const [userRequest, setUserRequest] = useState(
    "Create a crypt dungeon with an entrance, chapel, library, treasure room, and boss room."
  );
  const [pastedResponse, setPastedResponse] = useState("");
  const [status, setStatus] = useState("Manual bridge ready");
  const groupSummaries = useMemo(() => assetGroups.map(toBridgeAssetGroup), [assetGroups]);
  const referenceSummaries = useMemo(() => references.map(toBridgeReference), [references]);
  const context = useMemo(
    () =>
      searchBridgeContext({
        assetGroups: groupSummaries,
        references: referenceSummaries,
        userRequest
      }),
    [groupSummaries, referenceSummaries, userRequest]
  );
  const prompt = useMemo(
    () =>
      buildChatGptBridgePrompt({
        assetGroups: groupSummaries,
        references: referenceSummaries,
        userRequest
      }),
    [groupSummaries, referenceSummaries, userRequest]
  );
  const validation = useMemo(() => validateBridgeResponse(pastedResponse), [pastedResponse]);
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

  async function copyPrompt(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied`);
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
          <p>{context.references.length} references selected</p>
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
            <button onClick={() => copyPrompt(prompt, "Prompt")} type="button">
              Copy Prompt
            </button>
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
              <h3>Errors</h3>
              <ul>
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {validation.ok ? (
            <section className="bridge-valid-summary">
              <h3>Parsed Plan</h3>
              <p>
                {validation.data.name} - {validation.data.rooms.length} rooms,{" "}
                {validation.data.assetPlacements.length} placements
              </p>
            </section>
          ) : null}

          {!validation.ok && pastedResponse.trim() ? (
            <section className="bridge-repair">
              <header className="bridge-panel-header">
                <h3>Repair Prompt</h3>
                <button onClick={() => copyPrompt(repairPrompt, "Repair prompt")} type="button">
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
    tags: reference.tags,
    width: reference.width
  };
}
