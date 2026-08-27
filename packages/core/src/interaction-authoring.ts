import { compileTrackingSetup, type CompiledTrackingSetupV1 } from "./setup-compiler.js";
import { interactionBrowserEvidenceContract } from "./browser-evidence.js";
import type { FiringConditionV1, TrackingSetupV1 } from "./setup-contract.js";
import type { ContainerContext } from "./types.js";

export type KnownInteractionTypeV1 =
  | "phone_click"
  | "email_click"
  | "outbound_click"
  | "file_download";
export type KnownInteractionEventV1 = KnownInteractionTypeV1;
export type InteractionScopeV1 = "sitewide" | "current_page";

export interface InteractionParameterSuggestionV1 {
  name: string;
  disposition: "automatic" | "excluded";
  rationale: string;
}

export interface KnownInteractionSetupRequestV1 {
  interaction: KnownInteractionTypeV1;
  scope: InteractionScopeV1;
  pageUrl: string;
  measurementId: string;
  container: ContainerContext;
}

export interface KnownInteractionSetupProposalV1 {
  interaction: KnownInteractionTypeV1;
  eventName: string;
  scope: InteractionScopeV1;
  setup: TrackingSetupV1;
  compiled: CompiledTrackingSetupV1;
  suggestions: InteractionParameterSuggestionV1[];
  privacy: {
    sent: string[];
    excluded: string[];
  };
}

export interface KnownInteractionDefinitionV1 {
  interaction: KnownInteractionTypeV1;
  eventName: KnownInteractionEventV1;
  goal: string;
  interactionLabel: string;
  singular: string;
  plural: string;
  privacySummary: string;
}

interface KnownInteractionRecipe {
  eventName: KnownInteractionEventV1;
  intent: string;
  businessOutcome: string;
  selector: string;
  scenario: string;
  conditions: (pageUrl: URL) => {
    include: FiringConditionV1[];
    exclude: FiringConditionV1[];
  };
  suggestions: InteractionParameterSuggestionV1[];
  excluded: string[];
  definition: KnownInteractionDefinitionV1;
}

const outboundSelector = "a[href^='http://'], a[href^='https://'], a[href^='//']";
const fileSelector = "a[href], area[href]";
const fileExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "zip"];
const insensitiveExtension = (extension: string): string => [...extension]
  .map((character) => `[${character.toLowerCase()}${character.toUpperCase()}]`)
  .join("");
const FILE_DOWNLOAD_URL_PATTERN = `\\.(?:${fileExtensions.map(insensitiveExtension).join("|")})(?:[?#]|$)`;
const fileDownloadUrl = new RegExp(FILE_DOWNLOAD_URL_PATTERN);
const maximumObservedInteractions = 999;

export function countKnownLinkInteractions(
  pageUrl: string,
  hrefs: string[],
): Partial<Record<KnownInteractionTypeV1, number>> {
  const page = parsedPageUrl(pageUrl);
  const counts: Record<KnownInteractionTypeV1, number> = {
    phone_click: 0,
    email_click: 0,
    outbound_click: 0,
    file_download: 0,
  };

  for (const href of hrefs) {
    let target: URL;
    try {
      target = new URL(href, page);
    } catch {
      continue;
    }
    if (target.protocol === "tel:") {
      counts.phone_click += 1;
      continue;
    }
    if (target.protocol === "mailto:") {
      counts.email_click += 1;
      continue;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      continue;
    }
    if (target.origin !== page.origin) {
      counts.outbound_click += 1;
    }
    if (fileDownloadUrl.test(target.href)) {
      counts.file_download += 1;
    }
  }

  return Object.fromEntries(
    Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([interaction, count]) => [interaction, Math.min(count, maximumObservedInteractions)]),
  );
}

function clickUrlCondition(
  operator: FiringConditionV1["operator"],
  value: string,
): FiringConditionV1 {
  return {
    variable: { type: "built_in_variable", name: "Click URL" },
    operator,
    value,
  };
}

const recipes: Record<KnownInteractionTypeV1, KnownInteractionRecipe> = {
  phone_click: {
    eventName: "phone_click",
    intent: "Track phone link clicks",
    businessOutcome: "Measure call intent",
    selector: "a[href^='tel:']",
    scenario: "phone_link",
    conditions: () => ({
      include: [clickUrlCondition("starts_with", "tel:")],
      exclude: [],
    }),
    suggestions: [
      {
        name: "page_location",
        disposition: "automatic",
        rationale: "GA4 collects page location with web events, so a duplicate custom parameter is unnecessary.",
      },
      {
        name: "phone_number",
        disposition: "excluded",
        rationale: "A phone number can identify a person and must not be sent to Google Analytics.",
      },
      {
        name: "link_url",
        disposition: "excluded",
        rationale: "The tel URL contains the phone number.",
      },
      {
        name: "link_text",
        disposition: "excluded",
        rationale: "Visible phone-link text can contain the phone number.",
      },
    ],
    excluded: ["Phone number", "tel: URL", "Visible phone-link text"],
    definition: {
      interaction: "phone_click",
      eventName: "phone_click",
      goal: "Set up phone-click tracking",
      interactionLabel: "Phone-link click",
      singular: "phone link",
      plural: "phone links",
      privacySummary: "Phone number, tel URL, and visible link text are excluded from GA4.",
    },
  },
  email_click: {
    eventName: "email_click",
    intent: "Track email link clicks",
    businessOutcome: "Measure email contact intent",
    selector: "a[href^='mailto:'], area[href^='mailto:']",
    scenario: "email_link",
    conditions: () => ({
      include: [clickUrlCondition("starts_with", "mailto:")],
      exclude: [],
    }),
    suggestions: [
      {
        name: "page_location",
        disposition: "automatic",
        rationale: "GA4 collects page location with web events, so a duplicate custom parameter is unnecessary.",
      },
      {
        name: "email_address",
        disposition: "excluded",
        rationale: "An email address can identify a person and must not be sent to Google Analytics.",
      },
      {
        name: "link_url",
        disposition: "excluded",
        rationale: "The mailto URL can contain an address and private subject or body values.",
      },
      {
        name: "link_text",
        disposition: "excluded",
        rationale: "Visible email-link text can contain an address or other private value.",
      },
    ],
    excluded: ["Email address", "mailto URL", "Subject/body values", "Visible email-link text"],
    definition: {
      interaction: "email_click",
      eventName: "email_click",
      goal: "Set up email-link tracking",
      interactionLabel: "Email-link click",
      singular: "email link",
      plural: "email links",
      privacySummary: "Email address, mailto URL, subject/body values, and visible link text are excluded from GA4.",
    },
  },
  outbound_click: {
    eventName: "outbound_click",
    intent: "Track outbound link clicks",
    businessOutcome: "Measure interest in destinations outside this website",
    selector: outboundSelector,
    scenario: "outbound_link",
    conditions: (pageUrl) => ({
      include: [],
      exclude: [clickUrlCondition("starts_with", `${pageUrl.origin}/`)],
    }),
    suggestions: [
      {
        name: "page_location",
        disposition: "automatic",
        rationale: "GA4 collects page location with web events, so a duplicate custom parameter is unnecessary.",
      },
      {
        name: "link_url",
        disposition: "excluded",
        rationale: "Destination URLs can contain query values or identifiers and are excluded by default.",
      },
      {
        name: "link_text",
        disposition: "excluded",
        rationale: "Visible link text is not required to count outbound intent and can contain private values.",
      },
    ],
    excluded: ["Destination URL", "Query string", "Visible link text"],
    definition: {
      interaction: "outbound_click",
      eventName: "outbound_click",
      goal: "Set up outbound-link tracking",
      interactionLabel: "Outbound-link click",
      singular: "outbound link",
      plural: "outbound links",
      privacySummary: "Destination URL, query string, and visible link text are excluded from GA4.",
    },
  },
  file_download: {
    eventName: "file_download",
    intent: "Track file-download link clicks",
    businessOutcome: "Measure interest in downloadable resources",
    selector: fileSelector,
    scenario: "downloadable_file_link",
    conditions: () => ({
      include: [clickUrlCondition("matches_regex", FILE_DOWNLOAD_URL_PATTERN)],
      exclude: [],
    }),
    suggestions: [
      {
        name: "page_location",
        disposition: "automatic",
        rationale: "GA4 collects page location with web events, so a duplicate custom parameter is unnecessary.",
      },
      {
        name: "file_name",
        disposition: "excluded",
        rationale: "File names can contain private or customer-specific values and are excluded by default.",
      },
      {
        name: "link_url",
        disposition: "excluded",
        rationale: "Download URLs and query strings are excluded by default.",
      },
      {
        name: "link_text",
        disposition: "excluded",
        rationale: "Visible link text is not required to count download intent.",
      },
    ],
    excluded: ["File name", "Download URL", "Query string", "Visible link text"],
    definition: {
      interaction: "file_download",
      eventName: "file_download",
      goal: "Set up file-download tracking",
      interactionLabel: "File-download click",
      singular: "downloadable file link",
      plural: "downloadable file links",
      privacySummary: "File name, download URL, query string, and visible link text are excluded from GA4.",
    },
  },
};

export function knownInteractionDefinition(value: string): KnownInteractionDefinitionV1 | undefined {
  return Object.prototype.hasOwnProperty.call(recipes, value)
    ? recipes[value as KnownInteractionTypeV1].definition
    : undefined;
}

const measurementIdPattern = /^G-[A-Z0-9]{4,20}$/;
const publicIdPattern = /^GTM-[A-Z0-9]+$/;

function parsedPageUrl(pageUrl: string): URL {
  const parsed = new URL(pageUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("pageUrl must use HTTP or HTTPS.");
  }
  return parsed;
}

export function createKnownInteractionSetupProposal(
  request: KnownInteractionSetupRequestV1,
): KnownInteractionSetupProposalV1 {
  const measurementId = request.measurementId.trim().toUpperCase();
  const publicId = request.container.publicId.trim().toUpperCase();
  if (!measurementIdPattern.test(measurementId)) {
    throw new Error("measurementId must look like G-XXXXXXXXXX.");
  }
  if (!publicIdPattern.test(publicId)) {
    throw new Error("container.publicId must look like GTM-XXXXXXX.");
  }

  const recipe = recipes[request.interaction];
  const pageUrl = parsedPageUrl(request.pageUrl);
  const path = pageUrl.pathname || "/";
  const conditions = recipe.conditions(pageUrl);
  const setup: TrackingSetupV1 = {
    schemaVersion: 1,
    id: `setup_${request.interaction}_${request.scope}`,
    status: "confirmed",
    intent: {
      statement: recipe.intent,
      businessOutcome: recipe.businessOutcome,
    },
    tagActions: [{
      id: `tag_${recipe.eventName}`,
      name: `GA4 Event - ${recipe.eventName}`,
      execution: {
        type: "template",
        templateId: "google.analytics.ga4_event",
        fields: [],
      },
      destination: { type: "ga4", measurementId },
      event: { name: recipe.eventName, parameters: [] },
      firingPolicyIds: [`policy_${request.interaction}`],
    }],
    firingPolicies: [{
      id: `policy_${request.interaction}`,
      source: { type: "click", clickMode: "links", selector: recipe.selector },
      include: [
        ...conditions.include,
        ...(request.scope === "current_page"
          ? [{
              variable: { type: "built_in_variable" as const, name: "Page Path" },
              operator: "equals" as const,
              value: path,
            }]
          : []),
      ],
      exclude: conditions.exclude,
      frequency: "once_per_event",
      consent: { required: ["analytics_storage"], whenDenied: "block" },
    }],
    verification: {
      positive: [
        { type: "tag_fired", tagActionId: `tag_${recipe.eventName}`, scenario: recipe.scenario },
        {
          type: "network_request",
          destination: "google_analytics_4",
          eventName: recipe.eventName,
          scenario: recipe.scenario,
        },
      ],
      negative: [
        { type: "tag_fired", tagActionId: `tag_${recipe.eventName}`, scenario: "non_matching_link" },
        { type: "tag_fired", tagActionId: `tag_${recipe.eventName}`, scenario: "analytics_consent_denied" },
      ],
    },
    browserEvidence: interactionBrowserEvidenceContract(request.interaction),
  };
  const compiled = compileTrackingSetup(setup, {
    ...request.container,
    publicId,
  });
  compiled.containerFile.containerVersion.name = `GTM Observability - ${recipe.eventName} setup`;
  compiled.containerFile.containerVersion.description = `${recipe.intent}. Apply to the recognized managed workspace or import with Merge; never overwrite.`;

  return {
    interaction: request.interaction,
    eventName: recipe.eventName,
    scope: request.scope,
    setup,
    compiled,
    suggestions: recipe.suggestions,
    privacy: {
      sent: [recipe.eventName, "GA4 automatically collected page context"],
      excluded: recipe.excluded,
    },
  };
}
