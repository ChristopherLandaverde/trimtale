import {
  assertTrackingSetup,
  validateTrackingSetup,
  type ConsentType,
  type FiringPolicyV1,
  type TrackingSetupV1,
  type VerificationExpectationV1,
} from "./setup-contract.js";

export const CUSTOM_CODE_SCHEMA_VERSION = 1 as const;

export type CustomCodeInputV1 =
  | { type: "page_url" }
  | { type: "event_name" }
  | { type: "consent_state" }
  | { type: "data_layer_key"; key: string };

export interface CustomCodeProposalV1 {
  schemaVersion: typeof CUSTOM_CODE_SCHEMA_VERSION;
  id: string;
  vendor: string;
  authoritativeSource: {
    url: string;
    title: string;
    retrievedAt: string;
  };
  behaviorSummary: string;
  code: string;
  destinations: string[];
  inputs: CustomCodeInputV1[];
  firingPolicies: FiringPolicyV1[];
  verification: {
    positive: VerificationExpectationV1[];
    negative: VerificationExpectationV1[];
  };
}

export interface CustomCodeReviewV1 {
  schemaVersion: typeof CUSTOM_CODE_SCHEMA_VERSION;
  proposalId: string;
  fingerprint: string;
  vendor: string;
  source: CustomCodeProposalV1["authoritativeSource"];
  behaviorSummary: string;
  code: string;
  destinations: string[];
  inputs: CustomCodeInputV1[];
  consentRequirements: ConsentType[];
  firingPolicyIds: string[];
  verification: CustomCodeProposalV1["verification"];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CODE_LENGTH = 100_000;
const MAX_TEXT_LENGTH = 2_000;
const MAX_ITEMS = 50;
const URL_LITERAL = /https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?/g;
const PRIVATE_READS = [
  /\bdocument\.cookie\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\b(?:input|textarea|select)\b[^;\n]{0,120}\.value\b/i,
  /querySelector(?:All)?\s*\([^)]*(?:input|textarea|select)[^)]*\)[^;\n]{0,120}\.value\b/i,
  /\bdocument\.(?:body|documentElement)\.(?:innerText|textContent|innerHTML)\b/,
];
const DYNAMIC_EXECUTION = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bFunction\s*\(/,
  /set(?:Timeout|Interval)\s*\(\s*['"]/,
];
const DYNAMIC_NETWORK = [
  /\bfetch\s*\(\s*(?!['"])/,
  /\bsendBeacon\s*\(\s*(?!['"])/,
  /\.open\s*\(\s*['"][A-Z]+['"]\s*,\s*(?!['"])/,
  /\.src\s*=\s*(?!['"])/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, max = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function httpsUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function origin(value: string): string {
  return new URL(value).origin;
}

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

function validateInputs(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    errors.push("inputs is invalid");
    return;
  }
  value.forEach((input, index) => {
    if (!isRecord(input)
      || !["page_url", "event_name", "consent_state", "data_layer_key"].includes(String(input.type))) {
      errors.push(`inputs[${index}] is invalid`);
      return;
    }
    if (input.type === "data_layer_key" && !validText(input.key, 256)) {
      errors.push(`inputs[${index}].key is required`);
    }
  });
}

export function validateCustomCode(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["custom code proposal must be an object"];
  }
  const errors: string[] = [];
  if (value.schemaVersion !== CUSTOM_CODE_SCHEMA_VERSION) {
    errors.push("schemaVersion must be 1");
  }
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id)) {
    errors.push("id is invalid");
  }
  if (!validText(value.vendor, 256)) {
    errors.push("vendor is required");
  }
  if (!isRecord(value.authoritativeSource)
    || !httpsUrl(value.authoritativeSource.url)
    || !validText(value.authoritativeSource.title, 500)
    || typeof value.authoritativeSource.retrievedAt !== "string"
    || Number.isNaN(Date.parse(value.authoritativeSource.retrievedAt))) {
    errors.push("authoritativeSource is invalid");
  }
  if (!validText(value.behaviorSummary)) {
    errors.push("behaviorSummary is required");
  }
  if (!validText(value.code, MAX_CODE_LENGTH)) {
    errors.push("code is required");
  }
  if (!Array.isArray(value.destinations)
    || value.destinations.length === 0
    || value.destinations.length > MAX_ITEMS
    || value.destinations.some((destination) => !httpsUrl(destination))) {
    errors.push("destinations must contain declared HTTPS destinations");
  }
  validateInputs(value.inputs, errors);
  if (!Array.isArray(value.firingPolicies) || value.firingPolicies.length === 0) {
    errors.push("firingPolicies requires a deterministic scope");
  }
  if (!isRecord(value.verification)
    || !Array.isArray(value.verification.positive)
    || value.verification.positive.length === 0
    || !Array.isArray(value.verification.negative)
    || value.verification.negative.length === 0) {
    errors.push("verification requires positive and negative expectations");
  }

  if (Array.isArray(value.firingPolicies)
    && isRecord(value.verification)
    && Array.isArray(value.verification.positive)
    && Array.isArray(value.verification.negative)) {
    const actionId = `tag_${typeof value.id === "string" && IDENTIFIER.test(value.id) ? value.id : "candidate"}`;
    const contractErrors = validateTrackingSetup({
      schemaVersion: 1,
      id: `setup_${typeof value.id === "string" && IDENTIFIER.test(value.id) ? value.id : "candidate"}`,
      status: "draft",
      intent: { statement: "Review custom code", businessOutcome: "Validate deterministic code scope" },
      tagActions: [{
        id: actionId,
        name: "Custom HTML review",
        execution: { type: "custom_html", html: typeof value.code === "string" && value.code ? value.code : "<!-- invalid -->" },
        destination: { type: "external", identifier: typeof value.vendor === "string" && value.vendor ? value.vendor : "unknown" },
        firingPolicyIds: value.firingPolicies.flatMap((policy) => isRecord(policy) && typeof policy.id === "string" ? [policy.id] : []),
      }],
      firingPolicies: value.firingPolicies,
      verification: {
        positive: value.verification.positive,
        negative: value.verification.negative,
      },
    }).filter((error) => error.startsWith("firingPolicies") || error.startsWith("verification"));
    errors.push(...contractErrors.map((error) => `policy.${error}`));
  }

  const code = typeof value.code === "string" ? value.code : "";
  if (PRIVATE_READS.some((pattern) => pattern.test(code))) {
    errors.push("code reads a forbidden private data source");
  }
  if (DYNAMIC_EXECUTION.some((pattern) => pattern.test(code))) {
    errors.push("code uses forbidden dynamic execution");
  }
  if (DYNAMIC_NETWORK.some((pattern) => pattern.test(code))) {
    errors.push("code uses a dynamic network destination");
  }
  const declared = new Set(
    Array.isArray(value.destinations)
      ? value.destinations.filter(httpsUrl).map(origin)
      : [],
  );
  for (const destination of code.match(URL_LITERAL) ?? []) {
    const usedOrigin = origin(destination);
    if (!declared.has(usedOrigin)) {
      errors.push(`code uses undeclared destination ${usedOrigin}`);
    }
  }
  return [...new Set(errors)];
}

export function reviewCustomCode(proposal: CustomCodeProposalV1): CustomCodeReviewV1 {
  const errors = validateCustomCode(proposal);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  const consentRequirements = [...new Set(
    proposal.firingPolicies.flatMap(({ consent }) => consent.required),
  )].sort();
  const reviewBase: Omit<CustomCodeReviewV1, "schemaVersion" | "fingerprint"> = {
    proposalId: proposal.id,
    vendor: proposal.vendor,
    source: proposal.authoritativeSource,
    behaviorSummary: proposal.behaviorSummary,
    code: proposal.code,
    destinations: [...proposal.destinations].sort(),
    inputs: proposal.inputs,
    consentRequirements,
    firingPolicyIds: proposal.firingPolicies.map(({ id }) => id).sort(),
    verification: proposal.verification,
  };
  const fingerprintInput = {
    ...reviewBase,
    firingPolicies: proposal.firingPolicies,
  };
  return {
    schemaVersion: CUSTOM_CODE_SCHEMA_VERSION,
    ...reviewBase,
    fingerprint: `custom_${shortHash(JSON.stringify(fingerprintInput))}`,
  };
}

export function createCustomCodeSetup(proposal: CustomCodeProposalV1): TrackingSetupV1 {
  reviewCustomCode(proposal);
  const actionId = `tag_${proposal.id}`;
  const setup: TrackingSetupV1 = {
    schemaVersion: 1,
    id: `setup_${proposal.id}`,
    status: "draft",
    intent: {
      statement: `Install ${proposal.vendor} browser tag`,
      businessOutcome: proposal.behaviorSummary,
    },
    tagActions: [{
      id: actionId,
      name: `Custom HTML - ${proposal.vendor}`,
      execution: { type: "custom_html", html: proposal.code },
      destination: { type: "external", identifier: proposal.vendor },
      firingPolicyIds: proposal.firingPolicies.map(({ id }) => id),
    }],
    firingPolicies: proposal.firingPolicies,
    verification: {
      positive: proposal.verification.positive,
      negative: proposal.verification.negative.map((expectation) =>
        expectation.type === "tag_fired"
          ? { ...expectation, tagActionId: actionId }
          : expectation),
    },
  };
  assertTrackingSetup(setup);
  return setup;
}
