// Decides whether run-e2e.mjs may skip `supabase db reset`. The default is always to reset: a skip needs an explicit
// env flag that only the CI workflow sets, plus evidence that this very job created the stack on an empty volume.
export const e2eProjectId = "voca_space_e2e";
// Path of the evidence file. The workflow writes it outside `.e2e-runtime`, because prepareSupabaseWorkdir() deletes that folder.
export const skipResetEvidenceEnv = "E2E_SKIP_DB_RESET_EVIDENCE";

/**
 * @param {object} input
 * @param {string | undefined} input.evidencePath value of E2E_SKIP_DB_RESET_EVIDENCE; unset means the flag is off
 * @param {string | null} input.evidenceText file content, or null when it is missing or unreadable
 * @param {{ GITHUB_RUN_ID?: string, GITHUB_RUN_ATTEMPT?: string }} input.job identity of the job running this process
 * @returns {{ reset: boolean, reason: string }}
 */
export function decideDatabaseReset({ evidencePath, evidenceText, job }) {
  if (!evidencePath) return resetBecause(`${skipResetEvidenceEnv} is not set`);
  if (evidenceText === null) return resetBecause("the fresh-stack evidence file is missing or unreadable");

  let evidence;
  try {
    evidence = JSON.parse(evidenceText);
  } catch {
    return resetBecause("the fresh-stack evidence is not valid JSON");
  }
  if (typeof evidence !== "object" || evidence === null) return resetBecause("the fresh-stack evidence is not an object");

  if (evidence.version !== 1) return resetBecause("the fresh-stack evidence has an unknown version");
  if (evidence.projectId !== e2eProjectId) return resetBecause("the evidence belongs to another Supabase project");
  if (evidence.dataVolume !== `supabase_db_${e2eProjectId}`) return resetBecause("the evidence names another data volume");
  if (evidence.startExitCode !== 0) return resetBecause("the evidence does not show a successful start");
  if (evidence.volumeBeforeStart !== "absent") return resetBecause("the data volume existed before this job started the stack");
  if (evidence.volumeAfterStart !== "present") return resetBecause("the data volume was not seen after the start");

  const runId = job.GITHUB_RUN_ID;
  const runAttempt = job.GITHUB_RUN_ATTEMPT;
  if (!runId || !runAttempt) return resetBecause("the job identity is unknown");
  if (evidence.runId !== runId || evidence.runAttempt !== runAttempt) {
    return resetBecause("the evidence was written by another job run");
  }

  return { reset: false, reason: "this job started the stack on an empty data volume" };
}

function resetBecause(reason) {
  return { reset: true, reason };
}
