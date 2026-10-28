import { describe, expect, it } from "vitest";
import {
  countKnownLinkInteractions,
  createKnownInteractionSetupProposal,
} from "./interaction-authoring.js";

const container = {
  accountId: "1",
  containerId: "2",
  publicId: "GTM-TEST123",
  name: "Website",
};

describe("known interaction authoring", () => {
  it("authors a sitewide phone-click setup without sending contact data", () => {
    const proposal = createKnownInteractionSetupProposal({
      interaction: "phone_click",
      scope: "sitewide",
      pageUrl: "https://example.test/contact?phone=private",
      measurementId: "G-TEST123456",
      container,
    });

    expect(proposal.setup.tagActions[0]?.event).toEqual({
      name: "phone_click",
      parameters: [],
    });
    expect(proposal.setup.firingPolicies[0]).toMatchObject({
      source: { type: "click", selector: "a[href^='tel:']" },
      include: [{ operator: "starts_with", value: "tel:" }],
      consent: { required: ["analytics_storage"], whenDenied: "block" },
    });
    expect(proposal.suggestions).toContainEqual(expect.objectContaining({
      name: "phone_number",
      disposition: "excluded",
    }));
    const eventParameters = JSON.stringify(proposal.setup.tagActions[0]?.event?.parameters);
    expect(eventParameters).not.toContain("Click URL");
    expect(eventParameters).not.toContain("Click Text");
    expect(eventParameters).not.toContain("private");
  });

  it("authors email-link clicks without sending email data", () => {
    const proposal = createKnownInteractionSetupProposal({
      interaction: "email_click",
      scope: "sitewide",
      pageUrl: "https://example.test/contact?email=private",
      measurementId: "G-TEST123456",
      container,
    });

    expect(proposal.setup.tagActions[0]?.event).toEqual({
      name: "email_click",
      parameters: [],
    });
    expect(proposal.setup.firingPolicies[0]).toMatchObject({
      source: { type: "click", selector: "a[href^='mailto:'], area[href^='mailto:']" },
      include: [{ operator: "starts_with", value: "mailto:" }],
      consent: { required: ["analytics_storage"], whenDenied: "block" },
    });
    expect(proposal.suggestions).toContainEqual(expect.objectContaining({
      name: "email_address",
      disposition: "excluded",
    }));
    expect(JSON.stringify(proposal)).not.toContain("private@example.test");
    expect(JSON.stringify(proposal)).not.toContain("subject=private");
  });

  it("adds a page-path firing condition for current-page scope without storing the query", () => {
    const proposal = createKnownInteractionSetupProposal({
      interaction: "phone_click",
      scope: "current_page",
      pageUrl: "https://example.test/contact?email=private-person%40example.test#call",
      measurementId: "G-TEST123456",
      container,
    });

    expect(proposal.setup.firingPolicies[0]?.include).toContainEqual({
      variable: { type: "built_in_variable", name: "Page Path" },
      operator: "equals",
      value: "/contact",
    });
    expect(JSON.stringify(proposal)).not.toContain("private-person");
  });

  it("authors outbound clicks while excluding same-origin and destination values", () => {
    const proposal = createKnownInteractionSetupProposal({
      interaction: "outbound_click",
      scope: "sitewide",
      pageUrl: "https://example.test/pricing?private=sentinel",
      measurementId: "G-TEST123456",
      container,
    });

    expect(proposal.setup.tagActions[0]?.event).toEqual({
      name: "outbound_click",
      parameters: [],
    });
    expect(proposal.setup.firingPolicies[0]).toMatchObject({
      source: {
        type: "click",
        clickMode: "links",
        selector: "a[href^='http://'], a[href^='https://'], a[href^='//']",
      },
      exclude: [{
        variable: { type: "built_in_variable", name: "Click URL" },
        operator: "starts_with",
        value: "https://example.test/",
      }],
      consent: { required: ["analytics_storage"], whenDenied: "block" },
    });
    expect(proposal.suggestions).toContainEqual(expect.objectContaining({
      name: "link_url",
      disposition: "excluded",
    }));
    expect(JSON.stringify(proposal)).not.toContain("private=sentinel");
  });

  it("authors supported file downloads without sending file destinations", () => {
    const proposal = createKnownInteractionSetupProposal({
      interaction: "file_download",
      scope: "current_page",
      pageUrl: "https://example.test/resources?email=private%40example.test",
      measurementId: "G-TEST123456",
      container,
    });

    expect(proposal.setup.tagActions[0]?.event).toEqual({
      name: "file_download",
      parameters: [],
    });
    expect(proposal.setup.firingPolicies[0]).toMatchObject({
      source: { type: "click", clickMode: "links", selector: "a[href], area[href]" },
      include: [
        {
          variable: { type: "built_in_variable", name: "Click URL" },
          operator: "matches_regex",
        },
        {
          variable: { type: "built_in_variable", name: "Page Path" },
          operator: "equals",
          value: "/resources",
        },
      ],
    });
    expect(proposal.setup.firingPolicies[0]?.include[0]?.value).toContain("[pP][dD][fF]");
    expect(proposal.suggestions).toContainEqual(expect.objectContaining({
      name: "file_name",
      disposition: "excluded",
    }));
    expect(JSON.stringify(proposal)).not.toContain("private@example.test");
  });

  it("counts link categories locally without returning attacker-shaped destinations", () => {
    const counts = countKnownLinkInteractions("https://example.test/resources", [
      "tel:+15551234567",
      "https://example.test/internal",
      "https://example.test.attacker.invalid/collect?private=sentinel",
      "https://cdn.example.invalid/customer-private.PDF?token=sentinel",
      "/files/guide.zip#download",
      "mailto:private@example.test",
      "javascript:alert(1)",
    ]);

    expect(counts).toEqual({
      phone_click: 1,
      email_click: 1,
      outbound_click: 2,
      file_download: 2,
    });
    expect(JSON.stringify(counts)).not.toContain("sentinel");
    expect(JSON.stringify(counts)).not.toContain("private@example.test");
  });
});
