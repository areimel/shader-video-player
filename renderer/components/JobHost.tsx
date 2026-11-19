import type { JobSnapshot } from "../../shared/jobs";
import type { Jobs } from "../hooks/useJobs";
import { formatEta } from "../utils/jobs";
import { Button } from "./common/Button";
import { IconButton } from "./common/IconButton";
import { ProgressBar } from "./common/ProgressBar";

const KIND_LABEL = { download: "Download", convert: "Convert", export: "Export" } as const;

function JobCard({ job, jobs, resumeAt }: { job: JobSnapshot; jobs: Jobs; resumeAt?: () => number }) {
  const { state, progress, actions } = job;
  const eta = formatEta(progress.etaSec);
  return (
    <div className={`job-card job-${state}`} role="group" aria-label={`${KIND_LABEL[job.kind]}: ${job.title}`}>
      <div className="job-head">
        <strong className="job-title" title={job.title}>{job.title}</strong>
        {state === "running"
          ? <IconButton icon="close" label="Cancel" onClick={() => jobs.cancel(job.id)} />
          : <IconButton icon="close" label="Dismiss" onClick={() => jobs.dismiss(job.id)} />}
      </div>
      {state === "running" && (
        <>
          <ProgressBar fraction={progress.fraction} label={`${KIND_LABEL[job.kind]} progress`} />
          <div className="job-meta">
            <span className="job-label">{progress.label}</span>
            <span className="job-eta">{eta}</span>
          </div>
        </>
      )}
      {state === "done" && (
        <div className="job-actions">
          <span className="job-label">{progress.label || "Done"}</span>
          {actions.includes("open") && <Button variant="quiet" onClick={() => jobs.open(job.id, job.kind === "convert" ? resumeAt?.() : undefined)}>Open</Button>}
          {actions.includes("reveal") && <Button variant="quiet" onClick={() => jobs.reveal(job.id)}>Show in folder</Button>}
        </div>
      )}
      {state === "failed" && <div className="job-error" role="alert" title={job.error}>{job.error || "Something went wrong"}</div>}
      {state === "cancelled" && <div className="job-label">Cancelled</div>}
    </div>
  );
}

/** Job cards; render them inside `ToastHost` so they stack above the toasts. */
/** `resumeAt` is the playhead: a finished convert reopens there. */
export function JobHost({ jobs, resumeAt }: { jobs: Jobs; resumeAt?: () => number }) {
  return <>{jobs.jobs.map((j) => <JobCard key={j.id} job={j} jobs={jobs} resumeAt={resumeAt} />)}</>;
}
