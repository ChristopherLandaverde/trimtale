import type { ScenarioVerdictCode, TrackingRunEvidenceV1 } from "./contracts.js";

type FormObservations = TrackingRunEvidenceV1["observations"];

const nextActions: Record<ScenarioVerdictCode, string> = {
  expected_non_conversion: "Correct the form input and submit again; do not count this attempt as a lead.",
  browser_verified: "No browser fix is needed; await platform confirmation.",
  outcome_observed_event_missing: "Add or repair the confirmed generate_lead data-layer event after success.",
  datalayer_event_observed_tag_not_firing: "Check the GTM trigger conditions for the observed generate_lead event.",
  tag_fired_request_missing: "Inspect the GA4 tag configuration, consent behavior, and browser delivery errors.",
  missing_parameter: "Add the missing required generate_lead parameters to the GA4 tag.",
  duplicate_fire: "Remove duplicate tags or overlapping triggers so the request fires once.",
  consent_limited: "Confirm the intended consent behavior before changing tracking configuration.",
  submission_failed: "Fix the form or server error, then rerun browser verification.",
  insufficient_observable_evidence: "Identify and confirm a browser-observable success signal before verification.",
};

function requestHasRequiredParameters(url: string): boolean {
  try {
    const parameters = new URL(url).searchParams;
    return ["ep.form_id", "ep.form_name", "ep.page_location"].every((key) => Boolean(parameters.get(key)));
  } catch {
    return false;
  }
}

export function determineFormVerdict(observations: FormObservations): TrackingRunEvidenceV1["verdict"] {
  let code: ScenarioVerdictCode;
  if (!observations.interaction.attempted) {
    code = "insufficient_observable_evidence";
  } else if (observations.interaction.submissionResult === "validation_error") {
    code = "expected_non_conversion";
  } else if (observations.interaction.submissionResult === "server_error") {
    code = "submission_failed";
  } else if (!observations.outcome.observed) {
    code = observations.outcome.observable ? "expected_non_conversion" : "insufficient_observable_evidence";
  } else if (observations.consent.analyticsStorage === "denied") {
    code = "consent_limited";
  } else if (observations.dataLayer.matchingEvents.length === 0) {
    code = "outcome_observed_event_missing";
  } else if (observations.tagFired === false) {
    code = "datalayer_event_observed_tag_not_firing";
  } else if (observations.tagFired === null) {
    code = "insufficient_observable_evidence";
  } else if (observations.network.ga4Requests.length === 0) {
    code = "tag_fired_request_missing";
  } else if (observations.network.ga4Requests.length > 1) {
    code = "duplicate_fire";
  } else if (!requestHasRequiredParameters(observations.network.ga4Requests[0]!.url)) {
    code = "missing_parameter";
  } else {
    code = "browser_verified";
  }

  return {
    code,
    browserVerification: code === "browser_verified"
      ? "passed"
      : code === "insufficient_observable_evidence" || code === "consent_limited"
        ? "inconclusive"
        : "failed",
    platformConfirmation: "unverified",
    nextAction: nextActions[code],
  };
}

export function classifyFormRunEvidence(
  evidence: Omit<TrackingRunEvidenceV1, "verdict">,
): TrackingRunEvidenceV1 {
  return { ...evidence, verdict: determineFormVerdict(evidence.observations) };
}
