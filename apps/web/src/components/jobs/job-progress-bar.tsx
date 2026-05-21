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
        Worker error: {error}
      </p>
    );
  }

  if (!job) {
    return <p className="muted">Connecting to worker…</p>;
  }

  return (
    <section className="manifest-note" aria-label="Job progress">
      <span className="pill">job: {job.id}</span>
      <span className="pill">status: {job.status}</span>
      <span className="pill">progress: {job.progress}%</span>
      <p>{job.message}</p>
      {job.status === "failed" && job.error ? <p className="muted">Error: {job.error}</p> : null}
    </section>
  );
}
