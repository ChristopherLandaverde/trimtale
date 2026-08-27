import type {
  BrowserEvidence,
  NavigationElement,
  VerificationVerdict,
} from "./types.js";
import {
  TRACKING_SCHEMA_VERSION,
  assertTrackingRunEvidence,
  type TrackingRunEvidenceV1,
} from "./contracts.js";
import {
  browserObservationsFromRunEvidence,
  evaluateBrowserEvidence,
  interactionBrowserEvidenceContract,
} from "./browser-evidence.js";

function isAnalyticsRequest(url: string): boolean {
  return /(?:(?:google-analytics\.com|analytics\.google\.com)|127\.0\.0\.1:4173)\/g\/collect/i.test(url);
}

export function evaluateEvidence(
  expected: NavigationElement,
  evidence?: BrowserEvidence,
  specificationId = "spec_navigation",
): VerificationVerdict {
  if (!evidence) {
    return {
      status: "incomplete",
      browserVerification: "pending",
      platformConfirmation: "unverified",
      checks: [{ name: "Guided click", passed: false, detail: "No click evidence recorded yet." }],
    };
  }

  const clickedExpectedLink = evidence.linkUrl === expected.href;
  const analyticsRequests = evidence.requests.filter((request) => isAnalyticsRequest(request.url));
  const provisional: Omit<TrackingRunEvidenceV1, "verdict"> = {
    schemaVersion: TRACKING_SCHEMA_VERSION,
    runId: `run_${expected.id}_${Date.parse(evidence.clickedAt)}`,
    specificationId,
    startedAt: evidence.clickedAt,
    observations: {
      interaction: {
        type: "navigation_click",
        targetId: expected.id,
        attempted: true,
        submissionResult: "success",
      },
      outcome: {
        observed: clickedExpectedLink,
        observable: true,
        ...(clickedExpectedLink ? { evidenceType: "navigation_click" as const } : {}),
      },
      dataLayer: { matchingEvents: [] },
      tagFired: analyticsRequests.length > 0 ? true : null,
      network: { ga4Requests: analyticsRequests },
      consent: { analyticsStorage: "unknown" },
    },
  };
  const contract = interactionBrowserEvidenceContract("navigation_click", ["link_text", "link_url"]);
  const observations = browserObservationsFromRunEvidence(provisional.observations);
  const matchingRequestCount = observations.requests.filter((request) =>
    request.destination === contract.request.destination
      && request.eventName === contract.request.eventName).length;
  const exactlyOneRequest = matchingRequestCount === 1;
  const verdict = evaluateBrowserEvidence(contract, observations);
  const runEvidence: TrackingRunEvidenceV1 = { ...provisional, verdict };
  const passed = clickedExpectedLink && verdict.browserVerification === "passed";
  assertTrackingRunEvidence(runEvidence);

  return {
    status: passed ? "passed" : "failed",
    browserVerification: passed ? "verified" : "failed",
    platformConfirmation: "unverified",
    runEvidence,
    checks: [
      {
        name: "Confirmed link clicked",
        passed: clickedExpectedLink,
        detail: clickedExpectedLink
          ? `Observed ${evidence.linkText} → ${evidence.linkUrl}`
          : `Expected ${expected.href}, observed ${evidence.linkUrl}`,
      },
      {
        name: "Single GA4 request observed",
        passed: exactlyOneRequest,
        detail: `Observed ${matchingRequestCount} matching GA4 request(s).`,
      },
      {
        name: "GA4 platform processing",
        passed: false,
        detail: "Not independently confirmed from browser evidence.",
      },
    ],
  };
}
