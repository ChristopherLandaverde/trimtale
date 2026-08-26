import { describe, expect, it } from "vitest";
import {
  createCustomCodeSetup,
  reviewCustomCode,
  validateCustomCode,
  type CustomCodeProposalV1,
} from "./custom-code.js";
import { compileTrackingSetup } from "./setup-compiler.js";

const policy = {
  id: "policy_pricing_pages",
  source: { type: "page_view" as const },
  include: [{
    variable: { type: "built_in_variable" as const, name: "Page Path" },
    operator: "starts_with" as const,
    value: "/pricing",
  }],
  exclude: [{
    variable: { type: "built_in_variable" as const, name: "Page Hostname" },
    operator: "ends_with" as const,
    value: ".internal",
  }],
  frequency: "once_per_page" as const,
  consent: { required: ["analytics_storage" as const], whenDenied: "block" as const },
};

function proposal(): CustomCodeProposalV1 {
  return {
    schemaVersion: 1,
    id: "vendor_pricing_pixel",
    vendor: "Example Vendor",
    authoritativeSource: {
      url: "https://docs.vendor.test/browser-tag",
      title: "Browser tag installation",
      retrievedAt: "2026-08-24T14:00:00.000Z",
    },
    behaviorSummary: "Load the vendor browser tag and report a pricing-page view.",
    code: `<script src="https://cdn.vendor.test/pixel.js"></script>
<script>navigator.sendBeacon("https://collect.vendor.test/event", JSON.stringify({event:"pricing_view"}));</script>`,
    destinations: [
      "https://cdn.vendor.test",
      "https://collect.vendor.test",
    ],
    inputs: [
      { type: "page_url" },
      { type: "consent_state" },
    ],
    firingPolicies: [policy],
    verification: {
      positive: [{ type: "network_request", destination: "collect.vendor.test" }],
      negative: [
        { type: "network_request", destination: "collect.vendor.test", scenario: "excluded_page" },
        { type: "page_error", messagePattern: "vendor" },
      ],
    },
  };
}

describe("Custom HTML and JavaScript policy", () => {
  it("creates an exact review and compiler-ready setup", () => {
    const candidate = proposal();
    const review = reviewCustomCode(candidate);
    const setup = createCustomCodeSetup(candidate);
    const compiled = compileTrackingSetup({ ...setup, status: "confirmed" }, {
      accountId: "1",
      containerId: "2",
      publicId: "GTM-TEST123",
      name: "Test",
    });
    const tag = compiled.containerFile.containerVersion.tag[0] as Record<string, unknown>;

    expect(validateCustomCode(candidate)).toEqual([]);
    expect(review).toMatchObject({
      code: candidate.code,
      destinations: candidate.destinations,
      behaviorSummary: candidate.behaviorSummary,
      firingPolicyIds: [policy.id],
    });
    expect(review.fingerprint).toMatch(/^custom_[a-f0-9]{12}$/);
    expect(tag).toMatchObject({ type: "html", consentSettings: { consentStatus: "NEEDED" } });
    expect((tag.parameter as Array<{ key?: string; value?: string }>)
      .find(({ key }) => key === "html")?.value).toBe(candidate.code);
  });

  it.each([
    ["undeclared destination", (value: CustomCodeProposalV1) => ({
      ...value,
      destinations: ["https://cdn.vendor.test"],
    }), "code uses undeclared destination https://collect.vendor.test"],
    ["cookie read", (value: CustomCodeProposalV1) => ({
      ...value,
      code: `${value.code}\n<script>document.cookie</script>`,
    }), "code reads a forbidden private data source"],
    ["browser storage", (value: CustomCodeProposalV1) => ({
      ...value,
      code: `${value.code}\n<script>localStorage.getItem('person')</script>`,
    }), "code reads a forbidden private data source"],
    ["form value", (value: CustomCodeProposalV1) => ({
      ...value,
      code: `${value.code}\n<script>document.querySelector('input').value</script>`,
    }), "code reads a forbidden private data source"],
    ["dynamic execution", (value: CustomCodeProposalV1) => ({
      ...value,
      code: `${value.code}\n<script>eval('alert(1)')</script>`,
    }), "code uses forbidden dynamic execution"],
    ["dynamic destination", (value: CustomCodeProposalV1) => ({
      ...value,
      code: "<script>fetch(window.vendorEndpoint)</script>",
    }), "code uses a dynamic network destination"],
    ["unsafe firing selector", (value: CustomCodeProposalV1) => ({
      ...value,
      firingPolicies: [{ ...policy, source: { type: "click", selector: "button<script>" } }],
    }), "policy.firingPolicies[0].source.selector is invalid"],
  ])("rejects %s", (_name, mutate, expected) => {
    expect(validateCustomCode(mutate(proposal()))).toContain(expected);
  });

  it("keeps the review fingerprint stable and changes it with code or scope", () => {
    const candidate = proposal();
    const first = reviewCustomCode(candidate).fingerprint;
    expect(reviewCustomCode(structuredClone(candidate)).fingerprint).toBe(first);
    expect(reviewCustomCode({ ...candidate, code: `${candidate.code}\n<!-- changed -->` }).fingerprint)
      .not.toBe(first);
    expect(reviewCustomCode({
      ...candidate,
      firingPolicies: [{ ...policy, include: [] }],
    }).fingerprint).not.toBe(first);
  });
});
