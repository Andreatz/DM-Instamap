"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AssetAuditBatch,
  AssetAuditBatchId,
  AuditEntryView
} from "@/lib/asset-audit";

const MAX_ROWS_PER_BATCH = 60;

type AssetAuditBatchesProps = {
  batches: AssetAuditBatch[];
};

export function AssetAuditBatches({ batches }: AssetAuditBatchesProps) {
  const [activeBatchId, setActiveBatchId] = useState<AssetAuditBatchId>(
    (batches.find((batch) => batch.entries.length > 0)?.id ??
      batches[0]?.id ??
      "critical") as AssetAuditBatchId
  );
  const activeBatch = useMemo(
    () => batches.find((batch) => batch.id === activeBatchId) ?? batches[0],
    [batches, activeBatchId]
  );
  const totalAssets = useMemo(
    () => batches.reduce((sum, batch) => sum + batch.entries.length, 0),
    [batches]
  );

  return (
    <section className="batch-shell" aria-label="Lotti audit asset">
      <aside className="batch-sidebar">
        <h2>Lotti</h2>
        <p className="muted">{totalAssets} voci in tutti i lotti.</p>
        <ul>
          {batches.map((batch) => (
            <li key={batch.id}>
              <button
                className={batch.id === activeBatchId ? "active" : ""}
                onClick={() => setActiveBatchId(batch.id)}
                type="button"
              >
                <span>{batch.label}</span>
                <span className="batch-count">{batch.entries.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="batch-detail" aria-live="polite">
        {activeBatch ? (
          <>
            <header>
              <h2>{activeBatch.label}</h2>
              <p className="muted">{activeBatch.description}</p>
            </header>

            {activeBatch.entries.length === 0 ? (
              <p>Lotto vuoto. Qui non c'e nulla da revisionare.</p>
            ) : (
              <table className="batch-table">
                <thead>
                  <tr>
                    <th scope="col">Asset</th>
                    <th scope="col">Classificazione</th>
                    <th scope="col">Affidabilita</th>
                    <th scope="col">Qualita</th>
                    <th scope="col">Priorita</th>
                    <th scope="col">Motivi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBatch.entries
                    .slice(0, MAX_ROWS_PER_BATCH)
                    .map((entry) => (
                      <AssetAuditRow entry={entry} key={entry.assetId} />
                    ))}
                </tbody>
              </table>
            )}
            {activeBatch.entries.length > MAX_ROWS_PER_BATCH ? (
              <p className="muted">
                Mostrate le prime {MAX_ROWS_PER_BATCH} di{" "}
                {activeBatch.entries.length}. Filtra o correggi le voci per
                vederne altre.
              </p>
            ) : null}
            <p>
              Serve piu controllo? Apri la{" "}
              <Link href="/assets/review">revisione per asset</Link> per
              scrivere override manuali.
            </p>
          </>
        ) : (
          <p>Nessun lotto disponibile.</p>
        )}
      </section>
    </section>
  );
}

function AssetAuditRow({ entry }: { entry: AuditEntryView }) {
  return (
    <tr>
      <td>
        <strong>{entry.assetId}</strong>
        <div className="muted">{entry.relativePath}</div>
      </td>
      <td>{entry.classification}</td>
      <td>{Math.round(entry.confidence * 100)}%</td>
      <td>{Math.round(entry.qualityScore)}</td>
      <td>
        <span className={`badge priority-${entry.reviewPriority}`}>
          {entry.reviewPriority}
        </span>
      </td>
      <td>
        {entry.reasons.length === 0 ? (
          <span className="muted">-</span>
        ) : (
          <ul className="reason-list">
            {entry.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}
