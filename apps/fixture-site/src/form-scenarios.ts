export type FormTransport = "native" | "redirect" | "ajax" | "spa";
export type SubmissionResult = "success" | "validation_error" | "server_error";
export type TrackingState = "correct" | "event_missing" | "tag_not_firing" | "request_missing" | "missing_parameter" | "duplicate_fire";
export type FormPresentation = "static" | "dynamic" | "multiple" | "cross_origin_iframe";

export interface FormFixtureScenario {
  id: string;
  submissionResult: SubmissionResult;
  transport: FormTransport;
  consent: "granted" | "denied" | "unknown";
  trackingState: TrackingState;
  presentation: FormPresentation;
  outcomeObserved: boolean;
  dataLayerEvent: boolean;
  tagFired: boolean;
  ga4RequestCount: 0 | 1 | 2;
  includeRequiredParameters: boolean;
}

const scenario = (value: FormFixtureScenario): FormFixtureScenario => Object.freeze(value);

export const formFixtureScenarios = Object.freeze({
  successful_correct: scenario({ id: "successful_correct", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "correct", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: true }),
  validation_failure: scenario({ id: "validation_failure", submissionResult: "validation_error", transport: "native", consent: "granted", trackingState: "correct", presentation: "static", outcomeObserved: false, dataLayerEvent: false, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
  attempt_only: scenario({ id: "attempt_only", submissionResult: "success", transport: "ajax", consent: "unknown", trackingState: "event_missing", presentation: "static", outcomeObserved: false, dataLayerEvent: false, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
  ajax_success: scenario({ id: "ajax_success", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "correct", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: true }),
  thank_you_redirect: scenario({ id: "thank_you_redirect", submissionResult: "success", transport: "redirect", consent: "granted", trackingState: "correct", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: true }),
  spa_success: scenario({ id: "spa_success", submissionResult: "success", transport: "spa", consent: "granted", trackingState: "correct", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: true }),
  outcome_event_missing: scenario({ id: "outcome_event_missing", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "event_missing", presentation: "static", outcomeObserved: true, dataLayerEvent: false, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
  datalayer_tag_not_firing: scenario({ id: "datalayer_tag_not_firing", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "tag_not_firing", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
  tag_fired_request_missing: scenario({ id: "tag_fired_request_missing", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "request_missing", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 0, includeRequiredParameters: true }),
  missing_required_parameter: scenario({ id: "missing_required_parameter", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "missing_parameter", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: false }),
  duplicate_request: scenario({ id: "duplicate_request", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "duplicate_fire", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 2, includeRequiredParameters: true }),
  consent_denied: scenario({ id: "consent_denied", submissionResult: "success", transport: "ajax", consent: "denied", trackingState: "request_missing", presentation: "static", outcomeObserved: true, dataLayerEvent: true, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
  server_error: scenario({ id: "server_error", submissionResult: "server_error", transport: "ajax", consent: "granted", trackingState: "event_missing", presentation: "static", outcomeObserved: false, dataLayerEvent: false, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
  dynamic_form: scenario({ id: "dynamic_form", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "correct", presentation: "dynamic", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: true }),
  multiple_forms: scenario({ id: "multiple_forms", submissionResult: "success", transport: "ajax", consent: "granted", trackingState: "correct", presentation: "multiple", outcomeObserved: true, dataLayerEvent: true, tagFired: true, ga4RequestCount: 1, includeRequiredParameters: true }),
  cross_origin_iframe: scenario({ id: "cross_origin_iframe", submissionResult: "success", transport: "native", consent: "unknown", trackingState: "event_missing", presentation: "cross_origin_iframe", outcomeObserved: false, dataLayerEvent: false, tagFired: false, ga4RequestCount: 0, includeRequiredParameters: true }),
} satisfies Record<string, FormFixtureScenario>);

export function getFormFixtureScenario(id: string | null): FormFixtureScenario {
  return formFixtureScenarios[id as keyof typeof formFixtureScenarios] ?? formFixtureScenarios.successful_correct;
}
