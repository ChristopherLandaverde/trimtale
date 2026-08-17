import type {
  BrowserEvidence,
  NavigationElement,
  VerificationVerdict,
} from "./types.js";

function isAnalyticsRequest(url: string): boolean {
  return /(?:(?:google-analytics\.com|analytics\.google\.com)|127\.0\.0\.1:14173)\/g\/collect/i.test(url);
}

export function evaluateEvidence(
  expected: NavigationElement,
  evidence?: BrowserEvidence,
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

  return {
    status: passed ? "passed" : "failed",
    browserVerification: passed ? "verified" : "failed",
    platformConfirmation: "unverified",
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
