import type { SuccessEvidence } from "./contracts.js";
import type {
  FiringPolicyV1,
  TrackingSetupV1,
} from "./setup-contract.js";
import { normalizeNavigation } from "./navigation.js";
import type { FormSetupRequest, SetupRequest } from "./types.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scopedUrlPattern(hrefs: string[]): string {
  return `^(?:${hrefs.map(escapeRegex).join("|")})$`;
}

function formPolicy(
  evidence: SuccessEvidence,
  index: number,
): FiringPolicyV1 {
  const common = {
    id: `policy_form_success_${index + 1}`,
    exclude: [],
    frequency: "once_per_event" as const,
    consent: { required: [], whenDenied: "block" as const },
  };
  if (evidence.type === "visible_element") {
    return {
      ...common,
      source: {
        type: "element_visibility",
        selector: evidence.selector,
        visibilityFrequency: "once_per_page",
      },
      include: [],
    };
  }
  if (evidence.type === "thank_you_url") {
    return {
      ...common,
      source: { type: "page_view" },
      include: [{
        variable: { type: "built_in_variable", name: "Page URL" },
        operator: "matches_regex",
        value: evidence.urlPattern,
      }],
    };
  }
  return {
    ...common,
    source: {
      type: "custom_data_layer",
      eventName: evidence.type === "data_layer_event" ? evidence.eventName : evidence.signal,
    },
    include: [],
  };
}

export function navigationSetup(
  request: SetupRequest,
  id: string,
): TrackingSetupV1 {
  const navigation = normalizeNavigation(request.navigation);
  const hrefs = [...new Set(navigation.map((item) => item.href))];
  return {
    schemaVersion: 1,
    id,
    status: "confirmed",
    intent: {
      statement: request.intent,
      businessOutcome: "Measure navigation choices",
    },
    tagActions: [{
      id: "tag_navigation_click",
      name: "GA4 Event - navigation_click",
      execution: {
        type: "template",
        templateId: "google.analytics.ga4_event",
        fields: [],
      },
      destination: { type: "ga4", measurementId: request.measurementId.toUpperCase() },
      event: {
        name: "navigation_click",
        parameters: [
          {
            name: "link_text",
            requirement: "required",
            value: { type: "built_in_variable", name: "Click Text" },
          },
          {
            name: "link_url",
            requirement: "required",
            value: { type: "built_in_variable", name: "Click URL" },
          },
        ],
      },
      firingPolicyIds: ["policy_navigation_click"],
    }],
    firingPolicies: [{
      id: "policy_navigation_click",
      source: { type: "click", clickMode: "links" },
      include: [{
        variable: { type: "built_in_variable", name: "Click URL" },
        operator: "matches_regex",
        value: scopedUrlPattern(hrefs),
      }],
      exclude: [],
      frequency: "once_per_event",
      consent: { required: [], whenDenied: "block" },
    }],
    verification: {
      positive: [
        { type: "tag_fired", tagActionId: "tag_navigation_click" },
        {
          type: "network_request",
          destination: "google_analytics_4",
          eventName: "navigation_click",
        },
      ],
      negative: [],
    },
  };
}

export function formSetup(
  request: FormSetupRequest,
  id: string,
): TrackingSetupV1 {
  const primaryTarget = request.specification.targets[0];
  if (!primaryTarget) {
    throw new Error("Form setup requires a confirmed target.");
  }
  const policies = request.specification.successEvidence.map(formPolicy);
  return {
    schemaVersion: 1,
    id,
    status: "confirmed",
    intent: {
      statement: request.specification.originalIntent,
      businessOutcome: "Measure qualified inquiries",
    },
    tagActions: [{
      id: "tag_generate_lead",
      name: "GA4 Event - generate_lead",
      execution: {
        type: "template",
        templateId: "google.analytics.ga4_event",
        fields: [],
      },
      destination: { type: "ga4", measurementId: request.measurementId.toUpperCase() },
      event: {
        name: "generate_lead",
        parameters: [
          {
            name: "form_id",
            requirement: "required",
            value: { type: "literal", value: primaryTarget.id },
          },
          {
            name: "form_name",
            requirement: "required",
            value: { type: "literal", value: primaryTarget.label },
          },
          {
            name: "page_location",
            requirement: "required",
            value: { type: "built_in_variable", name: "Page URL" },
          },
        ],
      },
      firingPolicyIds: policies.map(({ id: policyId }) => policyId),
    }],
    firingPolicies: policies,
    verification: {
      positive: [
        { type: "tag_fired", tagActionId: "tag_generate_lead" },
        {
          type: "network_request",
          destination: "google_analytics_4",
          eventName: "generate_lead",
        },
      ],
      negative: [{
        type: "network_request",
        destination: "google_analytics_4",
        eventName: "generate_lead",
        scenario: "unsuccessful_submission",
      }],
    },
  };
}
