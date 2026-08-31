import { describe, expect, it } from "vitest";
import type {
  BrowserEvidence,
  FormSetupRequest,
  NavigationElement,
  SetupRequest,
  SuccessEvidence,
  TrackingSpecificationV1,
} from "@gtm-observability/core";
import { createSetupProposal } from "@gtm-observability/core";
import {
  buildFormRunEvidence,
  FormEvidenceController,
  NavigationEvidenceController,
} from "./evidence-capture.js";

const navigation: NavigationElement = {
  id: "nav_services",
  text: "Services",
  href: "http://127.0.0.1:14173/services",
  area: "header",
  selector: "header a[href=\"/services\"]",
};

function navigationRequest(): SetupRequest {
  return {
    intent: "Track navigation links",
    pageUrl: "http://127.0.0.1:14173/",
    measurementId: "G-TEST123456",
    navigation: [navigation],
    container: { accountId: "1", containerId: "10", publicId: "GTM-TEST123", name: "Lead site" },
  };
}

function browserEvidence(requests: BrowserEvidence["requests"]): BrowserEvidence {
  return {
    navigationId: navigation.id,
    clickedAt: "2026-08-30T20:00:00.000Z",
    pageUrl: "http://127.0.0.1:14173/",
    linkText: navigation.text,
    linkUrl: navigation.href,
    requests,
  };
}

const formSuccess: SuccessEvidence = { type: "visible_element", selector: "#contact-success" };
const formSpecification: TrackingSpecificationV1 = {
  schemaVersion: 1,
  id: "spec_form_contact",
  status: "confirmed",
  originalIntent: "Track qualified inquiries from Contact sales",
  interaction: { type: "form_submission" },
  conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
  event: {
    name: "generate_lead",
    requiredParameters: ["form_id", "form_name", "page_location"],
    optionalParameters: [],
  },
  targets: [{
    id: "contact",
    label: "Contact sales",
    selector: "form#contact",
    pageUrl: "http://127.0.0.1:14173/",
  }],
  successEvidence: [formSuccess],
};

function formRequest(): FormSetupRequest {
  return {
    specification: formSpecification,
    measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-TEST123", name: "Lead site" },
  };
}

describe("NavigationEvidenceController", () => {
  it("completes post-publication navigation evidence after a matching GA4 request", () => {
    const controller = new NavigationEvidenceController();
    const request = navigationRequest();
    controller.startPostPublication("operation_navigation", request);

    const completion = controller.completePostPublication(navigation, browserEvidence([{
      url: "http://127.0.0.1:14173/g/collect?v=2&tid=G-TEST123456&en=navigation_click",
      observedAt: "2026-08-30T20:00:00.100Z",
    }]));

    expect(completion).toMatchObject({
      operationId: "operation_navigation",
      evidence: {
        specificationId: createSetupProposal(request).specification.id,
        verdict: {
          code: "browser_verified",
          browserVerification: "passed",
          platformConfirmation: "unverified",
        },
      },
    });
    expect(controller.scopeSize).toBe(0);
  });

  it("ignores browser evidence outside the active navigation scope", () => {
    const controller = new NavigationEvidenceController();
    controller.startPostPublication("operation_navigation", navigationRequest());

    expect(controller.recordEvidence({ ...browserEvidence([]), navigationId: "nav_other" })).toBeUndefined();
    expect(controller.scopeSize).toBe(1);
  });
});

describe("FormEvidenceController", () => {
  it("builds private-value-filtered form run evidence", () => {
    const evidence = buildFormRunEvidence({
      specification: formSpecification,
      target: formSpecification.targets[0]!,
      success: formSuccess,
      startedAt: "2026-08-30T20:00:00.000Z",
      pageState: {
        transport: "ajax",
        submitAttempted: "true",
        submissionResult: "success",
        outcomeObserved: "true",
        dataLayerEvent: "true",
        tagFired: "true",
        consent: "granted",
      },
      requests: [{
        url: "http://127.0.0.1:14173/g/collect?v=2&tid=G-TEST123456&en=generate_lead&ep.form_id=contact&ep.form_name=Contact_sales&ep.email=private@example.com&ep.page_location=http%3A%2F%2F127.0.0.1%3A14173%2F%3Femail%3Dprivate%40example.com",
        observedAt: "2026-08-30T20:00:00.100Z",
      }],
      now: 1798646400000,
    });

    expect(evidence.verdict).toMatchObject({
      code: "browser_verified",
      browserVerification: "passed",
      platformConfirmation: "unverified",
    });
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("ep.email");
    expect(evidence.observations.network.ga4Requests[0]?.url).toContain("ep.page_location=http%3A%2F%2F127.0.0.1%3A14173%2F");
  });

  it("finishes post-publication form evidence through the active operation", () => {
    const controller = new FormEvidenceController();
    controller.startPostPublication("operation_form", formRequest());
    controller.recordAnalyticsRequest({
      url: "http://127.0.0.1:14173/g/collect?v=2&tid=G-TEST123456&en=generate_lead&ep.form_id=contact&ep.form_name=Contact_sales&ep.page_location=http%3A%2F%2F127.0.0.1%3A14173%2Fcontact",
      observedAt: "2026-08-30T20:00:00.100Z",
    });

    const completion = controller.finishPostPublication("2026-08-30T20:00:00.000Z", {
      transport: "ajax",
      submitAttempted: "true",
      submissionResult: "success",
      outcomeObserved: "true",
      dataLayerEvent: "true",
      tagFired: "true",
      consent: "granted",
    });

    expect(completion).toMatchObject({
      operationId: "operation_form",
      evidence: {
        specificationId: "spec_form_contact",
        verdict: { code: "browser_verified" },
      },
    });
    expect(controller.finishPostPublication("2026-08-30T20:00:01.000Z", {})).toBeUndefined();
  });
});
