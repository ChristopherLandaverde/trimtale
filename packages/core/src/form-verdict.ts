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
    return ["ep.form_id", "ep.form_name"].every((key) => Boolean(parameters.get(key)))
      && Boolean(parameters.get("ep.page_location") || parameters.get("dl"));
  } catch {
    return false;
  }
}

/**
 * The next action when the form endpoint failed but the page still reported success (its
 * confirmed success signal fired). The submission result already outranks the page's success
 * signal; this names the conflict so the practitioner sees both sides.
 */
function conflictingSuccessAction(observations: FormObservations): string | undefined {
  const { interaction, outcome, network } = observations;
  if (!outcome.observed) return undefined;
  const status = interaction.responseStatus;
  const leadSent = network.ga4Requests.length > 0
    ? " A generate_lead request was sent for this failed submission, so GA4 may count a lead that does not exist."
    : "";
  if (interaction.submissionResult === "server_error") {
    return `The page reported success, but the form endpoint returned ${status ? `HTTP ${status}` : "a server error"}. `
      + `Fix the server error, show success and push generate_lead only after a successful response, then rerun browser verification.${leadSent}`;
  }
  if (interaction.submissionResult === "validation_error" && status) {
    return `The page reported success, but the form endpoint rejected the submission with HTTP ${status}. `
      + `Show success and push generate_lead only after the submission is accepted; do not count this attempt as a lead.${leadSent}`;
  }
  return undefined;
}

/**
 * Verdict order, first match wins: no trusted submit attempt; a rejected submission
 * (`validation_error`); a failed submission (`server_error`); no success signal; denied consent;
 * then the tracking chain (dataLayer event, tag, request count, parameters).
 *
 * The submission result arrives already resolved by `FormRun`, where an endpoint response
 * outranks the page's own success signal (see `FormRun#submissionResult`). So a run in which the
 * server failed but the page reported success is a failure here, never `browser_verified`.
 */
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
    nextAction: (code === "submission_failed" || code === "expected_non_conversion" ? conflictingSuccessAction(observations) : undefined)
      ?? nextActions[code],
  };
}

export function classifyFormRunEvidence(
  evidence: Omit<TrackingRunEvidenceV1, "verdict">,
): TrackingRunEvidenceV1 {
  return { ...evidence, verdict: determineFormVerdict(evidence.observations) };
}
