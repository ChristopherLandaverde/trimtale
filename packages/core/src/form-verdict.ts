import type { TrackingRunEvidenceV1 } from "./contracts.js";
import {
  browserObservationsFromRunEvidence,
  evaluateBrowserEvidence,
  leadFormBrowserEvidenceContract,
} from "./browser-evidence.js";

type FormObservations = TrackingRunEvidenceV1["observations"];

export function determineFormVerdict(observations: FormObservations): TrackingRunEvidenceV1["verdict"] {
  return evaluateBrowserEvidence(
    leadFormBrowserEvidenceContract(),
    browserObservationsFromRunEvidence(observations),
  );
}

export function classifyFormRunEvidence(
  evidence: Omit<TrackingRunEvidenceV1, "verdict">,
): TrackingRunEvidenceV1 {
  return { ...evidence, verdict: determineFormVerdict(evidence.observations) };
}
