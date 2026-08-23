import { isNavigationIntent, normalizeNavigation } from "./navigation.js";
import { assertTrackingSpecification, navigationSpecification, type SuccessEvidence } from "./contracts.js";
import type {
  FormSetupProposal,
  FormSetupRequest,
  GtmContainerExport,
  GtmParameter,
  SetupProposal,
  SetupRequest,
} from "./types.js";

const GTM_ID = /^GTM-[A-Z0-9]+$/i;
const MEASUREMENT_ID = /^G-[A-Z0-9]+$/i;

function shortHash(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (const character of value) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`.slice(0, 12);
}

function randomSuffix(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function template(key: string, value: string): GtmParameter {
  return { type: "TEMPLATE", key, value };
}

function map(entries: Array<[string, string]>): GtmParameter {
  return {
    type: "MAP",
    map: entries.map(([key, value]) => template(key, value)),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scopedUrlPattern(hrefs: string[]): string {
  return `^(?:${hrefs.map(escapeRegex).join("|")})$`;
}

function validateContainerAndMeasurement(request: Pick<SetupRequest, "measurementId" | "container">): string[] {
  const errors: string[] = [];
  if (!MEASUREMENT_ID.test(request.measurementId)) errors.push("measurementId must look like G-XXXXXXXXXX.");
  if (!GTM_ID.test(request.container.publicId)) errors.push("container.publicId must look like GTM-XXXXXXX.");
  return errors;
}

export function validateSetupRequest(request: SetupRequest): string[] {
  const errors: string[] = [];
  if (!isNavigationIntent(request.intent)) {
    errors.push("The MVP only supports navigation-click tracking intents.");
  }
  errors.push(...validateContainerAndMeasurement(request));
  try {
    const pageUrl = new URL(request.pageUrl);
    if (!/^https?:$/.test(pageUrl.protocol)) errors.push("pageUrl must use HTTP or HTTPS.");
  } catch {
    errors.push("pageUrl must be a valid URL.");
  }
  if (normalizeNavigation(request.navigation).length === 0) {
    errors.push("At least one confirmed navigation element is required.");
  }
  return errors;
}

function unsafeSelector(value: string): boolean {
  return value.length > 512 || /[<>\0]/.test(value);
}

export function validateFormSetupRequest(request: FormSetupRequest): string[] {
  const errors = validateContainerAndMeasurement(request);
  try {
    assertTrackingSpecification(request.specification);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "specification is invalid");
    return [...new Set(errors)];
  }
  const specification = request.specification;
  if (specification.status !== "confirmed") errors.push("Form setup requires a confirmed specification.");
  if (specification.interaction.type !== "form_submission" || specification.event.name !== "generate_lead") {
    errors.push("Form setup requires a form_submission generate_lead specification.");
  }
  if (!specification.conversionOutcome.practitionerConfirmed) errors.push("The qualified inquiry outcome must be practitioner-confirmed.");
  const requiredParameters = new Set(specification.event.requiredParameters);
  for (const parameter of ["form_id", "form_name", "page_location"]) {
    if (!requiredParameters.has(parameter)) errors.push(`Form setup requires the ${parameter} parameter.`);
  }
  if (specification.targets.some((target) => unsafeSelector(target.selector))) errors.push("Target selectors contain unsafe characters.");
  for (const evidence of specification.successEvidence) {
    const value = evidence.type === "visible_element" ? evidence.selector
      : evidence.type === "thank_you_url" ? evidence.urlPattern
        : evidence.type === "data_layer_event" ? evidence.eventName
          : evidence.signal;
    if (!value.trim() || unsafeSelector(value)) errors.push("Success evidence contains an unsafe or empty value.");
  }
  return [...new Set(errors)];
}

function formEvidenceTrigger(
  evidence: SuccessEvidence,
  accountId: string,
  containerId: string,
  triggerId: string,
): Record<string, unknown> {
  const common = { accountId, containerId, triggerId, name: `Form success - ${evidence.type}` };
  if (evidence.type === "visible_element") {
    return { ...common, type: "ELEMENT_VISIBILITY", parameter: [template("selector", evidence.selector), template("selectionMethod", "CSS_SELECTOR"), template("minimumPercentVisible", "1"), template("onScreenDuration", "0"), template("firingFrequency", "ONCE_PER_PAGE")] };
  }
  if (evidence.type === "thank_you_url") {
    return { ...common, type: "PAGEVIEW", filter: [{ type: "MATCH_REGEX", parameter: [template("arg0", "{{Page URL}}"), template("arg1", evidence.urlPattern)] }] };
  }
  const eventName = evidence.type === "data_layer_event" ? evidence.eventName : evidence.signal;
  return { ...common, type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [template("arg0", "{{_event}}"), template("arg1", eventName)] }] };
}

function createFormContainerFile(request: FormSetupRequest): GtmContainerExport {
  const { specification } = request;
  const accountId = request.container.accountId || "0";
  const containerId = request.container.containerId || "0";
  const base = `accounts/${accountId}/containers/${containerId}`;
  const triggers = specification.successEvidence.map((item, index) => formEvidenceTrigger(item, accountId, containerId, String(910001 + index)));
  const primaryTarget = specification.targets[0]!;
  return {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      path: `${base}/versions/0`, accountId, containerId, containerVersionId: "0",
      name: "GTM Observability - Confirmed form setup",
      description: "Generated generate_lead tracking from practitioner-confirmed success evidence. Apply to the recognized managed workspace or import with Merge; never overwrite.",
      container: { path: base, accountId, containerId, name: request.container.name || "GTM Observability import", publicId: request.container.publicId, usageContext: ["WEB"] },
      trigger: triggers,
      tag: [{
        accountId, containerId, tagId: "919999", name: "GA4 Event - generate_lead", type: "gaawe",
        parameter: [
          template("eventName", "generate_lead"),
          template("measurementId", request.measurementId.toUpperCase()),
          { type: "LIST", key: "eventParameters", list: [
            map([["name", "form_id"], ["value", primaryTarget.id]]),
            map([["name", "form_name"], ["value", primaryTarget.label]]),
            map([["name", "page_location"], ["value", "{{Page URL}}"]]),
          ] },
        ],
        firingTriggerId: triggers.map((_, index) => String(910001 + index)),
        tagFiringOption: "ONCE_PER_EVENT",
        monitoringMetadata: { type: "MAP", map: [] },
        consentSettings: { consentStatus: "NOT_SET" },
      }],
      builtInVariable: [{ accountId, containerId, type: "PAGE_URL", name: "Page URL" }],
    },
  };
}

export function createFormSetupProposal(request: FormSetupRequest): FormSetupProposal {
  const errors = validateFormSetupRequest(request);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const fingerprint = shortHash(JSON.stringify({ specification: request.specification, measurementId: request.measurementId }));
  return {
    id: `form_setup_${fingerprint}_${randomSuffix()}`,
    specification: request.specification,
    eventName: "generate_lead",
    measurementId: request.measurementId.toUpperCase(),
    warnings: [
      "Apply to the recognized managed workspace, or import with Merge into an existing review workspace. Never choose Overwrite.",
      "This setup uses browser-observable success evidence and does not confirm GA4 platform processing.",
      "Review every generated trigger before publishing. Production publishing is not performed.",
    ],
    preflight: { status: "passed", checks: [
      `${request.specification.targets.length} form target(s) practitioner-confirmed`,
      `${request.specification.successEvidence.length} success signal(s) confirmed`,
      "Required parameters contain form metadata only; submitted values are excluded",
      "Measurement and container ID formats are valid",
    ] },
    containerFile: createFormContainerFile(request),
  };
}

function createContainerFile(request: SetupRequest): GtmContainerExport {
  const navigation = normalizeNavigation(request.navigation);
  const accountId = request.container.accountId || "0";
  const containerId = request.container.containerId || "0";
  const base = `accounts/${accountId}/containers/${containerId}`;
  const triggerId = "900001";
  const tagId = "900002";
  const pattern = scopedUrlPattern([...new Set(navigation.map((item) => item.href))]);

  return {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      path: `${base}/versions/0`,
      accountId,
      containerId,
      containerVersionId: "0",
      name: "GTM Observability - Navigation click setup",
      description: "Generated navigation_click tracking. Apply to the recognized managed workspace or import with Merge; never overwrite.",
      container: {
        path: base,
        accountId,
        containerId,
        name: request.container.name || "GTM Observability import",
        publicId: request.container.publicId,
        usageContext: ["WEB"],
      },
      trigger: [
        {
          accountId,
          containerId,
          triggerId,
          name: "CE - Navigation Links - Confirmed Scope",
          type: "JUST_LINKS",
          autoEventFilter: [
            {
              type: "MATCH_REGEX",
              parameter: [
                template("arg0", "{{Click URL}}"),
                template("arg1", pattern),
                { type: "BOOLEAN", key: "ignore_case", value: "false" },
              ],
            },
          ],
          waitForTags: { type: "BOOLEAN", value: "false" },
          checkValidation: { type: "BOOLEAN", value: "true" },
        },
      ],
      tag: [
        {
          accountId,
          containerId,
          tagId,
          name: "GA4 Event - navigation_click",
          type: "gaawe",
          parameter: [
            template("eventName", "navigation_click"),
            template("measurementId", request.measurementId.toUpperCase()),
            {
              type: "LIST",
              key: "eventParameters",
              list: [
                map([
                  ["name", "link_text"],
                  ["value", "{{Click Text}}"],
                ]),
                map([
                  ["name", "link_url"],
                  ["value", "{{Click URL}}"],
                ]),
              ],
            },
          ],
          firingTriggerId: [triggerId],
          tagFiringOption: "ONCE_PER_EVENT",
          monitoringMetadata: { type: "MAP", map: [] },
          consentSettings: { consentStatus: "NOT_SET" },
        },
      ],
      builtInVariable: [
        { accountId, containerId, type: "CLICK_TEXT", name: "Click Text" },
        { accountId, containerId, type: "CLICK_URL", name: "Click URL" },
      ],
    },
  };
}

export function createSetupProposal(request: SetupRequest): SetupProposal {
  const errors = validateSetupRequest(request);
  if (errors.length > 0) throw new Error(errors.join(" "));

  const navigation = normalizeNavigation(request.navigation);
  const fingerprint = shortHash(
    JSON.stringify({
      pageUrl: request.pageUrl,
      measurementId: request.measurementId,
      navigation,
    }),
  );

  const id = `setup_${fingerprint}_${randomSuffix()}`;
  return {
    id,
    specification: navigationSpecification(`spec_${fingerprint}`, request.intent, request.pageUrl, navigation),
    eventName: "navigation_click",
    pageUrl: request.pageUrl,
    measurementId: request.measurementId.toUpperCase(),
    navigation,
    warnings: [
      "Apply to the recognized managed workspace, or import with Merge into an existing review workspace. Never choose Overwrite.",
      "This preflight does not confirm GA4 platform processing.",
    ],
    preflight: {
      status: "passed",
      checks: [
        `${navigation.length} navigation element(s) confirmed`,
        "Measurement ID format is valid",
        "Generated trigger is scoped to confirmed link URLs",
        "Required click variables are included",
      ],
    },
    containerFile: createContainerFile({ ...request, navigation }),
  };
}
