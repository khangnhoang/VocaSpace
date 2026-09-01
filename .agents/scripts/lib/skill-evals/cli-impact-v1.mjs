import { sha256Canonical } from "./artifact-schema-v1.mjs";

export function assessAcceptedReaderReuse({ acceptedEvidence, currentDescriptor }) {
  if (
    !acceptedEvidence || acceptedEvidence.unit_id !== currentDescriptor?.unit_id ||
    acceptedEvidence.source_role !== currentDescriptor?.logical_unit_key?.source_role ||
    acceptedEvidence.terminal_status !== "succeeded"
  ) {
    return { status: "rejected", reason: "accepted_lineage_mismatch" };
  }
  const currentBehaviorFingerprint = sha256Canonical(currentDescriptor.behavior_projection);
  if (acceptedEvidence.producer_behavior_fingerprint !== currentBehaviorFingerprint) {
    return { status: "invalidated", reason: "behavior_changed", current_behavior_fingerprint: currentBehaviorFingerprint };
  }
  return { status: "reusable", reason: null, current_behavior_fingerprint: currentBehaviorFingerprint };
}
