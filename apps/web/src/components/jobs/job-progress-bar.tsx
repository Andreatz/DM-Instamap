"use client";

import { useJob } from "@/lib/use-job";

type JobProgressBarProps = {
  jobId: string | null;
  pollIntervalMs?: number;
};

export function JobProgressBar({ jobId, pollIntervalMs }: JobProgressBarProps) {
  const { error, job } = useJob(jobId, { pollIntervalMs });

  if (!jobId) {
    return null;
  }

  if (error) {
    return (
      <p className="muted">
        Errore worker: {error}
      </p>
    );
  }

  if (!job) {
    return <p className="muted">Connessione al worker...</p>;
  }

  return (
    <section className="manifest-note" aria-label="Avanzamento job">
      <span className="pill">job: {job.id}</span>
      <span className="pill">stato: {job.status}</span>
      <span className="pill">avanzamento: {job.progress}%</span>
      <p>{job.message}</p>
      {job.status === "failed" && job.error ? <p className="muted">Errore: {job.error}</p> : null}
      {job.status === "failed" && typeof job.log?.stderrTail === "string" && job.log.stderrTail ? (
        <pre className="job-log">{job.log.stderrTail}</pre>
      ) : null}
    </section>
  );
}
