import { createBrowserEvidenceContract } from "./browser-evidence.js";
import { reviewCustomCode, type CustomCodeReviewV1 } from "./custom-code.js";
import { compileTrackingSetup, type CompiledTrackingSetupV1 } from "./setup-compiler.js";
import {
  assertTrackingSetup,
  type FiringPolicyV1,
  type TrackingSetupV1,
} from "./setup-contract.js";
import type { ContainerContext } from "./types.js";

export const CALENDLY_ORIGIN = "https://calendly.com";
export const CALENDLY_PROVIDER_EVENT = "calendly.event_scheduled";
export const CALENDLY_DATA_LAYER_EVENT = "calendly_booking_complete";

export interface CalendlySetupRequestV1 {
  scope: "current_page";
  pageUrl: string;
  measurementId: string;
  container: ContainerContext;
}

export interface CalendlySetupProposalV1 {
  eventName: typeof CALENDLY_DATA_LAYER_EVENT;
  scope: "current_page";
  setup: TrackingSetupV1;
  compiled: CompiledTrackingSetupV1;
  listenerReview: CustomCodeReviewV1;
  privacy: {
    sent: string[];
    excluded: string[];
  };
}

const measurementIdPattern = /^G-[A-Z0-9]{4,20}$/;
const publicIdPattern = /^GTM-[A-Z0-9]+$/;

export function isCalendlyInlineUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === CALENDLY_ORIGIN
      && url.searchParams.get("embed_type") === "Inline";
  } catch {
    return false;
  }
}

function pagePath(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("pageUrl must use HTTP or HTTPS.");
  }

  return url.pathname || "/";
}

function listenerCode(): string {
  return `<script>(function () {
  var origin = "${CALENDLY_ORIGIN}";
  var providerEvent = "${CALENDLY_PROVIDER_EVENT}";
  var normalizedEvent = "${CALENDLY_DATA_LAYER_EVENT}";
  var completed = false;

  function inlineFrames() {
    var candidates = document.querySelectorAll("iframe");
    var frames = [];
    for (var index = 0; index < candidates.length; index += 1) {
      try {
        var sourceUrl = new URL(candidates[index].src);
        if (sourceUrl.origin === origin && sourceUrl.searchParams.get("embed_type") === "Inline") {
          frames.push(candidates[index]);
        }
      } catch (error) {
        // Ignore malformed iframe URLs; they cannot establish the provider boundary.
      }
    }
    return frames;
  }

  window.addEventListener("message", function (message) {
    if (completed || message.origin !== origin) {
      return;
    }
    if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) {
      return;
    }
    if (message.data.event !== providerEvent) {
      return;
    }
    var frames = inlineFrames();
    if (frames.length !== 1 || !frames[0].contentWindow || message.source !== frames[0].contentWindow) {
      return;
    }

    completed = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: normalizedEvent });
  });
})();</script>`;
}

function listenerPolicy(path: string): FiringPolicyV1 {
  return {
    id: "policy_calendly_completion_listener",
    source: { type: "dom_ready" },
    include: [{
      variable: { type: "built_in_variable", name: "Page Path" },
      operator: "equals",
      value: path,
    }],
    exclude: [],
    frequency: "once_per_page",
    consent: { required: ["analytics_storage"], whenDenied: "block" },
  };
}

function eventPolicy(): FiringPolicyV1 {
  return {
    id: "policy_calendly_booking_complete",
    source: { type: "custom_data_layer", eventName: CALENDLY_DATA_LAYER_EVENT },
    include: [],
    exclude: [],
    frequency: "once_per_event",
    consent: { required: ["analytics_storage"], whenDenied: "block" },
  };
}

export function createCalendlySetupProposal(
  request: CalendlySetupRequestV1,
): CalendlySetupProposalV1 {
  const measurementId = request.measurementId.trim().toUpperCase();
  const publicId = request.container.publicId.trim().toUpperCase();
  if (request.scope !== "current_page") {
    throw new Error("Calendly scope must be current_page.");
  }
  if (!measurementIdPattern.test(measurementId)) {
    throw new Error("measurementId must look like G-XXXXXXXXXX.");
  }
  if (!publicIdPattern.test(publicId)) {
    throw new Error("container.publicId must look like GTM-XXXXXXX.");
  }

  const path = pagePath(request.pageUrl);
  const listener = listenerPolicy(path);
  const booking = eventPolicy();
  const code = listenerCode();
  const listenerReview = reviewCustomCode({
    schemaVersion: 1,
    id: "calendly_completion_listener",
    vendor: "Calendly",
    authoritativeSource: {
      url: "https://calendly.com/help/advanced-calendly-embed-for-developers",
      title: "Advanced Calendly embed for developers",
      retrievedAt: "2026-08-27T00:00:00.000Z",
    },
    behaviorSummary: "Normalize one trusted Calendly booking completion without retaining callback payload data.",
    code,
    destinations: [CALENDLY_ORIGIN],
    inputs: [{ type: "event_name" }, { type: "consent_state" }],
    firingPolicies: [listener],
    verification: {
      positive: [
        { type: "tag_fired", tagActionId: "tag_calendly_completion_listener" },
        { type: "data_layer_event", eventName: CALENDLY_DATA_LAYER_EVENT },
      ],
      negative: [
        {
          type: "network_request",
          destination: "www.google-analytics.com",
          eventName: CALENDLY_DATA_LAYER_EVENT,
          scenario: "wrong_origin_source_or_event",
        },
        { type: "page_error", messagePattern: "calendly", scenario: "listener_error" },
      ],
    },
  });
  const setup: TrackingSetupV1 = {
    schemaVersion: 1,
    id: "setup_calendly_booking_current_page",
    status: "confirmed",
    intent: {
      statement: "Track completed Calendly bookings",
      businessOutcome: "Measure booked appointments",
    },
    tagActions: [
      {
        id: "tag_calendly_completion_listener",
        name: "Custom HTML - Calendly completion listener",
        execution: { type: "custom_html", html: code },
        destination: { type: "external", identifier: "Calendly" },
        firingPolicyIds: [listener.id],
      },
      {
        id: "tag_calendly_booking_complete",
        name: `GA4 Event - ${CALENDLY_DATA_LAYER_EVENT}`,
        execution: {
          type: "template",
          templateId: "google.analytics.ga4_event",
          fields: [],
        },
        destination: { type: "ga4", measurementId },
        event: { name: CALENDLY_DATA_LAYER_EVENT, parameters: [] },
        firingPolicyIds: [booking.id],
      },
    ],
    firingPolicies: [listener, booking],
    verification: {
      positive: [
        ...listenerReview.verification.positive,
        { type: "tag_fired", tagActionId: "tag_calendly_booking_complete" },
        {
          type: "network_request",
          destination: "www.google-analytics.com",
          eventName: CALENDLY_DATA_LAYER_EVENT,
        },
      ],
      negative: listenerReview.verification.negative,
    },
    browserEvidence: createBrowserEvidenceContract({
      id: "calendly-booking-complete",
      interaction: "form_submission",
      outcome: {
        required: true,
        allowedEvidenceTypes: ["provider_completion"],
        whenAbsent: "insufficient_observable_evidence",
      },
      request: {
        destination: "ga4",
        eventName: CALENDLY_DATA_LAYER_EVENT,
        requiredParameters: ["page_location"],
      },
      permittedAutomaticEvents: ["page_view", "session_start"],
      duplicatePolicy: { minimum: 1, maximum: 1 },
      dataLayerEvent: CALENDLY_DATA_LAYER_EVENT,
      tagActionId: "tag_calendly_booking_complete",
      negativeExpectations: ["matching_page_error"],
    }),
  };
  assertTrackingSetup(setup);

  return {
    eventName: CALENDLY_DATA_LAYER_EVENT,
    scope: request.scope,
    setup,
    compiled: compileTrackingSetup(setup, { ...request.container, publicId }),
    listenerReview,
    privacy: {
      sent: ["Event name", "Automatic GA4 page_location"],
      excluded: ["Invitee details", "Event URI", "Scheduled time", "Callback payload"],
    },
  };
}
