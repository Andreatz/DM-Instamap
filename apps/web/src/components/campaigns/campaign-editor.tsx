"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignMapLink, CampaignSession } from "@dm-instamap/core";

type CampaignEditorProps = {
  campaign: Campaign;
  projectOptions: Array<{ documentId: string; id: string; name: string }>;
};

export function CampaignEditor({ campaign, projectOptions }: CampaignEditorProps) {
  const router = useRouter();
  const [maps, setMaps] = useState<CampaignMapLink[]>(campaign.maps);
  const [sessions, setSessions] = useState<CampaignSession[]>(campaign.sessions);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [newMapProjectId, setNewMapProjectId] = useState(projectOptions[0]?.id ?? "");
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [newSessionSummary, setNewSessionSummary] = useState("");

  async function persist(patch: { maps?: CampaignMapLink[]; sessions?: CampaignSession[] }) {
    setSubmitting(true);
    setStatus("Saving…");

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        body: JSON.stringify(patch),
        headers: { "Content-Type": "application/json" },
        method: "PUT"
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }

      setStatus("Saved.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function addMap() {
    const project = projectOptions.find((option) => option.id === newMapProjectId);

    if (!project) {
      setStatus("Pick a project to link.");
      return;
    }

    if (maps.some((map) => map.projectId === project.id && map.documentId === project.documentId)) {
      setStatus("This project is already linked.");
      return;
    }

    const nextMaps = [
      ...maps,
      {
        documentId: project.documentId,
        label: project.name,
        projectId: project.id,
        tags: []
      }
    ];
    setMaps(nextMaps);
    void persist({ maps: nextMaps });
  }

  function removeMap(documentId: string) {
    const nextMaps = maps.filter((map) => map.documentId !== documentId);
    setMaps(nextMaps);
    void persist({ maps: nextMaps });
  }

  function addSession() {
    if (newSessionTitle.trim().length === 0) {
      setStatus("Session title is required.");
      return;
    }

    const nextSessions = [
      ...sessions,
      {
        date: newSessionDate.trim() || new Date().toISOString().slice(0, 10),
        id: `session-${Date.now()}`,
        mapDocumentIds: [],
        summary: newSessionSummary.trim() || undefined,
        title: newSessionTitle.trim()
      }
    ];
    setSessions(nextSessions);
    setNewSessionTitle("");
    setNewSessionSummary("");
    void persist({ sessions: nextSessions });
  }

  function removeSession(sessionId: string) {
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    void persist({ sessions: nextSessions });
  }

  return (
    <>
      <section className="asset-details">
        <h2>Linked Maps</h2>
        <p className="muted">Tie local projects to this campaign for quick access during prep.</p>

        {maps.length === 0 ? <p className="muted">No maps linked yet.</p> : null}

        {maps.length > 0 ? (
          <ul className="campaign-map-list">
            {maps.map((map) => (
              <li key={`${map.projectId}-${map.documentId}`}>
                <div>
                  <strong>{map.label}</strong>
                  <span className="muted"> — project {map.projectId}</span>
                </div>
                <button
                  className="save-correction"
                  disabled={submitting}
                  onClick={() => removeMap(map.documentId)}
                  type="button"
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span>Add Project</span>
            <select onChange={(event) => setNewMapProjectId(event.target.value)} value={newMapProjectId}>
              {projectOptions.length === 0 ? <option value="">No projects available</option> : null}
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="save-correction"
            disabled={submitting || projectOptions.length === 0}
            onClick={addMap}
            type="button"
          >
            Link Project
          </button>
        </div>
      </section>

      <section className="asset-details">
        <h2>Sessions Timeline</h2>
        <p className="muted">Local, append-only record of session prep / play notes.</p>

        {sessions.length === 0 ? <p className="muted">No sessions logged yet.</p> : null}

        {sessions.length > 0 ? (
          <ol className="campaign-session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <header>
                  <strong>{session.title}</strong>
                  <span className="muted">{session.date}</span>
                </header>
                {session.summary ? <p>{session.summary}</p> : null}
                <button
                  className="save-correction"
                  disabled={submitting}
                  onClick={() => removeSession(session.id)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span>Title</span>
            <input
              onChange={(event) => setNewSessionTitle(event.target.value)}
              placeholder="Session 1 — Arrival"
              value={newSessionTitle}
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input
              onChange={(event) => setNewSessionDate(event.target.value)}
              placeholder="2026-05-21"
              value={newSessionDate}
            />
          </label>
        </div>
        <label className="field">
          <span>Summary (optional)</span>
          <textarea
            onChange={(event) => setNewSessionSummary(event.target.value)}
            rows={3}
            value={newSessionSummary}
          />
        </label>
        <button className="save-correction" disabled={submitting} onClick={addSession} type="button">
          Add Session
        </button>
      </section>

      {status ? <p>{status}</p> : null}
    </>
  );
}
