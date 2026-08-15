import { isNavigationIntent, normalizeNavigation } from "./navigation.js";
import type {
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

export function validateSetupRequest(request: SetupRequest): string[] {
  const errors: string[] = [];
  if (!isNavigationIntent(request.intent)) {
    errors.push("The MVP only supports navigation-click tracking intents.");
  }
  if (!MEASUREMENT_ID.test(request.measurementId)) {
    errors.push("measurementId must look like G-XXXXXXXXXX.");
  }
  if (!GTM_ID.test(request.container.publicId)) {
    errors.push("container.publicId must look like GTM-XXXXXXX.");
  }
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

function createContainerFile(request: SetupRequest): GtmContainerExport {
  const navigation = normalizeNavigation(request.navigation);
  const accountId = request.container.accountId || "0";
  const containerId = request.container.containerId || "0";
  const base = `accounts/${accountId}/containers/${containerId}`;
  const triggerId = "900001";
  const googleTagId = "900002";
  const eventTagId = "900003";
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
      description: "Generated navigation_click tracking. Import with Merge into a new workspace.",
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
          checkValidation: { type: "BOOLEAN", value: "false" },
        },
      ],
      tag: [
        {
          accountId,
          containerId,
          tagId: googleTagId,
          name: "Google tag - ConsentFlow",
          type: "googtag",
          parameter: [
            template("tagId", request.measurementId.toUpperCase()),
            {
              type: "LIST",
              key: "configSettingsTable",
              list: [map([
                ["parameter", "send_page_view"],
                ["parameterValue", "true"],
              ])],
            },
          ],
          firingTriggerId: ["2147479553"],
          tagFiringOption: "ONCE_PER_EVENT",
          monitoringMetadata: { type: "MAP", map: [] },
          consentSettings: { consentStatus: "NOT_SET" },
        },
        {
          accountId,
          containerId,
          tagId: eventTagId,
          name: "GA4 Event - navigation_click",
          type: "gaawe",
          parameter: [
            template("eventName", "navigation_click"),
            template("measurementIdOverride", request.measurementId.toUpperCase()),
            {
              type: "LIST",
              key: "eventSettingsTable",
              list: [
                map([
                  ["parameter", "link_text"],
                  ["parameterValue", "{{Click Text}}"],
                ]),
                map([
                  ["parameter", "link_url"],
                  ["parameterValue", "{{Click URL}}"],
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

  return {
    id: `setup_${fingerprint}_${randomSuffix()}`,
    eventName: "navigation_click",
    pageUrl: request.pageUrl,
    measurementId: request.measurementId.toUpperCase(),
    navigation,
    warnings: [
      "Import with Merge into a new GTM workspace. Never choose Overwrite.",
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
