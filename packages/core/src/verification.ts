import type {
  BrowserEvidence,
  NavigationElement,
  VerificationVerdict,
} from "./types.js";
import {
  TRACKING_SCHEMA_VERSION,
  assertTrackingRunEvidence,
  type ScenarioVerdictCode,
  type TrackingRunEvidenceV1,
} from "./contracts.js";

function isAnalyticsRequest(url: string): boolean {
  return /(?:(?:google-analytics\.com|analytics\.google\.com)|127\.0\.0\.1:14173)\/g\/collect/i.test(url);
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
  const exactlyOneRequest = analyticsRequests.length === 1;
  const passed = clickedExpectedLink && exactlyOneRequest;
  const verdictCode: ScenarioVerdictCode = passed
    ? "browser_verified"
    : analyticsRequests.length > 1
      ? "duplicate_fire"
      : clickedExpectedLink
        ? "tag_fired_request_missing"
        : "insufficient_observable_evidence";
  const runEvidence: TrackingRunEvidenceV1 = {
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
    verdict: {
      code: verdictCode,
      browserVerification: passed ? "passed" : "failed",
      platformConfirmation: "unverified",
      nextAction: passed
        ? "No browser fix is needed; await platform confirmation."
        : analyticsRequests.length > 1
          ? "Inspect GTM for duplicate tags or overlapping triggers."
          : "Open GTM Preview to determine whether the tag fired.",
    },
  };
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
        detail: `Observed ${analyticsRequests.length} matching GA4 request(s).`,
      },
      {
        name: "GA4 platform processing",
        passed: false,
        detail: "Not independently confirmed from browser evidence.",
      },
    ],
  };
}
