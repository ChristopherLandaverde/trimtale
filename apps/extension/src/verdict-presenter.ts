import { safeRequestUrl, type ScenarioVerdictCode, type TrackingRunEvidenceV1 } from "@trimtale/core";

/**
 * Turns a deterministic run verdict into a finding the practitioner can act on:
 * observed → why it matters → fix → verify, with the raw codes kept as evidence.
 *
 * The verdict code and the browser/platform states stay the source of truth; this module
 * only words them. Copy follows the ux-standards finding model used by ConsentFlow.
 * Text wrapped in backticks is rendered as mono evidence (event and parameter names).
 */

export type FindingStatus = "verified" | "broken" | "review" | "not_checked";

export interface FindingEvidenceRow {
  label: string;
  value: string;
}

export interface VerdictFinding {
  code: ScenarioVerdictCode;
  status: FindingStatus;
  statusLabel: string;
  symbol: string;
  title: string;
  observed: string;
  consequence: string;
  fix: string;
  verify: string;
  evidence: FindingEvidenceRow[];
}

export const findingStatusTags: Record<FindingStatus, { label: string; symbol: string }> = {
  verified: { label: "Verified", symbol: "✓" },
  broken: { label: "Broken", symbol: "×" },
  review: { label: "Review", symbol: "!" },
  not_checked: { label: "Not checked", symbol: "–" },
};

export interface VerdictContext {
  /** Practitioner-facing name of the form or link, taken from the page. */
  targetLabel?: string;
}

type Observations = TrackingRunEvidenceV1["observations"];

const requiredFormParameters = [
  { key: "form_id", present: (parameters: URLSearchParams) => Boolean(parameters.get("ep.form_id")) },
  { key: "form_name", present: (parameters: URLSearchParams) => Boolean(parameters.get("ep.form_name")) },
  {
    key: "page_location",
    present: (parameters: URLSearchParams) => Boolean(parameters.get("ep.page_location") || parameters.get("dl")),
  },
];

/** Page-sourced labels are shown as plain text; backticks would otherwise turn into code spans. */
function plainLabel(value: string | undefined, fallback: string): string {
  const label = value?.replaceAll("`", "'").replace(/\s+/g, " ").trim();
  if (!label) return fallback;
  return label.length > 60 ? `${label.slice(0, 57)}…` : label;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function missingParameters(observations: Observations): string[] {
  const url = observations.network.ga4Requests[0]?.url;
  if (!url) return requiredFormParameters.map((item) => item.key);
  try {
    const parameters = new URL(url).searchParams;
    return requiredFormParameters.filter((item) => !item.present(parameters)).map((item) => item.key);
  } catch {
    return requiredFormParameters.map((item) => item.key);
  }
}

function responseStatusOf(observations: Observations): number | undefined {
  const status = (observations.interaction as { responseStatus?: unknown }).responseStatus;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}

function successSignalLabel(observations: Observations): string {
  const type = observations.outcome.evidenceType;
  if (type === "thank_you_url") return "the thank-you page loaded";
  if (type === "visible_element") return "the success message appeared";
  if (type === "data_layer_event") return "the success event was pushed";
  return "the form reported success";
}

/**
 * Request parameters shown for the captured request. A subset of the core request allowlist:
 * page URLs (`dl`, `ep.page_location`) and the consent string (`gcs`) are never displayed.
 */
const displayedRequestParameters = ["tid", "en", "ep.form_id", "ep.form_name"] as const;
const maxRequestValueLength = 80;

function boundedValue(value: string): string {
  return value.length > maxRequestValueLength ? `${value.slice(0, maxRequestValueLength - 1)}…` : value;
}

/**
 * The first captured GA4 request, as host plus allowlisted parameters. Navigation evidence carries
 * raw request URLs, so the URL is re-sanitized here; anything unparseable or off-allowlist yields no rows.
 */
function capturedRequestRows(observations: Observations): FindingEvidenceRow[] {
  const raw = observations.network.ga4Requests[0]?.url;
  const safe = raw ? safeRequestUrl(raw) : undefined;
  if (!safe) return [];
  try {
    const url = new URL(safe);
    const prefix = "network.ga4Requests[0]";
    const rows: FindingEvidenceRow[] = [{ label: `${prefix}.host`, value: url.host }];
    for (const key of displayedRequestParameters) {
      const value = url.searchParams.get(key)?.trim();
      if (value) rows.push({ label: `${prefix}.${key}`, value: boundedValue(value) });
    }
    return rows;
  } catch {
    return [];
  }
}

/** Raw contract fields, labelled by their path in `TrackingRunEvidenceV1`. */
function evidenceRows(evidence: TrackingRunEvidenceV1): FindingEvidenceRow[] {
  const { observations, verdict } = evidence;
  const rows: FindingEvidenceRow[] = [
    { label: "verdict.code", value: verdict.code },
    { label: "verdict.browserVerification", value: verdict.browserVerification },
    { label: "verdict.platformConfirmation", value: verdict.platformConfirmation },
  ];
  if (observations.interaction.type === "form_submission") {
    rows.push(
      { label: "interaction.submissionResult", value: observations.interaction.submissionResult },
      ...(responseStatusOf(observations) !== undefined
        ? [{ label: "interaction.responseStatus", value: String(responseStatusOf(observations)) }]
        : []),
      { label: "outcome.observed", value: String(observations.outcome.observed) },
      { label: "consent.analyticsStorage", value: observations.consent.analyticsStorage },
      { label: "dataLayer.matchingEvents", value: String(observations.dataLayer.matchingEvents.length) },
    );
  } else {
    rows.push({ label: "outcome.observed", value: String(observations.outcome.observed) });
  }
  rows.push(
    { label: "network.ga4Requests", value: String(observations.network.ga4Requests.length) },
    ...capturedRequestRows(observations),
    { label: "runId", value: evidence.runId },
  );
  return rows;
}

function finding(
  evidence: TrackingRunEvidenceV1,
  status: FindingStatus,
  copy: Pick<VerdictFinding, "title" | "observed" | "consequence" | "fix" | "verify">,
): VerdictFinding {
  return {
    code: evidence.verdict.code,
    status,
    statusLabel: findingStatusTags[status].label,
    symbol: findingStatusTags[status].symbol,
    ...copy,
    evidence: evidenceRows(evidence),
  };
}

function presentFormVerdict(evidence: TrackingRunEvidenceV1, target: string): VerdictFinding {
  const { observations, verdict } = evidence;
  const requests = observations.network.ga4Requests.length;
  const success = successSignalLabel(observations);
  const platformNote = "Platform confirmation is not available yet, so GA4 processing is unconfirmed.";
  // Present once the core records the form endpoint's HTTP status (evidence field added in #63).
  const status = responseStatusOf(observations);
  const leadSentAnyway = requests > 0
    ? ` A \`generate_lead\` request was still sent, so GA4 may count a lead that does not exist.`
    : "";

  switch (verdict.code) {
    case "browser_verified":
      return finding(evidence, "verified", {
        title: "Lead tracking works in this browser",
        observed: `After ${success}, the browser sent one \`generate_lead\` request to Google Analytics.`,
        consequence: `Successful ${target} submissions reach GA4 from this page. ${platformNote}`,
        fix: "No browser fix is needed.",
        verify: "Look for `generate_lead` in GA4 Realtime. Rerun after any GTM or form change.",
      });
    case "expected_non_conversion": {
      const result = observations.interaction.submissionResult;
      if (result === "validation_error" && status !== undefined) {
        // The form endpoint answered 4xx: the submission was rejected, whatever the page showed.
        if (observations.outcome.observed) {
          return finding(evidence, "broken", {
            title: "The form rejected the submission, but the page showed success",
            observed: `The page reported success, but the form endpoint rejected the submission with HTTP ${status}.${leadSentAnyway}`,
            consequence: requests > 0
              ? "Visitors see a confirmation for a lead you never received, and reports may count it."
              : "Visitors see a confirmation for a lead you never received.",
            fix: "Show success and push `generate_lead` only after the endpoint accepts the submission.",
            verify: "Submit valid input. Success and one `generate_lead` request should follow an accepted response.",
          });
        }
        return finding(evidence, requests > 0 ? "broken" : "not_checked", {
          title: "The form endpoint rejected this attempt, so it is not a lead",
          observed: `The form endpoint rejected the submission with HTTP ${status}.${leadSentAnyway}`,
          consequence: requests > 0
            ? "A rejected submission is not a lead, yet reports may count it."
            : "A rejected submission is not a lead, so tracking was not tested on this attempt.",
          fix: requests > 0
            ? "Push `generate_lead` only after the endpoint accepts the submission."
            : "Correct the input and submit again.",
          verify: "A valid submission should show the success signal and one `generate_lead` request.",
        });
      }
      if (result === "validation_error") {
        return finding(evidence, "not_checked", {
          title: "This attempt was not counted as a lead",
          observed: "Form validation stopped the submission before it was accepted.",
          consequence: "A validation error is not a lead, so tracking was not tested on this attempt.",
          fix: "Correct the input and submit again.",
          verify: "A valid submission should show the success signal and one `generate_lead` request.",
        });
      }
      return finding(evidence, "not_checked", {
        title: "This attempt was not counted as a lead",
        observed: `The form was submitted, but the success signal for ${target} did not appear.`,
        consequence: "Without a success signal there is no lead, so tracking was not tested.",
        fix: "Submit again with input the form accepts.",
        verify: "A successful submission should show the success signal and one `generate_lead` request.",
      });
    }
    case "submission_failed": {
      const answer = status !== undefined ? `HTTP ${status}` : "a server error";
      if (observations.outcome.observed) {
        return finding(evidence, "broken", {
          title: "The form failed, but the page showed success",
          observed: `The page reported success, but the form endpoint returned ${answer}.${leadSentAnyway}`,
          consequence: requests > 0
            ? "Visitors see a confirmation for a lead you never received, and reports may count it."
            : "Visitors see a confirmation for a lead you never received.",
          fix: "Fix the server error. Show success and push `generate_lead` only after a successful response.",
          verify: "Submit again. Success and one `generate_lead` request should follow a successful response.",
        });
      }
      return finding(evidence, "broken", {
        title: "The form submission failed, so no lead was created",
        observed: `The form endpoint returned ${answer} after submit.${leadSentAnyway}`,
        consequence: requests > 0
          ? "Visitors who submit this form may not become leads, yet reports may count them."
          : "Visitors who submit this form may not become leads, and no lead request was sent.",
        fix: "Fix the form or server error, then rerun browser verification.",
        verify: "Submit once more. The success signal and one `generate_lead` request should follow.",
      });
    }
    case "outcome_observed_event_missing":
      return finding(evidence, "broken", {
        title: "The form succeeded, but no lead event was sent",
        observed: `${success.charAt(0).toUpperCase()}${success.slice(1)}, but no \`generate_lead\` event reached the data layer.`,
        consequence: "Leads from this form are likely missing from GA4 and every report built on it.",
        fix: "Push the confirmed `generate_lead` data-layer event after the form succeeds.",
        verify: "Submit again. One `generate_lead` event and one GA4 request should follow.",
      });
    case "datalayer_event_observed_tag_not_firing":
      return finding(evidence, "broken", {
        title: "The lead event was pushed, but the GA4 tag did not fire",
        observed: "`generate_lead` reached the data layer, but no GA4 tag fired for it.",
        consequence: "Leads from this form are likely missing from GA4.",
        fix: "In GTM Preview, compare the trigger's conditions with the `generate_lead` event.",
        verify: "Submit again. GTM Preview should show the tag fired once.",
      });
    case "tag_fired_request_missing":
      return finding(evidence, "broken", {
        title: "The GA4 tag fired, but no request reached Google",
        observed: "The tag fired for `generate_lead`, but the browser sent no GA4 collection request.",
        consequence: "Leads from this form are likely missing from GA4.",
        fix: "Inspect the GA4 tag's measurement ID, consent settings and any blocked requests.",
        verify: "Submit again. One `/g/collect` request with `en=generate_lead` should appear.",
      });
    case "missing_parameter": {
      const missing = missingParameters(observations).map((key) => `\`${key}\``);
      const list = missing.length === 0
        ? "required parameters"
        : missing.length === 1
          ? missing[0]!
          : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
      return finding(evidence, "broken", {
        title: "Leads reach GA4 without their required details",
        observed: `The \`generate_lead\` request was sent without ${list}.`,
        consequence: "GA4 counts the lead but cannot say which form or page produced it.",
        fix: `Add ${list} to the GA4 \`generate_lead\` tag.`,
        verify: "Submit again. The request should carry every required parameter.",
      });
    }
    case "duplicate_fire":
      return finding(evidence, "broken", {
        title: `One submission sent ${plural(requests, "lead request")}`,
        observed: `The browser sent ${plural(requests, "`generate_lead` request")} for a single ${target} submission.`,
        consequence: "Each lead may be counted more than once, so lead totals are likely inflated.",
        fix: "Remove the duplicate tag or overlapping trigger so the request fires once.",
        verify: "Submit again. Exactly one `generate_lead` request should appear.",
      });
    case "consent_limited":
      return finding(evidence, "review", {
        title: "Analytics consent was denied, so tracking could not be judged",
        observed: "`analytics_storage` was `denied` when the form succeeded.",
        consequence: "GA4 may receive limited pings or nothing, depending on your consent setup.",
        fix: "Confirm the intended consent behavior before changing tracking.",
        verify: "Grant analytics consent, reload and submit again.",
      });
    case "insufficient_observable_evidence":
    default:
      if (observations.interaction.attempted && observations.outcome.observed && observations.tagFired === null) {
        return finding(evidence, "not_checked", {
          title: "Trimtale could not see whether the GA4 tag fired",
          observed: "The form succeeded, but no tag-firing signal was observable on this page.",
          consequence: "Without that signal the run cannot say whether leads reach GA4.",
          fix: verdict.nextAction,
          verify: "Rerun verification once the signal is observable.",
        });
      }
      return finding(evidence, "not_checked", {
        title: "Trimtale could not see whether the submission succeeded",
        observed: observations.interaction.attempted
          ? `No browser-observable success signal was available for ${target}.`
          : `No submission of ${target} was observed.`,
        consequence: "Without a success signal the run cannot say whether leads are tracked.",
        fix: verdict.nextAction,
        verify: "Rerun verification and submit the form once.",
      });
  }
}

function presentNavigationVerdict(evidence: TrackingRunEvidenceV1, target: string): VerdictFinding {
  const requests = evidence.observations.network.ga4Requests.length;
  switch (evidence.verdict.code) {
    case "browser_verified":
      return finding(evidence, "verified", {
        title: "Link-click tracking works in this browser",
        observed: `Clicking ${target} sent one \`navigation_click\` request to Google Analytics.`,
        consequence: "Clicks on the confirmed links reach GA4. Platform confirmation is not available yet.",
        fix: "No browser fix is needed.",
        verify: "Look for `navigation_click` in GA4 Realtime. Rerun after any GTM change.",
      });
    case "duplicate_fire":
      return finding(evidence, "broken", {
        title: `One click sent ${plural(requests, "GA4 request")}`,
        observed: `Clicking ${target} sent ${plural(requests, "GA4 request")} instead of one.`,
        consequence: "Each click may be counted more than once, so click totals are likely inflated.",
        fix: "In GTM, remove the duplicate tag or overlapping trigger.",
        verify: "Click the link again. Exactly one GA4 request should appear.",
      });
    case "tag_fired_request_missing":
      return finding(evidence, "broken", {
        title: "The link was clicked, but no GA4 request was sent",
        observed: `Clicking ${target} produced no GA4 collection request.`,
        consequence: "Clicks on this link are likely missing from GA4.",
        fix: "Open GTM Preview to see whether the `navigation_click` tag fired.",
        verify: "Click the link again. One GA4 request should appear.",
      });
    default:
      return finding(evidence, "not_checked", {
        title: "The click did not match a confirmed link",
        observed: "The clicked link was not one of the links confirmed for tracking.",
        consequence: "This run cannot say whether the confirmed links are tracked.",
        fix: "Click one of the highlighted links.",
        verify: "One GA4 request should follow the click.",
      });
  }
}

export function presentVerdict(evidence: TrackingRunEvidenceV1, context: VerdictContext = {}): VerdictFinding {
  if (evidence.observations.interaction.type === "navigation_click") {
    return presentNavigationVerdict(evidence, plainLabel(context.targetLabel, "the link"));
  }
  return presentFormVerdict(evidence, plainLabel(context.targetLabel, "the form"));
}
