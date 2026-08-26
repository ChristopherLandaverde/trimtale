import {
  agentTurnForIntake,
  countKnownLinkInteractions,
  createFormSetupProposal,
  createKnownInteractionSetupProposal,
  createSetupProposal,
  determineFormVerdict,
  isAgentTurnV1,
  knownInteractionDefinition,
  normalizeFormRunEvidence,
  observeGtmRuntime,
  selectConversationSuccess,
  selectConversationScope,
  selectConversationTarget,
  type BrowserEvidence,
  type AgentTurnContext,
  type AgentTaskStatus,
  type AgentTurnV1,
  type ConversationIntakeResult,
  type ExactDraftBrowserRunV1,
  type FormCandidate,
  type Ga4ActionReceiptV1,
  type Ga4ConfigurationActionV1,
  type Ga4ConfigurationPlanV1,
  type KnownInteractionSetupProposalV1,
  type KnownInteractionTypeV1,
  type NavigationArea,
  type NavigationElement,
  type SuccessEvidence,
  type SetupProposal,
  type SetupAuthoringGroundingV1,
  type SetupAuthoringInputV1,
  type TrackingSetupV1,
  type TrackingRunEvidenceV1,
  type TrackingSpecificationV1,
} from "@gtm-observability/core";

declare global {
  interface Window { __gtmObservabilityInstalled?: boolean; }
}

interface OverlayPreferences {
  x?: number;
  y?: number;
  width: number;
  height: number;
  collapsed: boolean;
}

interface ScanResponse { pageUrl: string; title: string; navigation: NavigationElement[]; }

interface GtmWorkspaceResult {
  status: "available" | "capacity_blocked" | "ownership_conflict" | "created" | "reused" | "sync_conflict";
  action?: "create" | "reuse";
  workspaceCount: number;
  remainingSlots?: number;
  managedWorkspaceCount?: number;
  reservedNameCount?: number;
  workspace?: { name: string; workspaceId: string };
}

interface GtmContainerResult {
  status: "recognized" | "not_accessible" | "ambiguous";
  publicId: string;
  matchCount?: number;
  account?: { accountId: string; name: string };
  container?: { accountId: string; containerId: string; name: string; publicId: string };
  measurementIds?: string[];
  workspace?: GtmWorkspaceResult;
}

interface GtmBridgeResponse {
  ok: boolean;
  error?: string;
  result?: GtmContainerResult;
  containerWritesEnabled?: boolean;
}

interface PlanActionSummary {
  kind: "tag" | "trigger" | "variable" | "builtInVariable";
  action: "create" | "reuse" | "no_op" | "update" | "conflict";
  generatedName: string;
  reason?: "managed_change_requires_approval";
  entitySignature?: string;
  existingId?: string;
  replacement?: {
    currentFingerprint: string;
    currentSemantics: string;
    proposedSemantics: string;
  };
}

interface WorkflowPlanSummary {
  operationId: string;
  status: "planned";
  planStatus: "ready" | "conflict";
  fingerprint: string;
  actions: PlanActionSummary[];
  replacementApproved?: boolean;
}

interface WorkflowPlanResponse {
  ok: boolean;
  error?: "invalid_request" | "planning_blocked" | "planning_unavailable" | "invalid_response" | "service_offline";
  result?: WorkflowPlanSummary;
}

interface WorkflowResumeSummary {
  operationId: string;
  status: "awaiting_preview" | "versioned" | "blocked" | "paused";
  stage?: "planning" | "application" | "validation" | "version";
  validationStatus?: "passed";
  versionFingerprint?: string;
  nextStep?: "run_tag_assistant_preview" | "await_approval";
  setupFingerprint?: string;
  workspaceFingerprint?: string;
  previewVersionFingerprint?: string;
}

interface WorkflowResumeResponse {
  ok: boolean;
  error?: "invalid_request" | "workflow_unavailable" | "invalid_response" | "service_offline";
  result?: WorkflowResumeSummary;
}

interface WorkflowRepairSummary {
  operationId: string;
  status: "repair_ready";
  planFingerprint: string;
  reasonCode: "workspace_entity_drift";
  attempt: number;
  maximumAttempts: number;
  actions: PlanActionSummary[];
}

interface WorkflowRepairResponse {
  ok: boolean;
  error?: "invalid_request" | "repair_unavailable" | "repair_rejected" | "invalid_response" | "service_offline";
  result?: WorkflowRepairSummary;
}

interface WorkflowPublicationSummary {
  operationId: string;
  status: "approved" | "published";
  versionFingerprint: string;
  approvedAt?: string;
  publishedAt?: string;
}

interface WorkflowPublicationResponse {
  ok: boolean;
  error?: "invalid_request" | "publication_disabled" | "publication_stale" | "publication_unavailable" | "invalid_response" | "service_offline";
  result?: WorkflowPublicationSummary;
}

interface WorkflowLiveVerificationSummary {
  operationId: string;
  status: "published" | "completed" | "rollback_required";
  nextStep: "verify_publication" | "complete" | "rollback";
  versionFingerprint: string;
  evidenceRunId: string;
  targetVersionFingerprint?: string;
}

interface WorkflowLiveVerificationResponse {
  ok: boolean;
  error?: "invalid_request" | "verification_rejected" | "invalid_response" | "service_offline";
  result?: WorkflowLiveVerificationSummary;
}

interface WorkflowRollbackSummary {
  operationId: string;
  status: "rolled_back";
  nextStep: "complete";
  versionFingerprint: string;
  targetVersionFingerprint: string;
  completedAt: string;
}

interface WorkflowRollbackResponse {
  ok: boolean;
  error?: "invalid_request" | "rollback_rejected" | "invalid_response" | "service_offline";
  result?: WorkflowRollbackSummary;
}

interface SetupAuthoringResponse {
  ok: boolean;
  error?: "invalid_request" | "authoring_unavailable" | "authoring_rejected" | "invalid_response" | "service_offline";
  result?: {
    providerId: string;
    eventName: string;
    rationale: string;
    suggestions: Array<{ name: string; classification: string; rationale: string }>;
    setup: TrackingSetupV1;
  };
}

interface Ga4ConfigurationResponse {
  ok: boolean;
  error?: "invalid_request" | "configuration_stale" | "writes_disabled" | "configuration_unavailable" | "invalid_response" | "service_offline";
  result?: Ga4ConfigurationPlanV1 | {
    status: "applied";
    receipts: Ga4ActionReceiptV1[];
    providerStateFingerprint: string;
  };
}

interface GtmConnectionStatus {
  configured: boolean;
  connected: boolean;
  scope: "read-only" | "container-edit";
  containerWritesEnabled: boolean;
  publicationScopeRequested: boolean;
  publicationEnabled: boolean;
  tokenPersistenceEnabled: boolean;
  analyticsReadEnabled: boolean;
}

interface EnhancedMeasurementSettings {
  stream: boolean;
  pageViews: boolean;
  scrolls: boolean;
  outboundClicks: boolean;
  siteSearch: boolean;
  videoEngagement: boolean;
  fileDownloads: boolean;
  formInteractions: boolean;
}

interface EnhancedMeasurementAudit {
  measurementId: string;
  property: { propertyId: string; name: string };
  stream: { streamId: string; name: string };
  settings: EnhancedMeasurementSettings;
  canEnable: boolean;
}

interface GtmConnectionContext {
  status: GtmConnectionStatus;
  containerIds: string[];
  recognitionError?: "recognition_unavailable";
  result?: GtmContainerResult;
  enhancedMeasurement?: EnhancedMeasurementAudit;
  enhancedMeasurementError?: "unavailable";
}

type GtmConnectionView =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "check_failed" }
  | { kind: "unconfigured"; containerIds: string[] }
  | { kind: "disconnected"; containerIds: string[] }
  | { kind: "no_container"; status: GtmConnectionStatus }
  | { kind: "multiple_containers"; status: GtmConnectionStatus; containerIds: string[] }
  | { kind: "recognition_failed"; status: GtmConnectionStatus; publicId: string }
  | { kind: "not_accessible"; status: GtmConnectionStatus; publicId: string }
  | { kind: "ambiguous"; status: GtmConnectionStatus; publicId: string; matchCount: number }
  | {
    kind: "recognized";
    status: GtmConnectionStatus;
    publicId: string;
    account: { accountId: string; name: string };
    container: { accountId: string; containerId: string; name: string; publicId: string };
    measurementIds: string[];
    enhancedMeasurement?: EnhancedMeasurementAudit;
    enhancedMeasurementError?: "unavailable";
  };

interface Ga4VerificationStarted {
  status: "started";
  verificationId: string;
  measurementId: string;
  eventName: string;
  baselineEventCount: number;
  property: { propertyId: string; name: string };
  stream: { streamId: string; name: string };
}

interface Ga4VerificationConfirmation {
  status: "pending" | "confirmed";
  verificationId: string;
  baselineEventCount: number;
  currentEventCount: number;
  property: { propertyId: string; name: string };
  stream: { streamId: string; name: string };
  correlation: "aggregate_realtime_count_increase";
}

type ExtensionRequest =
  | { type: "SCAN_NAVIGATION" }
  | { type: "START_VERIFICATION"; navigation: NavigationElement[] }
  | { type: "GET_EVIDENCE" }
  | { type: "FORM_ANALYTICS_REQUEST"; request: { url: string; observedAt: string } }
  | { type: "TOGGLE_OVERLAY" };

const analyticsPattern = /(?:google-analytics\.com|analytics\.google\.com)\/g\/collect/i;
const evidence = new Map<string, BrowserEvidence>();
let verificationScope = new Map<string, NavigationElement>();
let preferences: OverlayPreferences = { width: 380, height: 260, collapsed: true };
let host: HTMLDivElement | undefined;
let frame: HTMLElement | undefined;
let responseList: HTMLElement | undefined;
let composer: HTMLTextAreaElement | undefined;
let gtmConnectionCard: HTMLElement | undefined;
let port: chrome.runtime.Port | undefined;
let targetHost: HTMLDivElement | undefined;
interface PageTarget {
  id: string;
  label: string;
  selector: string;
  element?: Element;
}
let highlightedTargets: PageTarget[] = [];
let highlightTone: "candidate" | "confirmed" = "candidate";
const responseNodes = new Map<string, HTMLElement>();
const agentTaskNodes = new Map<string, HTMLElement>();
const navigationByRequest = new Map<string, NavigationElement[]>();
const requestTimeouts = new Map<string, number>();
const intakeByRequest = new Map<string, ConversationIntakeResult>();
const formsByRequest = new Map<string, FormCandidate[]>();
const interactionCountsByRequest = new Map<
  string,
  Partial<Record<KnownInteractionTypeV1, number>>
>();
const interactionTargetsByRequest = new Map<
  string,
  Partial<Record<KnownInteractionTypeV1, PageTarget[]>>
>();
const recentFormRequests: Array<{ url: string; observedAt: string }> = [];
let activeFormVerification: { requestId: string; intake: ConversationIntakeResult } | undefined;
const ga4VerificationByRequest = new Map<string, Ga4VerificationStarted>();
const ga4ConfirmationAttempts = new Map<string, number>();
const ga4FailuresByRequest = new Map<string, string>();
const ga4PlansByRequest = new Map<string, Ga4ConfigurationPlanV1>();
const workflowPlansByRequest = new Map<string, WorkflowPlanSummary>();
const workflowRepairsByRequest = new Map<string, WorkflowRepairSummary>();
const workflowPreviewByRequest = new Map<string, {
  operationId: string;
  setupFingerprint: string;
  workspaceFingerprint: string;
  previewVersionFingerprint: string;
}>();
const workflowVersionByRequest = new Map<string, {
  operationId: string;
  versionFingerprint: string;
}>();
const workflowPublicationByRequest = new Map<string, {
  operationId: string;
  versionFingerprint: string;
  publishedAt: string;
  evidenceRunId?: string;
  targetVersionFingerprint?: string;
}>();
const authoredSetupByRequest = new Map<string, {
  providerId: string;
  eventName: string;
  rationale: string;
  suggestions: Array<{ name: string; classification: string; rationale: string }>;
  setup: TrackingSetupV1;
}>();
let activeInteractionVerification: {
  requestId: string;
  intake: ConversationIntakeResult;
  startedAt: string;
  startedAtPerformance: number;
} | undefined;
let recognizedGtmContext: Extract<GtmConnectionView, { kind: "recognized" }> | undefined;
let gtmConnectionLoaded = false;
let gtmConnectionRequestSequence = 0;

function successEvidenceFor(result: ConversationIntakeResult): SuccessEvidence | undefined {
  const signal = result.successSignal;
  if (!signal) return undefined;
  if (signal.type === "visible_element") return { type: signal.type, selector: signal.value };
  if (signal.type === "thank_you_url") return { type: signal.type, urlPattern: signal.value };
  if (signal.type === "data_layer_event") return { type: signal.type, eventName: signal.value };
  return { type: signal.type, signal: signal.value };
}

function confirmedFormSpecification(result: ConversationIntakeResult): TrackingSpecificationV1 | undefined {
  const target = result.target;
  const successEvidence = successEvidenceFor(result);
  if (!target || !successEvidence || !result.canConfirm) return undefined;
  return {
    schemaVersion: 1,
    id: `spec_form_${target.id}`,
    status: "confirmed",
    originalIntent: `Track qualified inquiries from ${target.label}`,
    interaction: { type: "form_submission" },
    conversionOutcome: { type: "qualified_inquiry", practitionerConfirmed: true },
    event: {
      name: "generate_lead",
      requiredParameters: ["form_id", "form_name", "page_location"],
      optionalParameters: [],
    },
    targets: [{
      id: target.id,
      label: target.label,
      selector: target.selector,
      pageUrl: target.pageUrl,
    }],
    successEvidence: [successEvidence],
  };
}

function fixtureMeta(name: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || undefined;
}

function connectedSetupContext() {
  const context = recognizedGtmContext;
  if (!context || context.measurementIds.length !== 1) return undefined;
  return {
    measurementId: context.measurementIds[0]!,
    container: {
      accountId: context.container.accountId,
      containerId: context.container.containerId,
      publicId: context.publicId,
      name: context.container.name,
    },
  };
}

function formSetupProposal(result: ConversationIntakeResult) {
  const specification = confirmedFormSpecification(result);
  const connected = connectedSetupContext();
  const measurementId = connected?.measurementId ?? fixtureMeta("gtm-observability-measurement-id");
  const publicId = connected?.container.publicId ?? fixtureMeta("gtm-observability-container-id");
  if (!specification || !measurementId || !publicId) return undefined;
  return createFormSetupProposal({
    specification,
    measurementId,
    container: connected?.container
      ?? { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
  });
}

function formWorkflowRequest(requestId: string, result: ConversationIntakeResult) {
  const connected = connectedSetupContext();
  if (!connected) {
    return undefined;
  }
  const authored = authoredSetupByRequest.get(requestId);
  if (authored?.setup.status === "confirmed") {
    return { setup: authored.setup, container: connected.container };
  }
  const interactionProposal = interactionSetupProposal(result);
  if (interactionProposal) return { setup: interactionProposal.setup, container: connected.container };
  const specification = confirmedFormSpecification(result);
  return specification ? { specification, ...connected } : undefined;
}

async function requestWorkflowPlan(
  requestId: string,
  result: ConversationIntakeResult,
): Promise<WorkflowPlanResponse> {
  const request = formWorkflowRequest(requestId, result);
  if (!request) {
    return { ok: false, error: "invalid_request" };
  }
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_PLAN_REQUEST",
    request,
  }) as Promise<WorkflowPlanResponse>;
}

async function requestWorkflowResume(
  operationId: string,
): Promise<WorkflowResumeResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_RESUME_REQUEST",
    operationId,
  }) as Promise<WorkflowResumeResponse>;
}

async function requestReplacementApproval(
  plan: WorkflowPlanSummary,
): Promise<WorkflowPlanResponse> {
  const entities = plan.actions.flatMap((action) => action.action === "conflict"
    && action.reason === "managed_change_requires_approval"
    && action.entitySignature
    && action.existingId
    && action.replacement
    ? [{
      kind: action.kind,
      entitySignature: action.entitySignature,
      existingId: action.existingId,
      currentFingerprint: action.replacement.currentFingerprint,
    }]
    : []);
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_APPROVE_REPLACEMENT_REQUEST",
    operationId: plan.operationId,
    planFingerprint: plan.fingerprint,
    entities,
  }) as Promise<WorkflowPlanResponse>;
}

async function requestWorkflowDraftVerification(
  operationId: string,
  run: ExactDraftBrowserRunV1,
): Promise<{ ok: boolean; error?: string }> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_VERIFY_DRAFT_REQUEST",
    operationId,
    run,
  }) as Promise<{ ok: boolean; error?: string }>;
}

async function requestWorkflowRepair(
  operationId: string,
  run: ExactDraftBrowserRunV1,
): Promise<WorkflowRepairResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_REPAIR_DRAFT_REQUEST",
    operationId,
    run,
  }) as Promise<WorkflowRepairResponse>;
}

async function requestApplyWorkflowRepair(
  operationId: string,
  planFingerprint: string,
): Promise<WorkflowResumeResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_APPLY_REPAIR_REQUEST",
    operationId,
    planFingerprint,
  }) as Promise<WorkflowResumeResponse>;
}

async function requestWorkflowPublicationAction(
  type: "GTM_WORKFLOW_APPROVE_PUBLICATION_REQUEST" | "GTM_WORKFLOW_PUBLISH_REQUEST",
  operationId: string,
  versionFingerprint: string,
): Promise<WorkflowPublicationResponse> {
  return chrome.runtime.sendMessage({
    type,
    operationId,
    versionFingerprint,
  }) as Promise<WorkflowPublicationResponse>;
}

async function requestLiveVerification(
  operationId: string,
  versionFingerprint: string,
  evidence: TrackingRunEvidenceV1,
): Promise<WorkflowLiveVerificationResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_VERIFY_PUBLICATION_REQUEST",
    operationId,
    versionFingerprint,
    evidence,
  }) as Promise<WorkflowLiveVerificationResponse>;
}

async function requestWorkflowRollback(
  operationId: string,
  versionFingerprint: string,
  targetVersionFingerprint: string,
): Promise<WorkflowRollbackResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_WORKFLOW_ROLLBACK_REQUEST",
    operationId,
    versionFingerprint,
    targetVersionFingerprint,
  }) as Promise<WorkflowRollbackResponse>;
}

function navigationSetupProposal(navigation: NavigationElement[]): SetupProposal | undefined {
  const connected = connectedSetupContext();
  const measurementId = connected?.measurementId ?? fixtureMeta("gtm-observability-measurement-id");
  const runtime = inspectGtmRuntime();
  const publicId = connected?.container.publicId ?? (runtime.status === "detected" && runtime.containerIds.length === 1
    ? runtime.containerIds[0]
    : fixtureMeta("gtm-observability-container-id"));
  if (!measurementId || !publicId || navigation.length === 0) return undefined;
  return createSetupProposal({
    intent: "Track navigation links",
    pageUrl: location.href,
    measurementId,
    navigation,
    container: connected?.container
      ?? { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
  });
}

function containerFileDownloadHref(containerFile: unknown): string {
  const content = JSON.stringify(containerFile, null, 2);
  return `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
}

function formSetupDownloadHref(result: ConversationIntakeResult): string | undefined {
  const proposal = formSetupProposal(result);
  if (!proposal) return undefined;
  return containerFileDownloadHref(proposal.containerFile);
}

function interactionSetupProposal(
  result: ConversationIntakeResult,
): KnownInteractionSetupProposalV1 | undefined {
  const definition = knownInteractionDefinition(result.interaction);
  if (!definition || !result.scope || !result.canConfirm) return undefined;
  const connected = connectedSetupContext();
  const measurementId = connected?.measurementId ?? fixtureMeta("gtm-observability-measurement-id");
  const publicId = connected?.container.publicId ?? fixtureMeta("gtm-observability-container-id");
  if (!measurementId || !publicId) return undefined;
  return createKnownInteractionSetupProposal({
    interaction: definition.interaction,
    scope: result.scope,
    pageUrl: location.href,
    measurementId,
    container: connected?.container
      ?? { accountId: "0", containerId: "0", publicId, name: "GTM Observability import" },
  });
}

function setupAuthoringRequest(
  requestId: string,
  result: ConversationIntakeResult,
): { input: SetupAuthoringInputV1; grounding: SetupAuthoringGroundingV1 } | undefined {
  const proposal = interactionSetupProposal(result);
  const definition = knownInteractionDefinition(result.interaction);
  if (!proposal || !definition) return undefined;
  return {
    input: {
      schemaVersion: 1,
      requestId: `author_${requestId}`.slice(0, 128),
      intent: proposal.setup.intent.statement,
      businessOutcome: proposal.setup.intent.businessOutcome,
      existingEventNames: [proposal.eventName],
      firingPolicyCandidates: proposal.setup.firingPolicies.map((policy) => ({
        id: policy.id,
        label: `${definition.interactionLabel} — ${result.scope === "current_page" ? "current page" : "sitewide"}`,
        sourceType: policy.source.type,
      })),
      valueCandidates: [],
      privacy: { redactedValueCount: 1, truncatedLabelIds: [] },
    },
    grounding: {
      setupId: `setup_authored_${definition.interaction}_${result.scope ?? "sitewide"}`,
      measurementId: proposal.setup.tagActions[0]?.destination.type === "ga4"
        ? proposal.setup.tagActions[0].destination.measurementId
        : "",
      firingPolicies: proposal.setup.firingPolicies.map((policy) => ({
        candidateId: policy.id,
        policy,
      })),
      values: [],
      verification: proposal.setup.verification,
      prohibitedOutputValues: [],
    },
  };
}

async function requestSetupAuthoring(
  requestId: string,
  result: ConversationIntakeResult,
): Promise<SetupAuthoringResponse> {
  const request = setupAuthoringRequest(requestId, result);
  if (!request) return { ok: false, error: "invalid_request" };
  return chrome.runtime.sendMessage({
    type: "SETUP_AUTHORING_REQUEST",
    ...request,
  }) as Promise<SetupAuthoringResponse>;
}

function leadGa4Actions(): Ga4ConfigurationActionV1[] {
  return [
    {
      id: "dimension_form_name",
      type: "custom_dimension",
      parameterName: "form_name",
      displayName: "Form name",
      description: "Name of the submitted lead form",
      scope: "EVENT",
    },
    {
      id: "key_event_generate_lead",
      type: "key_event",
      eventName: "generate_lead",
      countingMethod: "ONCE_PER_EVENT",
    },
  ];
}

async function requestGa4Configuration(
  operation: "plan" | "apply",
  input: { measurementId: string } | { plan: Ga4ConfigurationPlanV1 },
): Promise<Ga4ConfigurationResponse> {
  return chrome.runtime.sendMessage({
    type: "GA4_CONFIGURATION_REQUEST",
    operation,
    ...(operation === "plan"
      ? {
          id: "ga4_generate_lead_configuration",
          measurementId: "measurementId" in input ? input.measurementId : "",
          actions: leadGa4Actions(),
        }
      : { plan: "plan" in input ? input.plan : undefined }),
  }) as Promise<Ga4ConfigurationResponse>;
}

function interactionSetupDownloadHref(result: ConversationIntakeResult): string | undefined {
  const proposal = interactionSetupProposal(result);
  return proposal ? containerFileDownloadHref(proposal.compiled.containerFile) : undefined;
}

function formExplanation(
  verdict: TrackingRunEvidenceV1["verdict"],
  platformCheckStarted = false,
): string {
  if (verdict.code === "browser_verified") {
    return platformCheckStarted
      ? "Browser verification passed because one generate_lead request was observed. Checking the pre-run GA4 Realtime baseline now."
      : "Browser verification passed because one generate_lead request was observed. Platform confirmation remains unverified.";
  }
  if (verdict.code === "expected_non_conversion") {
    return "The form was stopped by validation, so this attempt was not counted. Correct the input and submit again. Platform confirmation remains unverified.";
  }
  return `${verdict.code.replaceAll("_", " ")}. ${verdict.nextAction} Platform confirmation remains unverified.`;
}

function analyticsFailureDetail(error: string | undefined): string {
  if (error === "analytics_disabled") return "Analytics reads are disabled on this backend";
  if (error === "analytics_provider_forbidden") return "The Analytics Data API is unavailable or the saved grant cannot read it";
  if (error === "measurement_not_accessible") return "The GA4 destination is not accessible through the saved grant";
  if (error === "measurement_ambiguous") return "The GA4 destination matched multiple accessible streams";
  if (error === "verification_expired") return "The GA4 verification window expired; start a new browser run";
  if (error === "service_offline") return "The local Analytics service is offline";
  return "GA4 Realtime evidence is currently unavailable";
}

function renderPlatformState(
  requestId: string,
  state: {
    status: "working" | "completed";
    summary: string;
    confirmation: "checking" | "passed" | "pending" | "unavailable";
    nextAction: string;
    explanation: string;
    actions?: Array<{ id: string; label: string }>;
  },
): void {
  const intake = intakeByRequest.get(requestId);
  if (!intake) {
    return;
  }

  renderFormTaskState(requestId, intake, {
    status: state.status,
    summary: state.summary,
    verifyStatus: state.status === "working" ? "active" : "completed",
    ...(state.actions ? { actions: state.actions } : {}),
    result: {
      verdict: "browser_verified",
      browserVerification: "passed",
      platformConfirmation: state.confirmation,
      nextAction: state.nextAction,
      explanation: state.explanation,
    },
  });
}

async function confirmGa4Platform(requestId: string): Promise<void> {
  const started = ga4VerificationByRequest.get(requestId);
  if (!started || !intakeByRequest.has(requestId)) {
    return;
  }

  const attempt = (ga4ConfirmationAttempts.get(requestId) ?? 0) + 1;
  ga4ConfirmationAttempts.set(requestId, attempt);
  const response = await requestGa4Verification({ operation: "confirm", verificationId: started.verificationId });
  const result = response.ok ? parseGa4Confirmation(response.result) : undefined;
  if (!result) {
    ga4ConfirmationAttempts.delete(requestId);
    const detail = analyticsFailureDetail(response.error);
    renderPlatformState(requestId, {
      status: "completed",
      summary: `Browser verification passed. ${detail}.`,
      confirmation: "unavailable",
      nextAction: "Check GA4 again when the read is available.",
      explanation: `One generate_lead request was observed in the browser. ${detail}; no platform confirmation is claimed.`,
      actions: [{ id: "retry-ga4-confirmation", label: "Check GA4 again" }],
    });
    return;
  }
  if (result.status === "confirmed") {
    ga4VerificationByRequest.delete(requestId);
    ga4ConfirmationAttempts.delete(requestId);
    renderPlatformState(requestId, {
      status: "completed",
      summary: `Setup verified in the browser and confirmed in GA4 Realtime on ${result.property.name}.`,
      confirmation: "passed",
      nextAction: "No further verification action is required.",
      explanation: "Browser verification passed because one generate_lead request was observed. GA4 Realtime then showed an aggregate count increase against the pre-run baseline; no user or event-level identity is claimed.",
    });
    return;
  }

  const countDetail = `${result.baselineEventCount} → ${result.currentEventCount}`;
  if (attempt < 12) {
    renderPlatformState(requestId, {
      status: "working",
      summary: `Browser verification passed. GA4 Realtime has not increased yet (${countDetail}); checking again automatically.`,
      confirmation: "checking",
      nextAction: "Wait for the next bounded GA4 Realtime check.",
      explanation: "The browser request passed. Platform confirmation remains pending until the aggregate Realtime count increases.",
    });
    window.setTimeout(() => void confirmGa4Platform(requestId), 5_000);
    return;
  }

  renderPlatformState(requestId, {
    status: "completed",
    summary: `Browser verification passed. GA4 Realtime is still unchanged (${countDetail}).`,
    confirmation: "pending",
    nextAction: "Check GA4 again when reporting catches up.",
    explanation: "The browser request passed, but the aggregate GA4 Realtime count has not increased, so no platform confirmation is claimed.",
    actions: [{ id: "retry-ga4-confirmation", label: "Check GA4 again" }],
  });
}

async function prepareFormVerification(requestId: string, intake: ConversationIntakeResult): Promise<void> {
  recentFormRequests.length = 0;
  ga4FailuresByRequest.delete(requestId);
  const context = recognizedGtmContext;
  const livePublication = workflowPublicationByRequest.has(requestId);
  if (!livePublication && context?.status.analyticsReadEnabled && context.measurementIds.length === 1) {
    const response = await requestGa4Verification({
      operation: "start",
      measurementId: context.measurementIds[0],
      eventName: "generate_lead",
    });
    const started = response.ok ? parseGa4Started(response.result) : undefined;
    if (started && started.measurementId === context.measurementIds[0] && started.eventName === "generate_lead") {
      ga4VerificationByRequest.set(requestId, started);
      ga4ConfirmationAttempts.set(requestId, 0);
    } else {
      ga4FailuresByRequest.set(requestId, analyticsFailureDetail(response.error));
    }
  }
  activeFormVerification = { requestId, intake };
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: livePublication
      ? "Live verification is watching the published container for one browser run."
      : "Verification is ready and watching for one successful browser run.",
    verifyStatus: "active",
    question: `Submit ${intake.target?.label ?? "the selected form"} once.`,
  });
}

function prepareInteractionVerification(requestId: string, intake: ConversationIntakeResult): void {
  recentFormRequests.length = 0;
  activeInteractionVerification = {
    requestId,
    intake,
    startedAt: new Date().toISOString(),
    startedAtPerformance: performance.now(),
  };
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: workflowPublicationByRequest.has(requestId)
      ? "Live verification is watching the published container for one matching browser interaction and GA4 request."
      : "Exact preview verification is watching for one matching browser interaction and GA4 request.",
    verifyStatus: "active",
    question: `Click one matching ${knownInteractionDefinition(intake.interaction)?.singular ?? "link"} on this page.`,
  });
}

function ga4EventName(requestUrl: string): string | undefined {
  try {
    const value = new URL(requestUrl).searchParams.get("en")?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function finishInteractionVerification(
  active: NonNullable<typeof activeInteractionVerification>,
): void {
  if (activeInteractionVerification !== active) return;
  activeInteractionVerification = undefined;
  const proposal = interactionSetupProposal(active.intake);
  if (!proposal) return;
  const urls = analyticsUrlsSince(active.startedAt, active.startedAtPerformance);
  const matching = urls.filter((url) => ga4EventName(url) === proposal.eventName);
  const consent = classifyConsent(document.documentElement.dataset.consent);
  const passed = matching.length === 1 && consent !== "denied";
  const code: TrackingRunEvidenceV1["verdict"]["code"] = consent === "denied"
    ? "consent_limited"
    : matching.length > 1
      ? "duplicate_fire"
      : matching.length === 0
        ? "tag_fired_request_missing"
        : "browser_verified";
  const evidence: TrackingRunEvidenceV1 = {
    schemaVersion: 1,
    runId: `run_${proposal.eventName}_${Date.now()}`,
    specificationId: proposal.setup.id,
    startedAt: active.startedAt,
    observations: {
      interaction: {
        type: proposal.interaction,
        targetId: `matching_${proposal.interaction}`,
        attempted: true,
        submissionResult: "success",
      },
      outcome: { observed: true, observable: true, evidenceType: proposal.interaction },
      dataLayer: { matchingEvents: [] },
      tagFired: matching.length > 0,
      network: {
        ga4Requests: matching.map((url) => ({ url, observedAt: new Date().toISOString() })),
      },
      consent: { analyticsStorage: consent },
    },
    verdict: {
      code,
      browserVerification: passed ? "passed" : "failed",
      platformConfirmation: "unverified",
      nextAction: passed
        ? "Bind this run to the exact draft."
        : consent === "denied"
          ? "Grant analytics consent and retry."
          : matching.length > 1
            ? "Remove the duplicate fire and retry."
            : "Confirm Tag Assistant preview is connected to the managed workspace and retry.",
    },
  };
  if (workflowPublicationByRequest.has(active.requestId)) {
    void completeLiveVerification(active.requestId, active.intake, evidence);
    return;
  }
  if (passed) {
    void completeExactDraftVerification(active.requestId, active.intake, evidence);
    return;
  }
  if (workflowPreviewByRequest.has(active.requestId)) {
    void beginDraftRepair(active.requestId, active.intake, evidence);
    return;
  }
  renderFormTaskState(active.requestId, active.intake, {
    status: "blocked",
    summary: "The exact browser run did not produce one privacy-safe matching GA4 request. No version was created.",
    verifyStatus: "blocked",
    question: evidence.verdict.nextAction,
    actions: [{ id: "start-exact-interaction-preview", label: "Retry exact browser run" }],
  });
}

function classifySubmissionResult(value: string | undefined): "success" | "validation_error" | "server_error" | "unknown" {
  return value === "success" || value === "validation_error" || value === "server_error" ? value : "unknown";
}

function classifyTransport(value: string | undefined): "native" | "redirect" | "ajax" | "spa" | "unobservable" {
  return value === "native" || value === "redirect" || value === "ajax" || value === "spa" ? value : "unobservable";
}

function classifyConsent(value: string | undefined): "granted" | "denied" | "unknown" {
  return value === "granted" || value === "denied" ? value : "unknown";
}

function observableSuccess(result: ConversationIntakeResult): {
  observed: boolean;
  dataLayerEvents: Array<{ event: string }>;
} {
  const signal = result.successSignal;
  if (!signal) return { observed: false, dataLayerEvents: [] };
  if (signal.type === "visible_element") {
    try {
      const element = document.querySelector<HTMLElement>(signal.value);
      const style = element ? getComputedStyle(element) : undefined;
      const observed = Boolean(element
        && !element.hidden
        && element.getAttribute("aria-hidden") !== "true"
        && style?.display !== "none"
        && style?.visibility !== "hidden"
        && element.getClientRects().length > 0);
      return { observed, dataLayerEvents: [] };
    } catch {
      return { observed: false, dataLayerEvents: [] };
    }
  }
  if (signal.type === "thank_you_url") {
    return { observed: location.href.includes(signal.value), dataLayerEvents: [] };
  }
  if (signal.type === "data_layer_event") {
    const layer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    const observed = Array.isArray(layer) && layer.some(
      (item) => isRecord(item) && item.event === signal.value,
    );
    return { observed, dataLayerEvents: observed ? [{ event: signal.value }] : [] };
  }
  return { observed: false, dataLayerEvents: [] };
}

function analyticsUrlsSince(startedAt: string, startedAtPerformance: number): string[] {
  return [...new Set([
    ...recentFormRequests
      .filter((request) => Date.parse(request.observedAt) >= Date.parse(startedAt))
      .map((request) => request.url),
    ...recentAnalyticsRequests(startedAtPerformance).map((request) => request.url),
  ])];
}

function finishFormVerification(
  requestId: string,
  result: ConversationIntakeResult,
  startedAt: string,
  startedAtPerformance: number,
): void {
  const specification = confirmedFormSpecification(result);
  const target = result.target;
  const success = result.successSignal;
  if (!specification || !target || !success) return;
  const pageState = document.documentElement.dataset;
  const requestUrls = analyticsUrlsSince(startedAt, startedAtPerformance);
  const observedSuccess = observableSuccess(result);
  const outcomeObserved = pageState.outcomeObserved === "true" || observedSuccess.observed;
  const submissionResult = classifySubmissionResult(pageState.submissionResult);
  const provisionalVerdict: TrackingRunEvidenceV1["verdict"] = {
    code: "insufficient_observable_evidence",
    browserVerification: "inconclusive",
    platformConfirmation: "unverified",
    nextAction: "Await deterministic classification.",
  };
  const provisional = normalizeFormRunEvidence({
    runId: `run_form_${Date.now()}`,
    specificationId: specification.id,
    startedAt,
    transport: classifyTransport(pageState.transport),
    targetId: target.id,
    submitAttempted: true,
    submissionResult: submissionResult === "unknown" && outcomeObserved ? "success" : submissionResult,
    outcomeObserved,
    outcomeObservable: pageState.outcomeObservable !== "false",
    outcomeEvidenceType: success.type,
    dataLayerEvents: pageState.dataLayerEvent === "true"
      ? [{ event: "generate_lead", form_id: target.id, form_name: target.label.replaceAll(" ", "_") }]
      : observedSuccess.dataLayerEvents,
    tagFired: pageState.tagFired === "true"
      ? true
      : pageState.tagFired === "false"
        ? false
        : requestUrls.length > 0
          ? true
          : null,
    networkUrls: requestUrls,
    consent: classifyConsent(pageState.consent),
  }, provisionalVerdict);
  const verdict = determineFormVerdict(provisional.observations);
  const finalEvidence: TrackingRunEvidenceV1 = { ...provisional, verdict };
  const platformFailure = ga4FailuresByRequest.get(requestId);
  const platformCheckStarted = verdict.browserVerification === "passed"
    && ga4VerificationByRequest.has(requestId);
  if (verdict.browserVerification !== "passed") {
    ga4VerificationByRequest.delete(requestId);
    ga4ConfirmationAttempts.delete(requestId);
    ga4FailuresByRequest.delete(requestId);
  }
  const passed = verdict.browserVerification === "passed";
  if (workflowPublicationByRequest.has(requestId)) {
    activeFormVerification = undefined;
    ga4VerificationByRequest.delete(requestId);
    ga4ConfirmationAttempts.delete(requestId);
    ga4FailuresByRequest.delete(requestId);
    void completeLiveVerification(requestId, result, finalEvidence);
    return;
  }
  if (passed && workflowPreviewByRequest.has(requestId)) {
    activeFormVerification = undefined;
    ga4VerificationByRequest.delete(requestId);
    ga4ConfirmationAttempts.delete(requestId);
    ga4FailuresByRequest.delete(requestId);
    void completeExactDraftVerification(requestId, result, finalEvidence);
    return;
  }
  if (verdict.browserVerification === "failed" && workflowPreviewByRequest.has(requestId)) {
    activeFormVerification = undefined;
    ga4VerificationByRequest.delete(requestId);
    ga4ConfirmationAttempts.delete(requestId);
    ga4FailuresByRequest.delete(requestId);
    void beginDraftRepair(requestId, result, finalEvidence);
    return;
  }
  const verdictMessage = renderFormTaskState(requestId, result, {
    status: platformCheckStarted ? "working" : passed ? "completed" : "blocked",
    summary: platformCheckStarted
      ? "Browser verification passed. I am checking the pre-run GA4 Realtime baseline now."
      : passed
        ? platformFailure
          ? `Browser verification passed. ${platformFailure}.`
          : "Browser verification passed. Platform confirmation is not available for this run."
        : "This run did not verify the requested conversion safely.",
    verifyStatus: platformCheckStarted ? "active" : passed ? "completed" : "blocked",
    ...(!passed ? {
      question: verdict.nextAction,
      actions: [{ id: "start-form-verification", label: "Try verification again" }],
    } : platformFailure ? {
      question: "Retry when the Analytics read is available.",
      actions: [{ id: "start-form-verification", label: "Try verification again" }],
    } : {}),
    result: {
      verdict: verdict.code,
      browserVerification: verdict.browserVerification,
      platformConfirmation: platformCheckStarted
        ? "checking"
        : platformFailure
          ? "unavailable"
          : verdict.platformConfirmation,
      nextAction: verdict.nextAction,
      explanation: platformFailure
        ? `${formExplanation(verdict, platformCheckStarted)} ${platformFailure}.`
        : formExplanation(verdict, platformCheckStarted),
    },
  });
  window.requestAnimationFrame(() => verdictMessage.scrollIntoView({ block: "start" }));
  if (platformCheckStarted) void confirmGa4Platform(requestId);
  activeFormVerification = undefined;
}

function settleFormVerification(
  requestId: string,
  result: ConversationIntakeResult,
  startedAt: string,
  startedAtPerformance: number,
  deadline: number,
): void {
  const pageState = document.documentElement.dataset;
  const deterministicStateAvailable = pageState.submissionResult !== undefined
    || pageState.tagFired !== undefined;
  if (
    analyticsUrlsSince(startedAt, startedAtPerformance).length > 0
    || deterministicStateAvailable
    || performance.now() >= deadline
  ) {
    finishFormVerification(requestId, result, startedAt, startedAtPerformance);
    return;
  }
  window.setTimeout(
    () => settleFormVerification(requestId, result, startedAt, startedAtPerformance, deadline),
    250,
  );
}

function areaFor(element: Element): NavigationArea {
  if (element.closest("header")) return "header";
  if (element.closest("footer")) return "footer";
  if (element.closest("nav, [role='navigation']")) return "nav";
  return "unknown";
}

function selectorFor(anchor: HTMLAnchorElement, index: number): string {
  if (anchor.id) return `#${CSS.escape(anchor.id)}`;
  const area = anchor.closest("header, footer, nav, [role='navigation']");
  const prefix = area?.tagName.toLowerCase() ?? "body";
  const href = anchor.getAttribute("href");
  return href ? `${prefix} a[href="${CSS.escape(href)}"]` : `${prefix} a:nth-of-type(${index + 1})`;
}

function stableId(selector: string, href: string): string {
  let hash = 2166136261;
  for (const character of `${selector}\u0000${href}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `nav_${(hash >>> 0).toString(16)}`;
}

function scanNavigation(): ScanResponse {
  const candidates = [...document.querySelectorAll<HTMLAnchorElement>("header a[href], nav a[href], [role='navigation'] a[href], footer a[href]")];
  const seen = new Set<string>();
  const navigation: NavigationElement[] = [];
  candidates.forEach((anchor, index) => {
    if (!anchor.href || anchor.hidden || anchor.getAttribute("aria-hidden") === "true") return;
    const selector = selectorFor(anchor, index);
    const key = `${selector}\u0000${anchor.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    navigation.push({
      id: stableId(selector, anchor.href),
      text: (anchor.innerText || anchor.getAttribute("aria-label") || "Untitled link").replace(/\s+/g, " ").trim(),
      href: anchor.href,
      area: areaFor(anchor),
      selector,
    });
  });
  return { pageUrl: location.href, title: document.title, navigation };
}

function adjacentFormSuccessSignal(form: HTMLFormElement): FormCandidate["successSignals"][number] | undefined {
  const region = form.closest<HTMLElement>(
    'section, article, [role="region"][aria-label], [role="region"][aria-labelledby]',
  );
  if (!region) return undefined;
  const candidates = [...new Set(region.querySelectorAll<HTMLElement>(
    '[role="status"][id], [aria-live]:not([aria-live="off"])[id]',
  ))].filter((element) => element.id.trim().length > 0);
  if (candidates.length !== 1) return undefined;
  const candidate = candidates[0]!;
  return {
    id: "success-message",
    label: candidate.getAttribute("aria-label")?.trim() || "Success message",
    type: "visible_element",
    value: `#${CSS.escape(candidate.id)}`,
  };
}

function scanForms(): FormCandidate[] {
  return [...document.querySelectorAll<HTMLFormElement>("form")].map((form, index) => {
    const id = form.id || form.getAttribute("name") || `form_${index + 1}`;
    const label = form.getAttribute("aria-label")
      || form.querySelector("legend")?.textContent?.trim()
      || form.getAttribute("name")
      || id;
    const selector = form.id
      ? `form#${CSS.escape(form.id)}`
      : form.getAttribute("name")
        ? `form[name="${CSS.escape(form.getAttribute("name")!)}"]`
        : `form:nth-of-type(${index + 1})`;
    const successSignals: FormCandidate["successSignals"] = [];
    if (form.dataset.successSelector) {
      successSignals.push({ id: "success-message", label: "Success message", type: "visible_element", value: form.dataset.successSelector });
    }
    if (form.dataset.successUrl) {
      successSignals.push({ id: "thank-you-url", label: "Thank-you URL", type: "thank_you_url", value: form.dataset.successUrl });
    }
    if (successSignals.length === 0) {
      const adjacent = adjacentFormSuccessSignal(form);
      if (adjacent) successSignals.push(adjacent);
    }
    return { id, label, selector, pageUrl: location.href, successSignals };
  });
}

function scanKnownInteractions(): {
  counts: Partial<Record<KnownInteractionTypeV1, number>>;
  targets: Partial<Record<KnownInteractionTypeV1, PageTarget[]>>;
} {
  const links = [...document.querySelectorAll<HTMLAnchorElement | HTMLAreaElement>(
    "a[href], area[href]",
  )].filter((link) => !link.hidden && link.getAttribute("aria-hidden") !== "true");
  const hrefs = links
    .map((link) => link.getAttribute("href"))
    .filter((href): href is string => href !== null);
  const targets: Partial<Record<KnownInteractionTypeV1, PageTarget[]>> = {};

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }
    const matches = countKnownLinkInteractions(location.href, [href]);
    for (const interaction of Object.keys(matches) as KnownInteractionTypeV1[]) {
      const definition = knownInteractionDefinition(interaction);
      if (!definition) {
        continue;
      }
      const items = targets[interaction] ?? [];
      items.push({
        id: `known_${interaction}_${items.length + 1}`,
        label: definition.singular,
        selector: "",
        element: link,
      });
      targets[interaction] = items;
    }
  }

  return { counts: countKnownLinkInteractions(location.href, hrefs), targets };
}

function inspectGtmRuntime() {
  try {
    return observeGtmRuntime({
      inspectionAvailable: true,
      scriptUrls: [...document.scripts].map((script) => script.src).filter(Boolean),
    });
  } catch {
    return observeGtmRuntime({ inspectionAvailable: false, scriptUrls: [] });
  }
}

async function requestGtmContainer(
  operation: "inspect" | "prepare",
  publicId: string,
): Promise<GtmBridgeResponse> {
  return chrome.runtime.sendMessage({
    type: "GTM_CONTAINER_REQUEST",
    operation,
    publicId,
  }) as Promise<GtmBridgeResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum = 256): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function parseConnectionStatus(value: unknown): GtmConnectionStatus | undefined {
  if (!isRecord(value)
    || typeof value.configured !== "boolean"
    || typeof value.connected !== "boolean"
    || (value.scope !== "read-only" && value.scope !== "container-edit")
    || typeof value.containerWritesEnabled !== "boolean"
    || typeof value.publicationScopeRequested !== "boolean"
    || typeof value.publicationEnabled !== "boolean"
    || typeof value.tokenPersistenceEnabled !== "boolean"
    || typeof value.analyticsReadEnabled !== "boolean") return undefined;
  if (value.containerWritesEnabled !== (value.scope === "container-edit")) return undefined;
  if (value.publicationEnabled && (!value.publicationScopeRequested || !value.containerWritesEnabled)) return undefined;
  return {
    configured: value.configured,
    connected: value.connected,
    scope: value.scope,
    containerWritesEnabled: value.containerWritesEnabled,
    publicationScopeRequested: value.publicationScopeRequested,
    publicationEnabled: value.publicationEnabled,
    tokenPersistenceEnabled: value.tokenPersistenceEnabled,
    analyticsReadEnabled: value.analyticsReadEnabled,
  };
}

function parseConnectionResult(value: unknown, publicId: string): GtmContainerResult | undefined {
  if (!isRecord(value) || value.publicId !== publicId) return undefined;
  if (value.status === "not_accessible") return { status: value.status, publicId };
  if (value.status === "ambiguous") {
    if (!Number.isInteger(value.matchCount) || (value.matchCount as number) < 2) return undefined;
    return { status: value.status, publicId, matchCount: value.matchCount as number };
  }
  if (value.status !== "recognized" || !isRecord(value.account) || !isRecord(value.container)) return undefined;
  const measurementIds = value.measurementIds;
  if (!isBoundedText(value.account.accountId, 64)
    || !isBoundedText(value.account.name)
    || !isBoundedText(value.container.accountId, 64)
    || !isBoundedText(value.container.containerId, 64)
    || !isBoundedText(value.container.name)
    || value.container.publicId !== publicId
    || value.container.accountId !== value.account.accountId
    || !Array.isArray(measurementIds)
    || measurementIds.length > 32
    || measurementIds.some((item) => typeof item !== "string" || !/^G-[A-Z0-9]+$/.test(item))
    || new Set(measurementIds).size !== measurementIds.length
    || [...measurementIds].sort().some((item, index) => item !== measurementIds[index])) return undefined;
  return {
    status: value.status,
    publicId,
    account: { accountId: value.account.accountId, name: value.account.name },
    container: {
      accountId: value.container.accountId,
      containerId: value.container.containerId,
      name: value.container.name,
      publicId,
    },
    measurementIds,
  };
}

function parseConnectionContext(value: unknown, observedContainerIds: string[]): GtmConnectionContext | undefined {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.containerIds)) return undefined;
  const containerIds = value.containerIds;
  if (containerIds.length !== observedContainerIds.length
    || containerIds.some((item, index) => item !== observedContainerIds[index])) return undefined;
  const status = parseConnectionStatus(value.status);
  if (!status) return undefined;
  if (value.recognitionError !== undefined && value.recognitionError !== "recognition_unavailable") return undefined;
  if (containerIds.length !== 1 || !status.configured || !status.connected) {
    return { status, containerIds };
  }
  if (value.recognitionError === "recognition_unavailable") {
    return { status, containerIds, recognitionError: value.recognitionError };
  }
  if (!isRecord(value.recognition)) return undefined;
  const result = parseConnectionResult(value.recognition.result, containerIds[0]!);
  if (!result || typeof value.recognition.containerWritesEnabled !== "boolean"
    || value.recognition.containerWritesEnabled !== status.containerWritesEnabled) return undefined;
  if (value.enhancedMeasurementError !== undefined
    && value.enhancedMeasurementError !== "unavailable") {
    return undefined;
  }
  if (value.enhancedMeasurement !== undefined && value.enhancedMeasurementError !== undefined) {
    return undefined;
  }
  const measurementId = result.status === "recognized" && result.measurementIds?.length === 1
    ? result.measurementIds[0]
    : undefined;
  if ((value.enhancedMeasurement !== undefined || value.enhancedMeasurementError !== undefined)
    && (!status.analyticsReadEnabled || !measurementId)) {
    return undefined;
  }
  const enhancedMeasurement = value.enhancedMeasurement === undefined
    ? undefined
    : parseEnhancedMeasurement(value.enhancedMeasurement, measurementId!);
  const enhancedMeasurementError = value.enhancedMeasurementError === "unavailable"
    || (value.enhancedMeasurement !== undefined && !enhancedMeasurement)
    ? "unavailable" as const
    : undefined;

  return {
    status,
    containerIds,
    result,
    ...(enhancedMeasurement ? { enhancedMeasurement } : {}),
    ...(enhancedMeasurementError ? { enhancedMeasurementError } : {}),
  };
}

function parseAnalyticsResource(
  value: unknown,
  idKey: "propertyId" | "streamId",
): { id: string; name: string } | undefined {
  if (!isRecord(value) || !isBoundedText(value[idKey], 64) || !/^\d+$/.test(value[idKey])
    || !isBoundedText(value.name)) return undefined;
  return { id: value[idKey], name: value.name };
}

function parseEnhancedSettings(value: unknown): EnhancedMeasurementSettings | undefined {
  if (!isRecord(value)
    || typeof value.stream !== "boolean"
    || typeof value.pageViews !== "boolean"
    || typeof value.scrolls !== "boolean"
    || typeof value.outboundClicks !== "boolean"
    || typeof value.siteSearch !== "boolean"
    || typeof value.videoEngagement !== "boolean"
    || typeof value.fileDownloads !== "boolean"
    || typeof value.formInteractions !== "boolean") {
    return undefined;
  }

  return {
    stream: value.stream,
    pageViews: value.pageViews,
    scrolls: value.scrolls,
    outboundClicks: value.outboundClicks,
    siteSearch: value.siteSearch,
    videoEngagement: value.videoEngagement,
    fileDownloads: value.fileDownloads,
    formInteractions: value.formInteractions,
  };
}

function parseEnhancedMeasurement(
  value: unknown,
  measurementId: string,
): EnhancedMeasurementAudit | undefined {
  if (!isRecord(value) || value.measurementId !== measurementId) {
    return undefined;
  }
  const property = parseAnalyticsResource(value.property, "propertyId");
  const stream = parseAnalyticsResource(value.stream, "streamId");
  const settings = parseEnhancedSettings(value.settings);
  if (!property || !stream || !settings) {
    return undefined;
  }

  return {
    measurementId,
    property: { propertyId: property.id, name: property.name },
    stream: { streamId: stream.id, name: stream.name },
    settings,
    canEnable: value.canEnable === true,
  };
}

function parseEnhancedEnable(value: unknown, measurementId: string): EnhancedMeasurementAudit | undefined {
  if (!isRecord(value) || (value.status !== "enabled" && value.status !== "already_enabled")) {
    return undefined;
  }
  const audit = parseEnhancedMeasurement(value.audit, measurementId);
  if (!audit || !audit.settings.stream) {
    return undefined;
  }

  return { ...audit, canEnable: false };
}

function parseGa4Started(value: unknown): Ga4VerificationStarted | undefined {
  if (!isRecord(value) || value.status !== "started"
    || !isBoundedText(value.verificationId, 128) || !/^[A-Za-z0-9_-]+$/.test(value.verificationId)
    || typeof value.measurementId !== "string" || !/^G-[A-Z0-9]+$/.test(value.measurementId)
    || typeof value.eventName !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(value.eventName)
    || !Number.isSafeInteger(value.baselineEventCount) || (value.baselineEventCount as number) < 0) return undefined;
  const property = parseAnalyticsResource(value.property, "propertyId");
  const stream = parseAnalyticsResource(value.stream, "streamId");
  if (!property || !stream) return undefined;
  return {
    status: value.status,
    verificationId: value.verificationId,
    measurementId: value.measurementId,
    eventName: value.eventName,
    baselineEventCount: value.baselineEventCount as number,
    property: { propertyId: property.id, name: property.name },
    stream: { streamId: stream.id, name: stream.name },
  };
}

function parseGa4Confirmation(value: unknown): Ga4VerificationConfirmation | undefined {
  if (!isRecord(value) || (value.status !== "pending" && value.status !== "confirmed")
    || !isBoundedText(value.verificationId, 128) || !/^[A-Za-z0-9_-]+$/.test(value.verificationId)
    || !Number.isSafeInteger(value.baselineEventCount) || (value.baselineEventCount as number) < 0
    || !Number.isSafeInteger(value.currentEventCount) || (value.currentEventCount as number) < 0
    || value.correlation !== "aggregate_realtime_count_increase") return undefined;
  const property = parseAnalyticsResource(value.property, "propertyId");
  const stream = parseAnalyticsResource(value.stream, "streamId");
  if (!property || !stream) return undefined;
  if (value.status === "confirmed" && (value.currentEventCount as number) <= (value.baselineEventCount as number)) {
    return undefined;
  }
  return {
    status: value.status,
    verificationId: value.verificationId,
    baselineEventCount: value.baselineEventCount as number,
    currentEventCount: value.currentEventCount as number,
    property: { propertyId: property.id, name: property.name },
    stream: { streamId: stream.id, name: stream.name },
    correlation: value.correlation,
  };
}

async function requestGa4Verification(message: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
  result?: unknown;
}> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({ type: "GA4_VERIFICATION_REQUEST", ...message });
    if (!isRecord(response) || typeof response.ok !== "boolean") return { ok: false, error: "invalid_response" };
    const safeErrors = new Set([
      "analytics_disabled",
      "analytics_provider_forbidden",
      "measurement_not_accessible",
      "measurement_ambiguous",
      "verification_expired",
      "analytics_unavailable",
      "service_offline",
    ]);
    return response.ok
      ? { ok: true, result: response.result }
      : { ok: false, error: typeof response.error === "string" && safeErrors.has(response.error) ? response.error : "invalid_response" };
  } catch {
    return { ok: false, error: "service_offline" };
  }
}

async function requestEnhancedEnable(measurementId: string): Promise<{
  ok: boolean;
  error?: string;
  result?: unknown;
}> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: "GA4_ENHANCED_MEASUREMENT_REQUEST",
      measurementId,
    });
    if (!isRecord(response) || typeof response.ok !== "boolean") {
      return { ok: false, error: "invalid_response" };
    }
    return response.ok
      ? { ok: true, result: response.result }
      : { ok: false, error: "unavailable" };
  } catch {
    return { ok: false, error: "service_offline" };
  }
}

function effectiveAccess(status: GtmConnectionStatus): string {
  if (status.publicationEnabled) return "Publish enabled";
  if (status.containerWritesEnabled) return "Edit access";
  return "Read-only";
}

function accessExplanation(status: GtmConnectionStatus): string {
  if (status.publicationEnabled) return "This backend can edit and publish. Publication still requires an explicit user action.";
  if (status.containerWritesEnabled) return "This backend can edit a GTM workspace. Publishing is off.";
  return "This backend can inspect GTM. Editing and publishing are off.";
}

function appendConnectionRow(parent: HTMLElement, label: string, value: string): void {
  const row = document.createElement("div");
  row.className = "gtm-context-row";
  const term = document.createElement("span");
  term.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value;
  row.append(term, detail);
  parent.append(row);
}

const enhancedFeatures: Array<{
  key: Exclude<keyof EnhancedMeasurementSettings, "stream">;
  label: string;
}> = [
  { key: "pageViews", label: "SPA page views" },
  { key: "scrolls", label: "Scrolls" },
  { key: "outboundClicks", label: "Outbound clicks" },
  { key: "siteSearch", label: "Site search" },
  { key: "videoEngagement", label: "Video engagement" },
  { key: "fileDownloads", label: "File downloads" },
  { key: "formInteractions", label: "Form interactions" },
];

function appendEnhancedRows(
  parent: HTMLElement,
  audit?: EnhancedMeasurementAudit,
  error?: "unavailable",
): void {
  if (error === "unavailable") {
    appendConnectionRow(parent, "Enhanced measurement", "Enhanced measurement check unavailable");
    return;
  }
  if (!audit) {
    return;
  }
  const enabled = audit.settings.stream
    ? enhancedFeatures.filter(({ key }) => audit.settings[key]).length
    : 0;
  const missing = enhancedFeatures
    .filter(({ key }) => !audit.settings.stream || !audit.settings[key])
    .map(({ label }) => label);
  const summary = audit.settings.stream
    ? `${enabled} of ${enhancedFeatures.length} automatic features on`
    : `Master switch off · 0 of ${enhancedFeatures.length} active`;

  appendConnectionRow(parent, "Enhanced measurement", summary);
  appendConnectionRow(
    parent,
    "Coverage gaps",
    missing.length === 0 ? "No automatic coverage gaps" : missing.join(" · "),
  );
}

function renderEnhancedReview(parent: HTMLElement, audit: EnhancedMeasurementAudit): void {
  parent.querySelector(".enhanced-review")?.remove();
  const review = document.createElement("div");
  review.className = "enhanced-review";
  review.setAttribute("role", "region");
  review.setAttribute("aria-label", "Enhanced measurement review");
  const heading = document.createElement("strong");
  heading.textContent = "Review enhanced measurement";
  appendConnectionRow(review, "GA4", audit.measurementId);
  appendConnectionRow(review, "Property", audit.property.name);
  appendConnectionRow(review, "Stream", audit.stream.name);
  const boundary = document.createElement("p");
  boundary.textContent = "This enables only the master switch. Individual feature toggles stay unchanged. GTM will not change.";
  const actions = document.createElement("div");
  actions.className = "quick-actions";
  const enable = document.createElement("button");
  enable.className = "quick primary-quick";
  enable.textContent = "Enable enhanced measurement";
  const cancel = document.createElement("button");
  cancel.className = "quick";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    if (recognizedGtmContext) {
      renderGtmConnection(recognizedGtmContext);
    }
  });
  enable.addEventListener("click", async () => {
    enable.disabled = true;
    enable.textContent = "Enabling…";
    const response = await requestEnhancedEnable(audit.measurementId);
    const result = response.ok ? parseEnhancedEnable(response.result, audit.measurementId) : undefined;
    if (!result || !recognizedGtmContext) {
      enable.disabled = false;
      enable.textContent = "Retry enablement";
      boundary.textContent = "The change could not be verified. The master switch remains off; no success was assumed.";
      return;
    }

    recognizedGtmContext = { ...recognizedGtmContext, enhancedMeasurement: result };
    renderGtmConnection(recognizedGtmContext);
  });
  actions.append(enable, cancel);
  review.prepend(heading);
  review.append(boundary, actions);
  parent.replaceChildren(review);
}

function appendEnhancedAction(parent: HTMLElement, audit?: EnhancedMeasurementAudit): void {
  if (!audit?.canEnable || audit.settings.stream) {
    return;
  }
  const review = document.createElement("button");
  review.className = "quick";
  review.textContent = "Review enhanced measurement";
  review.addEventListener("click", () => renderEnhancedReview(parent, audit));
  parent.append(review);
}

function renderGtmConnection(view: GtmConnectionView): void {
  if (!gtmConnectionCard) return;
  gtmConnectionCard.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "gtm-context-heading";
  const title = document.createElement("strong");
  title.textContent = "GTM connection";
  const controls = document.createElement("span");
  controls.className = "gtm-context-controls";
  const badge = document.createElement("span");
  badge.className = "gtm-context-badge";
  const refresh = document.createElement("button");
  refresh.className = "gtm-context-refresh";
  refresh.type = "button";
  refresh.setAttribute("aria-label", "Refresh GTM connection");
  refresh.textContent = "↻";
  refresh.addEventListener("click", () => void loadGtmConnectionContext(true));
  controls.append(badge, refresh);
  heading.append(title, controls);
  const body = document.createElement("div");
  body.className = "gtm-context-body";
  const summary = document.createElement("p");
  const note = document.createElement("small");

  if (view.kind === "loading") {
    badge.textContent = "Checking";
    summary.textContent = "Checking authorized GTM access…";
  } else if (view.kind === "offline") {
    badge.textContent = "Service offline";
    badge.classList.add("warning");
    summary.textContent = "The local GTM service is offline.";
    note.textContent = "Chat remains available, but account and container access cannot be proven.";
  } else if (view.kind === "check_failed") {
    badge.textContent = "Check failed";
    badge.classList.add("warning");
    summary.textContent = "GTM access could not be safely verified.";
    note.textContent = "No account or container was assumed. Refresh after checking the local service.";
  } else if (view.kind === "unconfigured") {
    badge.textContent = "Not configured";
    badge.classList.add("warning");
    summary.textContent = "Google OAuth is not configured";
    if (view.containerIds.length > 0) appendConnectionRow(body, "Page", view.containerIds.join(" · "));
    note.textContent = view.containerIds.length > 0
      ? "The page ID is observable, but it does not prove GTM access."
      : "No GTM container was detected on this page, and API access is unavailable.";
  } else if (view.kind === "disconnected") {
    badge.textContent = "Connect Google";
    badge.classList.add("warning");
    summary.textContent = "Google authorization required";
    if (view.containerIds.length > 0) appendConnectionRow(body, "Page", view.containerIds.join(" · "));
    note.textContent = "Browser Google login and this app’s GTM authorization are separate.";
  } else if (view.kind === "no_container") {
    badge.textContent = effectiveAccess(view.status);
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", "No GTM container detected on this page");
    note.textContent = accessExplanation(view.status);
  } else if (view.kind === "multiple_containers") {
    badge.textContent = "Multiple page containers";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.containerIds.join(" · "));
    note.textContent = "No account or container was selected because the page exposes multiple GTM IDs.";
  } else if (view.kind === "recognition_failed") {
    badge.textContent = "Check failed";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    note.textContent = "The container access check was unavailable. No account or container was assumed.";
  } else if (view.kind === "not_accessible") {
    badge.textContent = "Not accessible";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    note.textContent = "This GTM ID was not found in the containers accessible to the authorized account.";
  } else if (view.kind === "ambiguous") {
    badge.textContent = "Ambiguous match";
    badge.classList.add("warning");
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    note.textContent = `${view.matchCount} accessible containers matched. None was selected.`;
  } else {
    badge.textContent = effectiveAccess(view.status);
    summary.textContent = "GTM API authorization connected";
    appendConnectionRow(body, "Page", view.publicId);
    appendConnectionRow(body, "Account", view.account.name);
    appendConnectionRow(body, "Container", view.container.name);
    appendConnectionRow(
      body,
      "GA4",
      view.measurementIds.length > 0 ? view.measurementIds.join(" · ") : "No live destination found",
    );
    appendEnhancedRows(body, view.enhancedMeasurement, view.enhancedMeasurementError);
    appendEnhancedAction(body, view.enhancedMeasurement);
    const leadBoundary = view.enhancedMeasurement
      ? " Confirmed lead outcomes remain separate."
      : "";
    const analyticsAccess = view.enhancedMeasurement?.canEnable
      ? " Analytics edit is limited to the reviewed master switch."
      : ` Analytics reads are ${view.status.analyticsReadEnabled ? "enabled" : "off"}.`;
    note.textContent = `${accessExplanation(view.status)}${analyticsAccess}${leadBoundary}`;
  }

  body.prepend(summary);
  if (note.textContent) body.append(note);
  gtmConnectionCard.append(heading, body);
}

async function loadGtmConnectionContext(force = false): Promise<void> {
  if (gtmConnectionLoaded && !force) return;
  const requestSequence = ++gtmConnectionRequestSequence;
  recognizedGtmContext = undefined;
  renderGtmConnection({ kind: "loading" });
  const runtime = inspectGtmRuntime();
  const containerIds = runtime.status === "detected" ? runtime.containerIds : [];
  let raw: unknown;
  try {
    raw = await chrome.runtime.sendMessage({ type: "GTM_CONNECTION_CONTEXT_REQUEST", containerIds });
  } catch {
    if (requestSequence !== gtmConnectionRequestSequence) return;
    gtmConnectionLoaded = true;
    renderGtmConnection({ kind: "offline" });
    return;
  }
  if (requestSequence !== gtmConnectionRequestSequence) return;
  gtmConnectionLoaded = true;
  if (isRecord(raw) && raw.ok === false && raw.error === "service_offline") {
    renderGtmConnection({ kind: "offline" });
    return;
  }
  const context = parseConnectionContext(raw, containerIds);
  if (!context) {
    renderGtmConnection({ kind: "check_failed" });
    return;
  }
  if (!context.status.configured) {
    renderGtmConnection({ kind: "unconfigured", containerIds });
    return;
  }
  if (!context.status.connected) {
    renderGtmConnection({ kind: "disconnected", containerIds });
    return;
  }
  if (containerIds.length === 0) {
    renderGtmConnection({ kind: "no_container", status: context.status });
    return;
  }
  if (containerIds.length > 1) {
    renderGtmConnection({ kind: "multiple_containers", status: context.status, containerIds });
    return;
  }
  if (context.recognitionError) {
    renderGtmConnection({ kind: "recognition_failed", status: context.status, publicId: containerIds[0]! });
    return;
  }
  if (context.result?.status === "not_accessible") {
    renderGtmConnection({ kind: "not_accessible", status: context.status, publicId: context.result.publicId });
    return;
  }
  if (context.result?.status === "ambiguous") {
    renderGtmConnection({
      kind: "ambiguous",
      status: context.status,
      publicId: context.result.publicId,
      matchCount: context.result.matchCount!,
    });
    return;
  }
  if (context.result?.status === "recognized" && context.result.account && context.result.container) {
    const view: Extract<GtmConnectionView, { kind: "recognized" }> = {
      kind: "recognized",
      status: context.status,
      publicId: context.result.publicId,
      account: context.result.account,
      container: context.result.container,
      measurementIds: context.result.measurementIds ?? [],
      ...(context.enhancedMeasurement ? { enhancedMeasurement: context.enhancedMeasurement } : {}),
      ...(context.enhancedMeasurementError
        ? { enhancedMeasurementError: context.enhancedMeasurementError }
        : {}),
    };
    recognizedGtmContext = view;
    renderGtmConnection(view);
    return;
  }
  renderGtmConnection({ kind: "check_failed" });
}

function navigationTargets(navigation: NavigationElement[]): PageTarget[] {
  return navigation.map((item) => ({ id: item.id, label: item.text, selector: item.selector }));
}

function formTargets(forms: FormCandidate[]): PageTarget[] {
  return forms.map((item) => ({ id: item.id, label: item.label, selector: item.selector }));
}

function recentAnalyticsRequests(since: number): BrowserEvidence["requests"] {
  return performance.getEntriesByType("resource")
    .filter((entry) => entry.startTime >= since && analyticsPattern.test(entry.name))
    .map((entry) => ({ url: entry.name, observedAt: new Date().toISOString() }));
}

function persistPreferences(): void {
  void chrome.storage.local.set({ overlayPreferences: preferences });
}

function applyPreferences(): void {
  if (!frame) return;
  frame.style.width = `${preferences.width}px`;
  frame.style.height = `${preferences.height}px`;
  frame.style.left = preferences.x === undefined ? "auto" : `${preferences.x}px`;
  frame.style.top = preferences.y === undefined ? "auto" : `${preferences.y}px`;
  frame.style.right = preferences.x === undefined ? "22px" : "auto";
  frame.style.bottom = preferences.y === undefined ? "22px" : "auto";
  frame.classList.toggle("collapsed", preferences.collapsed);
}

function setCollapsed(collapsed: boolean): void {
  preferences.collapsed = collapsed;
  if (!collapsed && !gtmConnectionLoaded) preferences.height = Math.max(preferences.height, 380);
  applyPreferences();
  persistPreferences();
  if (!collapsed) {
    void loadGtmConnectionContext();
    composer?.focus();
  }
}

function addMessage(copy: string, role: "assistant" | "user", id?: string): HTMLElement {
  const message = document.createElement("div");
  message.className = `message ${role === "assistant" ? "bot" : "user"}`;
  if (id) message.classList.add("streaming");
  message.textContent = copy;
  responseList?.append(message);
  responseList?.scrollTo({ top: responseList.scrollHeight });
  if (id) responseNodes.set(id, message);
  return message;
}

function automaticCoverage(): AgentTurnContext["automaticCoverage"] {
  const settings = recognizedGtmContext?.enhancedMeasurement?.settings;
  if (!settings) {
    return undefined;
  }

  return {
    enabled: settings.stream,
    pageViews: settings.pageViews,
    scrolls: settings.scrolls,
    outboundClicks: settings.outboundClicks,
    siteSearch: settings.siteSearch,
    videoEngagement: settings.videoEngagement,
    fileDownloads: settings.fileDownloads,
    formInteractions: settings.formInteractions,
  };
}

function agentContextForRequest(requestId: string): AgentTurnContext {
  const connected = recognizedGtmContext;
  const measurementId = connected?.measurementIds.length === 1
    ? connected.measurementIds[0]
    : undefined;
  const coverage = automaticCoverage();
  return {
    formCount: formsByRequest.get(requestId)?.length ?? 0,
    navigationCount: navigationByRequest.get(requestId)?.length ?? 0,
    ...(interactionCountsByRequest.has(requestId)
      ? { interactionCounts: interactionCountsByRequest.get(requestId)! }
      : {}),
    ...(coverage ? { automaticCoverage: coverage } : {}),
    ...(connected
      ? { connection: { publicId: connected.publicId, ...(measurementId ? { measurementId } : {}) } }
      : {}),
  };
}

function appendAgentText(parent: HTMLElement, className: string, copy: string): HTMLElement {
  const node = document.createElement("div");
  node.className = className;
  node.textContent = copy;
  parent.append(node);
  return node;
}

function positionAgentTask(task: HTMLElement): void {
  const messages = responseList;
  if (!messages) {
    return;
  }

  window.requestAnimationFrame(() => {
    if (!task.isConnected) {
      return;
    }
    const taskBounds = task.getBoundingClientRect();
    if (taskBounds.height <= messages.clientHeight) {
      messages.scrollTo({ top: messages.scrollHeight });
      return;
    }

    const viewportBounds = messages.getBoundingClientRect();
    const taskTop = messages.scrollTop + taskBounds.top - viewportBounds.top;
    messages.scrollTo({ top: Math.max(0, taskTop) });
  });
}

function renderAgentTurn(requestId: string, turn: AgentTurnV1, preferredNode?: HTMLElement): HTMLElement {
  const task = preferredNode ?? agentTaskNodes.get(requestId) ?? document.createElement("section");
  task.className = `agent-turn status-${turn.task.status}`;
  task.setAttribute("role", "region");
  task.setAttribute("aria-label", "Agent task");
  task.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "agent-turn-heading";
  appendAgentText(heading, "agent-kicker", "Working on");
  const status = appendAgentText(
    heading,
    "agent-status",
    turn.task.status === "needs_input"
      ? "Needs input"
      : turn.task.status === "completed"
        ? "Completed"
        : turn.task.status === "ready_for_review"
          ? "Ready to review"
          : turn.task.status === "blocked"
            ? "Blocked"
            : turn.task.status === "unsupported"
              ? "Not supported"
              : "Working",
  );
  status.setAttribute("aria-label", `Task status: ${status.textContent}`);
  task.append(heading);
  appendAgentText(task, "agent-goal", turn.task.goal);
  appendAgentText(task, "agent-summary", turn.task.summary);

  const plan = document.createElement("ol");
  plan.className = "agent-plan";
  plan.setAttribute("aria-label", "Task plan");
  for (const stage of turn.plan) {
    const row = document.createElement("li");
    row.className = `agent-plan-stage ${stage.status}`;
    const icon = document.createElement("i");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = stage.status === "completed" ? "✓" : stage.status === "active" ? "→" : stage.status === "blocked" ? "!" : "○";
    const label = document.createElement("span");
    label.textContent = stage.label;
    row.append(icon, label);
    if (stage.kind === "approval") appendAgentText(row, "agent-stage-kind", "Approval");
    plan.append(row);
  }
  task.append(plan);

  if (turn.receipts.length > 0) {
    const receipts = document.createElement("div");
    receipts.className = "agent-receipts";
    const receiptHeading = appendAgentText(receipts, "agent-receipt-heading", "Action receipts");
    receiptHeading.id = `agent-receipts-${requestId}`;
    receipts.setAttribute("aria-labelledby", receiptHeading.id);
    for (const receipt of turn.receipts) {
      const row = document.createElement("div");
      row.className = "agent-receipt";
      appendAgentText(row, "agent-receipt-label", `✓ ${receipt.label}`);
      appendAgentText(row, "agent-receipt-detail", receipt.detail);
      receipts.append(row);
    }
    task.append(receipts);
  }

  if (turn.question) appendAgentText(task, "agent-question", turn.question);
  agentTaskNodes.set(requestId, task);
  if (!task.isConnected) responseList?.append(task);
  renderQuickActions(requestId, turn.actions, task);
  preferences.height = Math.max(preferences.height, 520);
  applyPreferences();
  persistPreferences();
  positionAgentTask(task);
  return task;
}

function addAgentPending(requestId: string): HTMLElement {
  const task = document.createElement("section");
  task.className = "agent-turn agent-loading";
  task.setAttribute("role", "status");
  task.setAttribute("aria-label", "Agent is inspecting the request");
  appendAgentText(task, "agent-kicker", "Working on your task");
  appendAgentText(task, "agent-goal", "Inspecting the current page and measurement context…");
  responseList?.append(task);
  responseNodes.set(requestId, task);
  responseList?.scrollTo({ top: responseList.scrollHeight });
  return task;
}

function updateTargetHighlights(): void {
  const shadow = targetHost?.shadowRoot;
  if (!shadow) return;
  shadow.querySelectorAll(".target").forEach((node) => node.remove());
  highlightedTargets.forEach((item, index) => {
    const element = item.element?.isConnected
      ? item.element
      : document.querySelector<HTMLElement>(item.selector);
    if (!element || element.getBoundingClientRect().width === 0) return;
    const bounds = element.getBoundingClientRect();
    const marker = document.createElement("div");
    marker.className = `target ${highlightTone}`;
    marker.style.left = `${Math.max(2, bounds.left - 4)}px`;
    marker.style.top = `${Math.max(2, bounds.top - 4)}px`;
    marker.style.width = `${bounds.width + 8}px`;
    marker.style.height = `${bounds.height + 8}px`;
    marker.dataset.targetId = item.id;
    const label = document.createElement("span");
    label.textContent = `${highlightTone === "confirmed" ? "✓" : index + 1} ${item.label}`;
    marker.append(label);
    shadow.append(marker);
  });
}

function highlightTargets(targets: PageTarget[], tone: "candidate" | "confirmed"): void {
  highlightedTargets = targets;
  highlightTone = tone;
  if (!targetHost) {
    targetHost = document.createElement("div");
    targetHost.id = "gtm-observability-targets";
    const shadow = targetHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host { all: initial; pointer-events: none; }
      .target { position: fixed; z-index: 2147483646; box-sizing: border-box; border: 2px solid #f6c768; border-radius: 9px; background: rgba(246,199,104,.08); box-shadow: 0 0 0 3px rgba(246,199,104,.13), 0 8px 24px rgba(0,0,0,.16); transition: inset .12s ease, border-color .18s ease, background .18s ease; }
      .target.confirmed { border-color: #8de8bd; background: rgba(141,232,189,.1); box-shadow: 0 0 0 3px rgba(141,232,189,.14), 0 8px 24px rgba(0,0,0,.16); }
      .target span { position: absolute; left: -2px; bottom: calc(100% + 5px); max-width: 220px; padding: 4px 7px; overflow: hidden; border-radius: 7px; color: #201806; background: #f6c768; box-shadow: 0 5px 16px rgba(0,0,0,.2); font: 600 11px/1.2 Inter, ui-sans-serif, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
      .target.confirmed span { color: #092419; background: #8de8bd; }
    </style>`;
    document.documentElement.append(targetHost);
    window.addEventListener("scroll", updateTargetHighlights, { passive: true });
    window.addEventListener("resize", updateTargetHighlights, { passive: true });
  }
  updateTargetHighlights();
}

function clearTargetHighlights(): void {
  highlightedTargets = [];
  targetHost?.shadowRoot?.querySelectorAll(".target").forEach((node) => node.remove());
}

function confirmNavigation(navigation: NavigationElement[]): void {
  highlightTargets(navigationTargets(navigation), "confirmed");
  addMessage(`${navigation.length} navigation link${navigation.length === 1 ? "" : "s"} selected and highlighted on the page.`, "assistant");
  const proposal = navigationSetupProposal(navigation);
  if (!proposal) {
    addMessage("Connect a GTM container and GA4 measurement ID to generate setup.", "assistant");
    return;
  }

  addMessage("Reviewable navigation_click setup generated. Nothing was applied or published.", "assistant");
  renderNavigationSetupDownload(proposal);
}

function renderNavigationSetupDownload(proposal: SetupProposal): void {
  const row = document.createElement("div");
  row.className = "quick-actions";
  const download = document.createElement("a");
  download.className = "quick";
  download.textContent = "Download GTM setup";
  download.href = containerFileDownloadHref(proposal.containerFile);
  download.download = "gtm-observability-navigation-click.json";
  download.setAttribute("role", "button");
  download.addEventListener("click", () => {
    row.remove();
    addMessage("Downloaded the generated navigation_click setup. Nothing was applied or published.", "assistant");
  }, { once: true });
  row.append(download);
  responseList?.append(row);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function renderNavigationPicker(navigation: NavigationElement[]): void {
  const coverage = automaticCoverage();
  const automaticOutbound = coverage?.enabled && coverage.outboundClicks;
  highlightTargets(automaticOutbound ? [] : navigationTargets(navigation), "candidate");
  const picker = document.createElement("div");
  picker.className = "picker";
  for (const item of navigation) {
    const label = document.createElement("label");
    label.className = "pick";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !automaticOutbound;
    input.dataset.navigationId = item.id;
    input.addEventListener("change", () => {
      const selectedIds = new Set([...picker.querySelectorAll<HTMLInputElement>("input:checked")].map((node) => node.dataset.navigationId));
      highlightTargets(navigationTargets(navigation.filter((candidate) => selectedIds.has(candidate.id))), "candidate");
    });
    const copy = document.createElement("span");
    copy.textContent = item.text;
    const area = document.createElement("small");
    area.textContent = item.area;
    label.append(input, copy, area);
    picker.append(label);
  }
  const confirm = document.createElement("button");
  confirm.className = "quick primary-quick";
  confirm.textContent = "Confirm selection";
  confirm.addEventListener("click", () => {
    const selectedIds = new Set([...picker.querySelectorAll<HTMLInputElement>("input:checked")].map((node) => node.dataset.navigationId));
    const selected = navigation.filter((item) => selectedIds.has(item.id));
    if (!selected.length) { addMessage("Choose at least one link.", "assistant"); return; }
    picker.remove();
    confirmNavigation(selected);
  });
  picker.append(confirm);
  responseList?.append(picker);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function renderIntakeStep(requestId: string, result: ConversationIntakeResult): void {
  intakeByRequest.set(requestId, result);
  renderAgentTurn(requestId, agentTurnForIntake(result, agentContextForRequest(requestId)));
}

function renderFormDraft(requestId: string, result: ConversationIntakeResult): void {
  const target = result.target;
  const success = result.successSignal;
  if (!target || !success) return;
  const task = agentTaskNodes.get(requestId);
  if (!task) return;
  task.querySelector(".agent-specification")?.remove();
  task.querySelector(".quick-actions")?.remove();
  const specification = document.createElement("div");
  specification.className = "agent-specification";
  appendAgentText(specification, "agent-receipt-heading", "Reviewable setup");
  const specificationRows: Array<[string, string]> = [
    ["Interaction", `Successful ${target.label} submission`],
    ["Outcome", "Qualified inquiry"],
    ["Event", "generate_lead"],
    ["Success", success.label],
  ];
  for (const [label, value] of specificationRows) {
    const row = document.createElement("div");
    row.className = "agent-specification-row";
    appendAgentText(row, "agent-specification-label", label);
    appendAgentText(row, "agent-specification-value", value);
    specification.append(row);
  }
  task.append(specification);
  renderQuickActions(requestId, [{ id: "confirm-form-specification", label: "Approve setup" }], task);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function appendSpecificationRows(
  parent: HTMLElement,
  rows: Array<[string, string]>,
): void {
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "agent-specification-row";
    appendAgentText(row, "agent-specification-label", label);
    appendAgentText(row, "agent-specification-value", value);
    parent.append(row);
  }
}

const suggestionClassLabels: Record<string, string> = {
  provider_required: "Provider required",
  provider_recommended: "Provider recommended",
  observed_available: "Observed and available",
  model_suggested: "Model suggested",
  unavailable: "Unavailable",
  requires_clarification: "Needs clarification",
  requires_custom_definition: "GA4 custom definition",
  prohibited: "Prohibited",
};

function suggestionClassLabel(classification: string): string {
  return suggestionClassLabels[classification] ?? "Suggestion";
}

function renderInteractionDraft(requestId: string, result: ConversationIntakeResult): void {
  const proposal = interactionSetupProposal(result);
  const definition = knownInteractionDefinition(result.interaction);
  const task = agentTaskNodes.get(requestId);
  if (!task || !definition) return;
  task.querySelector(".agent-specification")?.remove();
  task.querySelector(".quick-actions")?.remove();
  const specification = document.createElement("div");
  specification.className = "agent-specification";
  appendAgentText(specification, "agent-receipt-heading", "Reviewable setup");
  appendSpecificationRows(specification, [
    ["Interaction", definition.interactionLabel],
    ["Event", definition.eventName],
    ["Firing scope", result.scope === "current_page" ? "Only this page" : `All matching ${definition.plural} sitewide`],
    ["Consent", "Requires analytics_storage"],
    ["Sent", proposal?.privacy.sent.join("; ") ?? "Event name"],
    ["Excluded", proposal?.privacy.excluded.join("; ") ?? "Private interaction values"],
  ]);
  if (proposal) {
    appendAgentText(specification, "agent-receipt-heading", "Parameter suggestions");
    for (const suggestion of proposal.suggestions) {
      appendAgentText(
        specification,
        "agent-specification-value",
        `${suggestion.disposition === "automatic" ? "Automatic" : "Excluded"}: ${suggestion.name} — ${suggestion.rationale}`,
      );
    }
  }
  task.append(specification);
  renderQuickActions(
    requestId,
    [
      { id: "approve-interaction-setup", label: "Approve setup" },
      { id: "author-interaction-alternative", label: "Ask model for alternative" },
    ],
    task,
  );
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

async function authorInteractionAlternative(
  requestId: string,
  intake: ConversationIntakeResult,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Requesting one bounded setup alternative from the configured authoring model.",
    verifyStatus: "pending",
  });
  let response: SetupAuthoringResponse;
  try {
    response = await requestSetupAuthoring(requestId, intake);
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok || !response.result) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "Model-backed setup authoring is unavailable. The deterministic setup remains unchanged.",
      verifyStatus: "pending",
      actions: [{ id: "return-to-interaction-review", label: "Return to setup" }],
    });
    return;
  }
  authoredSetupByRequest.set(requestId, response.result);
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: "The model proposed a schema-valid alternative using only deterministic page grounding.",
    verifyStatus: "pending",
    question: "Review the event and parameter classifications before approval.",
  });
  const review = document.createElement("div");
  review.className = "agent-specification";
  review.setAttribute("role", "region");
  review.setAttribute("aria-label", "Model-authored setup review");
  appendAgentText(review, "agent-receipt-heading", "Model-authored setup");
  appendSpecificationRows(review, [
    ["Event", response.result.eventName],
    ["Author", response.result.providerId],
    ["Rationale", response.result.rationale],
  ]);
  appendAgentText(review, "agent-receipt-heading", "Parameter suggestions");
  for (const suggestion of response.result.suggestions) {
    appendAgentText(
      review,
      "agent-specification-value",
      `${suggestionClassLabel(suggestion.classification)}: ${suggestion.name} — ${suggestion.rationale}`,
    );
  }
  task.append(review);
  renderQuickActions(requestId, [
    { id: "approve-model-authored-setup", label: "Approve model-authored setup" },
    { id: "return-to-interaction-review", label: "Keep deterministic setup" },
  ], task);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function renderModelAuthoredApproved(
  requestId: string,
  intake: ConversationIntakeResult,
): void {
  const authored = authoredSetupByRequest.get(requestId);
  if (!authored) return;
  authored.setup = { ...authored.setup, status: "confirmed" };
  renderFormTaskState(requestId, intake, {
    status: "completed",
    summary: `The model-authored ${authored.eventName} setup is approved for deterministic planning. Nothing was applied or published.`,
    verifyStatus: "pending",
    question: "Prepare the managed workspace and review the deterministic change plan.",
    actions: recognizedGtmContext?.status.containerWritesEnabled
      ? [{ id: "plan-form-workflow", label: "Prepare workspace & plan" }]
      : [],
  });
}

function renderInteractionApproved(requestId: string, result: ConversationIntakeResult): void {
  const proposal = interactionSetupProposal(result);
  const definition = knownInteractionDefinition(result.interaction);
  const canPlan = recognizedGtmContext?.status.containerWritesEnabled === true;
  const turn = agentTurnForIntake(result, agentContextForRequest(requestId));
  turn.task.status = proposal ? "completed" : "blocked";
  turn.task.summary = proposal && definition
    ? `The privacy-safe ${definition.eventName} setup was generated for review. Nothing was applied or published.`
    : "The setup needs one exact GTM container and GA4 destination before generation.";
  turn.question = proposal
    ? "Download the GTM setup for manual review while managed-workspace planning is being generalized."
    : "Connect one exact GTM container and GA4 destination to continue.";
  turn.plan = turn.plan.map((stage) => stage.id === "review"
    ? { ...stage, status: proposal ? "completed" : "blocked" }
    : stage.id === "verify"
      ? { ...stage, status: proposal ? "pending" : "blocked" }
      : stage);
  turn.actions = proposal
    ? [
        ...(canPlan ? [{ id: "plan-form-workflow", label: "Prepare workspace & plan" }] : []),
        { id: "download-interaction-setup", label: "Download GTM setup" },
      ]
    : [];
  renderAgentTurn(requestId, turn);
}

interface AgentVerificationResult {
  verdict: string;
  browserVerification: string;
  platformConfirmation: string;
  nextAction: string;
  explanation: string;
}

function renderFormTaskState(
  requestId: string,
  intake: ConversationIntakeResult,
  state: {
    status: AgentTaskStatus;
    summary: string;
    verifyStatus: "active" | "completed" | "blocked" | "pending";
    question?: string;
    actions?: Array<{ id: string; label: string }>;
    result?: AgentVerificationResult;
  },
): HTMLElement {
  const turn = agentTurnForIntake(intake, agentContextForRequest(requestId));
  turn.task.status = state.status;
  turn.task.summary = state.summary;
  if (state.question) turn.question = state.question;
  else delete turn.question;
  turn.plan = turn.plan.map((stage) => stage.id === "review"
    ? { ...stage, status: "completed" }
    : stage.id === "verify"
      ? { ...stage, status: state.verifyStatus }
      : stage);
  turn.actions = [];
  const task = renderAgentTurn(requestId, turn);
  if (state.result) {
    const result = document.createElement("div");
    result.className = "agent-verification-result";
    appendAgentText(result, "agent-receipt-heading", "Verification result");
    const rows: Array<[string, string]> = [
      ["Verdict", state.result.verdict],
      ["Browser verification", state.result.browserVerification],
      ["Platform confirmation", state.result.platformConfirmation],
      ["Next action", state.result.nextAction],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "agent-specification-row";
      appendAgentText(row, "agent-specification-label", label);
      appendAgentText(row, "agent-specification-value", value);
      result.append(row);
    }
    appendAgentText(result, "agent-verification-explanation explanation", state.result.explanation);
    task.append(result);
  }
  renderQuickActions(requestId, state.actions ?? [], task);
  responseList?.scrollTo({ top: responseList.scrollHeight });
  return task;
}

function canConfigureLeadGa4(): boolean {
  return recognizedGtmContext?.enhancedMeasurement?.canEnable === true;
}

function approvedFormActions(): Array<{ id: string; label: string }> {
  const canPlan = recognizedGtmContext?.status.containerWritesEnabled === true;
  return [
    ...(canPlan ? [{ id: "plan-form-workflow", label: "Prepare workspace & plan" }] : []),
    ...(canConfigureLeadGa4()
      ? [{ id: "review-ga4-configuration", label: "Review GA4 configuration" }]
      : []),
    { id: "download-form-setup", label: "Download GTM setup" },
    ...(!canPlan
      ? [{ id: "start-form-verification", label: "Verify already-installed setup" }]
      : []),
  ];
}

function renderApprovedFormSetup(
  requestId: string,
  intake: ConversationIntakeResult,
): void {
  const proposal = formSetupProposal(intake);
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: proposal
      ? "Setup approved and generated. The next step is one guided browser verification."
      : "Setup approved, but generation still needs one exact GTM container and GA4 destination.",
    question: proposal
      ? "Review the separate GTM or GA4 change, download the setup, or continue verification."
      : "Connect one exact GTM container and GA4 destination to continue.",
    verifyStatus: proposal ? "active" : "pending",
    actions: proposal ? approvedFormActions() : [],
  });
}

function ga4PlanActionLabel(action: Ga4ConfigurationActionV1): string {
  if (action.type === "custom_dimension") {
    return `Create custom dimension ${action.displayName}`;
  }
  if (action.type === "custom_metric") {
    return `Create custom metric ${action.displayName}`;
  }
  if (action.type === "key_event") {
    return `Mark ${action.eventName} as a key event`;
  }

  return `${action.enabled ? "Enable" : "Disable"} ${action.feature.replaceAll("_", " ")}`;
}

function isGa4PlanResult(
  value: Ga4ConfigurationResponse["result"],
): value is Ga4ConfigurationPlanV1 {
  if (!isRecord(value)) {
    return false;
  }

  const record = value as unknown as Record<string, unknown>;
  return typeof record.planFingerprint === "string" && Array.isArray(record.actions);
}

function isGa4ApplyResult(
  value: Ga4ConfigurationResponse["result"],
): value is Exclude<Ga4ConfigurationResponse["result"], Ga4ConfigurationPlanV1 | undefined> {
  return isRecord(value) && value.status === "applied" && Array.isArray(value.receipts);
}

async function planLeadGa4(
  requestId: string,
  intake: ConversationIntakeResult,
): Promise<void> {
  const measurementId = formSetupProposal(intake)?.measurementId;
  if (!measurementId || !canConfigureLeadGa4()) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "GA4 configuration requires one exact writable property and web stream. No GA4 change was made.",
      verifyStatus: "active",
      actions: [{ id: "return-to-approved-setup", label: "Return to setup" }],
    });
    return;
  }

  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Reading the exact GA4 property state and preparing a separate configuration plan.",
    verifyStatus: "active",
  });
  let response: Ga4ConfigurationResponse;
  try {
    response = await requestGa4Configuration("plan", { measurementId });
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok || !isGa4PlanResult(response.result)) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The GA4 configuration plan is unavailable. No GA4 or GTM change was made.",
      verifyStatus: "active",
      actions: [
        { id: "review-ga4-configuration", label: "Retry GA4 review" },
        { id: "return-to-approved-setup", label: "Return to setup" },
      ],
    });
    return;
  }

  const plan = response.result;
  ga4PlansByRequest.set(requestId, plan);
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: "The GA4 plan is separate from the approved GTM setup and has not been applied.",
    verifyStatus: "active",
    question: "Approve these exact GA4 property changes after reviewing their target and effect.",
  });
  const review = document.createElement("div");
  review.className = "agent-specification ga4-configuration-review";
  review.setAttribute("role", "region");
  review.setAttribute("aria-label", "GA4 configuration review");
  appendAgentText(review, "agent-receipt-heading", "GA4 configuration review");
  appendSpecificationRows(review, [
    ["Property", plan.target.propertyName],
    ["Stream", plan.target.streamName],
    ["GA4", plan.target.measurementId],
  ]);
  for (const action of plan.actions) {
    appendAgentText(review, "agent-specification-value", ga4PlanActionLabel(action));
  }
  appendAgentText(
    review,
    "agent-verification-explanation explanation",
    "GTM will not change. Fresh GA4 state must still match this plan when approval is applied.",
  );
  task.append(review);
  renderQuickActions(requestId, [
    { id: "apply-ga4-configuration", label: "Approve & apply GA4 changes" },
    { id: "return-to-approved-setup", label: "Return to setup" },
  ], task);
}

function ga4ReceiptLabel(
  receipt: Ga4ActionReceiptV1,
  plan: Ga4ConfigurationPlanV1,
): string {
  const action = plan.actions.find(({ id }) => id === receipt.actionId);
  const effect = action?.type === "custom_dimension"
    ? `custom dimension ${action.displayName}`
    : action?.type === "custom_metric"
      ? `custom metric ${action.displayName}`
      : action?.type === "key_event"
        ? `key event ${action.eventName}`
        : action?.type === "enhanced_measurement"
          ? `${action.feature.replaceAll("_", " ")} setting`
          : "GA4 resource";
  const status = receipt.status === "created"
    ? "Created"
    : receipt.status === "updated" ? "Updated" : "Already current";
  return `${status} ${effect}`;
}

async function applyLeadGa4(
  requestId: string,
  intake: ConversationIntakeResult,
  plan: Ga4ConfigurationPlanV1,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Applying approval only if the exact GA4 property state still matches the reviewed plan.",
    verifyStatus: "active",
  });
  let response: Ga4ConfigurationResponse;
  try {
    response = await requestGa4Configuration("apply", { plan });
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok || !isGa4ApplyResult(response.result)) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: response.error === "configuration_stale"
        ? "GA4 configuration approval is stale or the provider state changed. No GA4 changes were claimed."
        : "The GA4 configuration could not be verified as applied. No success was claimed.",
      verifyStatus: "active",
      actions: [
        { id: "review-ga4-configuration", label: "Review fresh GA4 state" },
        { id: "return-to-approved-setup", label: "Return to setup" },
      ],
    });
    return;
  }

  ga4PlansByRequest.delete(requestId);
  const task = renderFormTaskState(requestId, intake, {
    status: "completed",
    summary: "Google confirmed the separately approved GA4 configuration actions.",
    verifyStatus: "active",
    question: "GTM setup and publication remain unchanged. Continue the GTM workflow or download the setup.",
    actions: approvedFormActions(),
  });
  const result = document.createElement("div");
  result.className = "agent-specification ga4-configuration-result";
  result.setAttribute("role", "region");
  result.setAttribute("aria-label", "GA4 configuration result");
  appendAgentText(result, "agent-receipt-heading", "GA4 configuration result");
  for (const receipt of response.result.receipts) {
    appendAgentText(result, "agent-specification-value", ga4ReceiptLabel(receipt, plan));
  }
  task.append(result);
}

const planActionLabels: Record<PlanActionSummary["action"], string> = {
  create: "Create",
  reuse: "Reuse",
  no_op: "No change",
  update: "Update",
  conflict: "Conflict",
};

function renderWorkflowPlan(task: HTMLElement, plan: WorkflowPlanSummary): void {
  const view = document.createElement("div");
  view.className = "agent-specification operation-plan";
  view.setAttribute("role", "region");
  view.setAttribute("aria-label", "Tracking change plan");
  appendAgentText(view, "agent-receipt-heading", "Tracking change plan");
  const changeCount = plan.actions.filter(({ action }) => action === "create" || action === "update").length;
  appendAgentText(
    view,
    "agent-specification-value",
    changeCount === 0 ? "No changes" : `${changeCount} change${changeCount === 1 ? "" : "s"}`,
  );
  for (const action of plan.actions) {
    appendAgentText(
      view,
      "agent-specification-value",
      `${planActionLabels[action.action]} ${action.generatedName}`,
    );
  }
  task.append(view);
}

function semanticText(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function renderReplacementReview(task: HTMLElement, plan: WorkflowPlanSummary): void {
  const view = document.createElement("div");
  view.className = "agent-specification managed-replacement-review";
  view.setAttribute("role", "region");
  view.setAttribute("aria-label", "Managed replacement review");
  appendAgentText(view, "agent-receipt-heading", "Managed replacement review");
  appendAgentText(view, "agent-specification-value", `Plan ${plan.fingerprint}`);
  for (const action of plan.actions) {
    if (action.action !== "conflict" || !action.existingId || !action.replacement) continue;
    appendAgentText(
      view,
      "agent-specification-value",
      `${action.kind} ${action.existingId} · ${action.generatedName}`,
    );
    appendAgentText(
      view,
      "agent-specification-value",
      `Current fingerprint ${action.replacement.currentFingerprint}`,
    );
    appendAgentText(view, "agent-specification-label", "Current semantics");
    const current = document.createElement("pre");
    current.className = "agent-semantics";
    current.textContent = semanticText(action.replacement.currentSemantics);
    view.append(current);
    appendAgentText(view, "agent-specification-label", "Proposed semantics");
    const proposed = document.createElement("pre");
    proposed.className = "agent-semantics";
    proposed.textContent = semanticText(action.replacement.proposedSemantics);
    view.append(proposed);
  }
  const actions = task.querySelector(".quick-actions");
  if (actions) {
    actions.before(view);
  } else {
    task.append(view);
  }
}

function renderWorkflowResult(task: HTMLElement, result: WorkflowResumeSummary): void {
  const view = document.createElement("div");
  view.className = "agent-specification operation-result";
  view.setAttribute("role", "region");
  view.setAttribute("aria-label", "GTM workflow result");
  appendAgentText(view, "agent-receipt-heading", "GTM workflow result");
  appendAgentText(view, "agent-specification-value", "Application completed");
  appendAgentText(view, "agent-specification-value", "Validation passed");
  appendAgentText(
    view,
    "agent-specification-value",
    `Immutable version ${result.versionFingerprint} created`,
  );
  appendAgentText(view, "agent-specification-value", "Publication not started");
  task.append(view);
}

function versionReviewActions(
  requestId: string,
  intake: ConversationIntakeResult,
): Array<{ id: string; label: string }> {
  return [
    ...(recognizedGtmContext?.status.publicationEnabled
      ? [{ id: "review-exact-publication", label: "Review publication" }]
      : []),
    ...workflowReviewActions(requestId, intake, false),
  ];
}

function renderCompletedVersion(
  requestId: string,
  intake: ConversationIntakeResult,
  result: WorkflowResumeSummary,
): void {
  if (!result.versionFingerprint) return;
  workflowVersionByRequest.set(requestId, {
    operationId: result.operationId,
    versionFingerprint: result.versionFingerprint,
  });
  const publicationEnabled = recognizedGtmContext?.status.publicationEnabled === true;
  const task = renderFormTaskState(requestId, intake, {
    status: "completed",
    summary: "The exact workspace draft passed browser verification and an immutable version was created.",
    verifyStatus: "completed",
    question: publicationEnabled
      ? "Review this exact version before giving separate approval to make it live. Nothing was published."
      : "Publication requires separate approval bound to this version. Publishing is not enabled on this backend, and nothing was published.",
    actions: versionReviewActions(requestId, intake),
  });
  renderWorkflowResult(task, result);
}

function renderPublicationReview(
  requestId: string,
  intake: ConversationIntakeResult,
  version: NonNullable<ReturnType<typeof workflowVersionByRequest.get>>,
): void {
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: "This publication approval is separate from setup approval and browser verification.",
    verifyStatus: "completed",
    question: `Publish immutable version ${version.versionFingerprint} to make these reviewed changes live?`,
    actions: [
      { id: "confirm-exact-publication", label: `Approve & publish ${version.versionFingerprint}` },
      { id: "return-to-version-review", label: "Return to version" },
    ],
  });
  const binding = document.createElement("div");
  binding.className = "agent-specification operation-publication";
  binding.setAttribute("role", "region");
  binding.setAttribute("aria-label", "Publication approval binding");
  appendAgentText(binding, "agent-receipt-heading", "Publication approval binding");
  appendSpecificationRows(binding, [
    ["Version", version.versionFingerprint],
    ["Effect", "Make this immutable GTM version live"],
    ["Post-publish", "Live verification still required"],
  ]);
  task.append(binding);
  const plan = workflowPlansByRequest.get(requestId);
  if (plan) renderWorkflowPlan(task, plan);
}

async function publishExactVersion(
  requestId: string,
  intake: ConversationIntakeResult,
  version: NonNullable<ReturnType<typeof workflowVersionByRequest.get>>,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: `Binding publication approval to ${version.versionFingerprint} and checking fresh Google state before publication.`,
    verifyStatus: "completed",
  });
  let approval: WorkflowPublicationResponse;
  try {
    approval = await requestWorkflowPublicationAction(
      "GTM_WORKFLOW_APPROVE_PUBLICATION_REQUEST",
      version.operationId,
      version.versionFingerprint,
    );
  } catch {
    approval = { ok: false, error: "service_offline" };
  }
  if (!approval.ok
    || approval.result?.status !== "approved"
    || approval.result.versionFingerprint !== version.versionFingerprint) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "Publication approval was not accepted for the exact reviewed version. Nothing was published.",
      verifyStatus: "completed",
      question: "Return to the immutable version and review the current container state.",
      actions: [{ id: "return-to-version-review", label: "Return to version" }],
    });
    return;
  }
  let publication: WorkflowPublicationResponse;
  try {
    publication = await requestWorkflowPublicationAction(
      "GTM_WORKFLOW_PUBLISH_REQUEST",
      version.operationId,
      version.versionFingerprint,
    );
  } catch {
    publication = { ok: false, error: "service_offline" };
  }
  if (!publication.ok
    || publication.result?.status !== "published"
    || publication.result.versionFingerprint !== version.versionFingerprint
    || !publication.result.publishedAt) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The exact version was approved, but Google did not confirm publication. No publication success is claimed.",
      verifyStatus: "completed",
      question: "Check live-container state before retrying; approval may expire or fresh-state checks may block publication.",
    });
    return;
  }
  workflowPublicationByRequest.set(requestId, {
    operationId: version.operationId,
    versionFingerprint: version.versionFingerprint,
    publishedAt: publication.result.publishedAt,
  });
  const task = renderFormTaskState(requestId, intake, {
    status: "completed",
    summary: `Google confirmed publication of immutable version ${version.versionFingerprint}.`,
    verifyStatus: "completed",
    question: "Run live post-publication verification next. Rollback remains locked unless that evidence fails.",
    actions: [{
      id: intake.interaction === "form_submission"
        ? "start-live-form-verification"
        : "start-live-interaction-verification",
      label: "Run live verification",
    }],
  });
  const receipt = document.createElement("div");
  receipt.className = "agent-specification operation-publication";
  receipt.setAttribute("role", "region");
  receipt.setAttribute("aria-label", "Publication result");
  appendAgentText(receipt, "agent-receipt-heading", "Publication result");
  appendSpecificationRows(receipt, [
    ["Version", version.versionFingerprint],
    ["Provider", "Google Tag Manager confirmed"],
    ["Published", publication.result.publishedAt],
  ]);
  task.append(receipt);
}

async function completeLiveVerification(
  requestId: string,
  intake: ConversationIntakeResult,
  evidence: TrackingRunEvidenceV1,
): Promise<void> {
  const publication = workflowPublicationByRequest.get(requestId);
  if (!publication) return;
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: `Binding live browser evidence to published version ${publication.versionFingerprint}.`,
    verifyStatus: "active",
  });
  let response: WorkflowLiveVerificationResponse;
  try {
    response = await requestLiveVerification(
      publication.operationId,
      publication.versionFingerprint,
      evidence,
    );
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok
    || !response.result
    || response.result.versionFingerprint !== publication.versionFingerprint) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The live browser result could not be bound to the published version. Rollback remains locked.",
      verifyStatus: "blocked",
      question: "Retry the live browser run after checking the backend connection.",
      actions: [{
        id: intake.interaction === "form_submission"
          ? "start-live-form-verification"
          : "start-live-interaction-verification",
        label: "Retry live verification",
      }],
    });
    return;
  }
  publication.evidenceRunId = response.result.evidenceRunId;
  if (response.result.status === "published"
    && response.result.nextStep === "verify_publication") {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: `Live browser evidence for published version ${publication.versionFingerprint} was inconclusive. Rollback remains locked.`,
      verifyStatus: "blocked",
      question: "Retry the live browser run when the confirmed interaction and outcome are observable.",
      actions: [{
        id: intake.interaction === "form_submission"
          ? "start-live-form-verification"
          : "start-live-interaction-verification",
        label: "Retry live verification",
      }],
    });
    return;
  }
  if (response.result.status === "completed" && response.result.nextStep === "complete") {
    renderFormTaskState(requestId, intake, {
      status: "completed",
      summary: `Live browser verification passed for published version ${publication.versionFingerprint}.`,
      verifyStatus: "completed",
      question: "This tracking setup operation is complete.",
    });
    return;
  }
  const target = response.result.targetVersionFingerprint;
  if (response.result.status !== "rollback_required"
    || response.result.nextStep !== "rollback"
    || !target) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The backend returned an invalid live-verification decision. Rollback remains locked.",
      verifyStatus: "blocked",
    });
    return;
  }
  publication.targetVersionFingerprint = target;
  renderFormTaskState(requestId, intake, {
    status: "blocked",
    summary: `Live browser verification failed for published version ${publication.versionFingerprint}.`,
    verifyStatus: "blocked",
    question: `Review the recorded rollback from ${publication.versionFingerprint} to ${target}.`,
    actions: [{ id: "review-publication-rollback", label: "Review rollback" }],
  });
}

function renderRollbackReview(
  requestId: string,
  intake: ConversationIntakeResult,
  publication: NonNullable<ReturnType<typeof workflowPublicationByRequest.get>>,
): void {
  const target = publication.targetVersionFingerprint;
  if (!target) return;
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: "Rollback is a separate exact action after failed live browser evidence.",
    verifyStatus: "blocked",
    question: `Restore prior live version ${target}?`,
    actions: [
      { id: "confirm-publication-rollback", label: `Confirm rollback to ${target}` },
      { id: "return-to-failed-publication", label: "Return to failed result" },
    ],
  });
  const binding = document.createElement("div");
  binding.className = "agent-specification operation-publication";
  binding.setAttribute("role", "region");
  binding.setAttribute("aria-label", "Rollback approval binding");
  appendAgentText(binding, "agent-receipt-heading", "Rollback approval binding");
  appendSpecificationRows(binding, [
    ["Failed live version", publication.versionFingerprint],
    ["Restore", target],
    ["Evidence", publication.evidenceRunId ?? "Recorded live failure"],
  ]);
  task.append(binding);
}

async function rollbackPublication(
  requestId: string,
  intake: ConversationIntakeResult,
  publication: NonNullable<ReturnType<typeof workflowPublicationByRequest.get>>,
): Promise<void> {
  const target = publication.targetVersionFingerprint;
  if (!target) return;
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: `Checking fresh Google state before restoring ${target}.`,
    verifyStatus: "blocked",
  });
  let response: WorkflowRollbackResponse;
  try {
    response = await requestWorkflowRollback(
      publication.operationId,
      publication.versionFingerprint,
      target,
    );
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok
    || response.result?.status !== "rolled_back"
    || response.result.versionFingerprint !== publication.versionFingerprint
    || response.result.targetVersionFingerprint !== target) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "Google did not confirm the reviewed rollback. The current live state must be inspected before retrying.",
      verifyStatus: "blocked",
      actions: [{ id: "review-publication-rollback", label: "Review rollback" }],
    });
    return;
  }
  renderFormTaskState(requestId, intake, {
    status: "completed",
    summary: `Google restored prior live version ${target}.`,
    verifyStatus: "blocked",
    question: "The failed published version is no longer live; the operation retains both evidence receipts.",
  });
}

function renderPreviewHandoff(
  requestId: string,
  intake: ConversationIntakeResult,
  preview: NonNullable<ReturnType<typeof workflowPreviewByRequest.get>>,
): void {
  const task = renderFormTaskState(requestId, intake, {
    status: "needs_input",
    summary: "The reviewed changes are applied and the exact workspace draft passed provider validation. No immutable version exists yet.",
    verifyStatus: "active",
    question: "Open Google Tag Manager, select the managed workspace, click Preview, connect this website in Tag Assistant, then return here and start the exact browser run.",
  });
  const binding = document.createElement("div");
  binding.className = "agent-specification operation-preview";
  binding.setAttribute("role", "region");
  binding.setAttribute("aria-label", "Exact preview binding");
  appendAgentText(binding, "agent-receipt-heading", "Exact draft binding");
  appendSpecificationRows(binding, [
    ["Setup", preview.setupFingerprint],
    ["Workspace", preview.workspaceFingerprint],
    ["GTM preview", preview.previewVersionFingerprint],
  ]);
  task.append(binding);
  renderQuickActions(requestId, [
    { id: "open-tag-assistant", label: "Open Google Tag Manager" },
    {
      id: intake.interaction === "form_submission"
        ? "start-exact-form-preview"
        : "start-exact-interaction-preview",
      label: "Start exact browser run",
    },
  ], task);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function workflowReviewActions(
  requestId: string,
  intake: ConversationIntakeResult,
  includeApply: boolean,
): Array<{ id: string; label: string }> {
  if (authoredSetupByRequest.has(requestId)) {
    return includeApply ? [{ id: "apply-form-workflow", label: "Apply & validate draft" }] : [];
  }
  return [
    ...(includeApply ? [{ id: "apply-form-workflow", label: "Apply & validate draft" }] : []),
    {
      id: interactionSetupProposal(intake) ? "download-interaction-setup" : "download-form-setup",
      label: "Download GTM setup",
    },
  ];
}

function showWorkflowPlan(
  requestId: string,
  intake: ConversationIntakeResult,
  plan: WorkflowPlanSummary,
): void {
  workflowPlansByRequest.set(requestId, plan);
  const ready = plan.planStatus === "ready";
  const managedChange = plan.actions.some(
    ({ action, reason }) => action === "conflict" && reason === "managed_change_requires_approval",
  );
  const reviewable = managedChange && plan.actions.filter(({ action }) => action === "conflict")
    .every((action) => action.reason === "managed_change_requires_approval"
      && Boolean(action.entitySignature && action.existingId && action.replacement));
  const task = renderFormTaskState(requestId, intake, {
    status: ready ? "ready_for_review" : "blocked",
    summary: ready
      ? plan.replacementApproved
        ? "The exact managed replacement is approved. Nothing was applied or published."
        : "The durable change plan is ready. Nothing was applied or published."
      : managedChange
        ? "Existing managed setup differs. Explicit replacement approval is required. Nothing was applied or published."
        : "The plan contains a conflict. Nothing was applied or published.",
    verifyStatus: "pending",
    question: ready
      ? "Review the planned GTM changes before application."
      : managedChange
        ? "Existing managed setup differs. Keep it or begin an explicit replacement review."
        : "Resolve the conflict before application.",
    actions: ready
      ? workflowReviewActions(requestId, intake, true)
      : reviewable
        ? [{ id: "review-managed-replacement", label: "Review managed replacement" }]
        : [],
  });
  renderWorkflowPlan(task, plan);
}

function showReplacementReview(
  requestId: string,
  intake: ConversationIntakeResult,
  plan: WorkflowPlanSummary,
): void {
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: "Review the exact current and proposed managed GTM behavior. Nothing has been applied or published.",
    verifyStatus: "pending",
    question: "Approve replacement only if the entity ID, current fingerprint, and semantic change are expected.",
    actions: [
      { id: "approve-managed-replacement", label: "Approve managed replacement" },
      { id: "return-to-form-plan", label: "Return to plan" },
    ],
  });
  renderReplacementReview(task, plan);
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

async function approveManagedReplacement(
  requestId: string,
  intake: ConversationIntakeResult,
  plan: WorkflowPlanSummary,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Recording the exact managed replacement approval. No GTM write or publication is authorized yet.",
    verifyStatus: "pending",
  });
  let response: WorkflowPlanResponse;
  try {
    response = await requestReplacementApproval(plan);
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok || !response.result) {
    const task = renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The managed replacement approval was rejected or became stale. Nothing was applied or published.",
      verifyStatus: "pending",
      question: "Return to the exact review or create a fresh plan.",
      actions: [{ id: "return-to-form-plan", label: "Return to plan" }],
    });
    renderReplacementReview(task, plan);
    return;
  }
  showWorkflowPlan(requestId, intake, response.result);
}

function confirmWorkflowApply(
  requestId: string,
  intake: ConversationIntakeResult,
  plan: WorkflowPlanSummary,
): void {
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: "Review this exact GTM plan before authorizing container writes.",
    verifyStatus: "pending",
    question: "This writes the reviewed changes and validates the managed workspace. Browser preview must pass before an immutable version can be created. It does not publish. Continue?",
    actions: [
      { id: "confirm-form-workflow-apply", label: "Confirm apply & validate" },
      { id: "return-to-form-plan", label: "Return to plan" },
    ],
  });
  renderWorkflowPlan(task, plan);
}

function blockedWorkflowCopy(result: WorkflowResumeSummary): string {
  if (result.status === "paused") {
    return "Application paused after a partial write. Nothing was published.";
  }
  if (result.stage === "validation") {
    return "Validation stopped the workflow. No immutable version was created or published.";
  }
  if (result.stage === "version") {
    return "Version creation stopped. Nothing was published.";
  }
  return "The reviewed plan could not be applied. Nothing was published.";
}

function exactDraftRun(
  preview: NonNullable<ReturnType<typeof workflowPreviewByRequest.get>>,
  evidence: TrackingRunEvidenceV1,
): ExactDraftBrowserRunV1 {
  return {
    schemaVersion: 1,
    operationId: preview.operationId,
    setupFingerprint: preview.setupFingerprint,
    workspaceFingerprint: preview.workspaceFingerprint,
    previewVersionFingerprint: preview.previewVersionFingerprint,
    completedAt: new Date().toISOString(),
    evidence,
  };
}

async function beginDraftRepair(
  requestId: string,
  intake: ConversationIntakeResult,
  evidence: TrackingRunEvidenceV1,
): Promise<void> {
  const preview = workflowPreviewByRequest.get(requestId);
  if (!preview) return;
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "The exact browser run failed. Checking for one bounded repair that preserves the approved tracking setup.",
    verifyStatus: "active",
  });
  let response: WorkflowRepairResponse;
  try {
    response = await requestWorkflowRepair(preview.operationId, exactDraftRun(preview, evidence));
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok || !response.result) {
    workflowRepairsByRequest.delete(requestId);
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The exact browser run failed, and no safe deterministic repair is available. No version was created.",
      verifyStatus: "blocked",
      question: "Inspect the Tag Assistant and managed-workspace evidence before changing the approved tracking setup.",
    });
    return;
  }

  const repair = response.result;
  workflowRepairsByRequest.set(requestId, repair);
  const task = renderFormTaskState(requestId, intake, {
    status: "ready_for_review",
    summary: `Bounded repair ${repair.attempt} of ${repair.maximumAttempts} can restore the unchanged approved setup in the managed workspace. Nothing was applied or published.`,
    verifyStatus: "blocked",
    question: "Review this exact repair before authorizing workspace writes. A new exact browser preview will still be required.",
  });
  renderWorkflowPlan(task, {
    operationId: repair.operationId,
    status: "planned",
    planStatus: "ready",
    fingerprint: repair.planFingerprint,
    actions: repair.actions,
  });
  renderQuickActions(
    requestId,
    [{ id: "approve-draft-repair", label: "Approve repair & revalidate" }],
    task,
  );
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

async function applyReviewedDraftRepair(
  requestId: string,
  intake: ConversationIntakeResult,
  repair: WorkflowRepairSummary,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Applying the reviewed bounded repair and validating the managed workspace. No version or publication is authorized.",
    verifyStatus: "active",
  });
  let response: WorkflowResumeResponse;
  try {
    response = await requestApplyWorkflowRepair(repair.operationId, repair.planFingerprint);
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok
    || !response.result
    || response.result.status !== "awaiting_preview"
    || response.result.nextStep !== "run_tag_assistant_preview"
    || !response.result.setupFingerprint
    || !response.result.workspaceFingerprint
    || !response.result.previewVersionFingerprint) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The reviewed repair did not reach a validated workspace. No version was created or published.",
      verifyStatus: "blocked",
      question: "Inspect the managed-workspace action receipt before another repair attempt.",
    });
    return;
  }
  const preview = {
    operationId: response.result.operationId,
    setupFingerprint: response.result.setupFingerprint,
    workspaceFingerprint: response.result.workspaceFingerprint,
    previewVersionFingerprint: response.result.previewVersionFingerprint,
  };
  workflowRepairsByRequest.delete(requestId);
  workflowPreviewByRequest.set(requestId, preview);
  renderPreviewHandoff(requestId, intake, preview);
}

async function completeExactDraftVerification(
  requestId: string,
  intake: ConversationIntakeResult,
  evidence: TrackingRunEvidenceV1,
): Promise<void> {
  const preview = workflowPreviewByRequest.get(requestId);
  if (!preview) return;
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Browser verification passed. Binding the evidence to the exact setup, workspace, and GTM preview before version creation.",
    verifyStatus: "active",
  });
  const run = exactDraftRun(preview, evidence);
  let verification: { ok: boolean; error?: string };
  try {
    verification = await requestWorkflowDraftVerification(preview.operationId, run);
  } catch {
    verification = { ok: false, error: "service_offline" };
  }
  if (!verification.ok) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The browser run passed locally but could not be bound to the exact managed-workspace draft. No version was created.",
      verifyStatus: "blocked",
      question: "Return to the exact preview handoff and run it again.",
      actions: [{
        id: intake.interaction === "form_submission"
          ? "start-exact-form-preview"
          : "start-exact-interaction-preview",
        label: "Retry exact browser run",
      }],
    });
    return;
  }
  const resumed = await requestWorkflowResume(preview.operationId);
  if (!resumed.ok
    || !resumed.result
    || resumed.result.status !== "versioned"
    || resumed.result.nextStep !== "await_approval"
    || !resumed.result.versionFingerprint) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The exact draft is verified, but immutable version creation did not complete. Nothing was published.",
      verifyStatus: "completed",
      question: "Resume version creation after checking the managed workspace state.",
    });
    return;
  }
  workflowPreviewByRequest.delete(requestId);
  renderCompletedVersion(requestId, intake, resumed.result);
}

async function applyFormWorkflow(
  requestId: string,
  intake: ConversationIntakeResult,
  plan: WorkflowPlanSummary,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Applying the reviewed changes and validating the exact workspace draft. Version creation remains locked until browser preview passes.",
    verifyStatus: "pending",
  });
  let response: WorkflowResumeResponse;
  try {
    response = await requestWorkflowResume(plan.operationId);
  } catch {
    response = { ok: false, error: "service_offline" };
  }
  if (!response.ok || !response.result) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: "The reviewed plan could not be applied. Nothing was published.",
      verifyStatus: "pending",
      question: "Return to the reviewed plan before retrying.",
      actions: [{ id: "return-to-form-plan", label: "Return to plan" }],
    });
    return;
  }
  if (response.result.status === "awaiting_preview"
    && response.result.validationStatus === "passed"
    && response.result.nextStep === "run_tag_assistant_preview"
    && response.result.setupFingerprint
    && response.result.workspaceFingerprint
    && response.result.previewVersionFingerprint) {
    const preview = {
      operationId: response.result.operationId,
      setupFingerprint: response.result.setupFingerprint,
      workspaceFingerprint: response.result.workspaceFingerprint,
      previewVersionFingerprint: response.result.previewVersionFingerprint,
    };
    workflowPreviewByRequest.set(requestId, preview);
    renderPreviewHandoff(requestId, intake, preview);
    return;
  }
  if (response.result.status !== "versioned"
    || response.result.validationStatus !== "passed"
    || !response.result.versionFingerprint
    || response.result.nextStep !== "await_approval") {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: blockedWorkflowCopy(response.result),
      verifyStatus: "pending",
      question: "Review the plan and GTM workspace state before retrying.",
      actions: [{ id: "return-to-form-plan", label: "Return to plan" }],
    });
    return;
  }
  renderCompletedVersion(requestId, intake, response.result);
}

async function planFormWorkflow(
  requestId: string,
  intake: ConversationIntakeResult,
): Promise<void> {
  renderFormTaskState(requestId, intake, {
    status: "working",
    summary: "Preparing the managed workspace and calculating the tracking change plan.",
    verifyStatus: "pending",
  });
  const response = await requestWorkflowPlan(requestId, intake);
  if (!response.ok || !response.result) {
    workflowPlansByRequest.delete(requestId);
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: response.error === "planning_blocked"
        ? "Planning stopped because the connected workspace cannot accept this setup. Nothing was applied or published."
        : "The change plan could not be created. Nothing was applied or published.",
      verifyStatus: "pending",
      question: "Retry planning or download the setup for manual review.",
      actions: [
        { id: "plan-form-workflow", label: "Retry planning" },
        {
          id: interactionSetupProposal(intake) ? "download-interaction-setup" : "download-form-setup",
          label: "Download GTM setup",
        },
      ],
    });
    return;
  }
  showWorkflowPlan(requestId, intake, response.result);
}

function handleAssistantAction(actionId: string, requestId: string): void {
  if (actionId.startsWith("prompt:")) {
    if (composer) composer.value = actionId.slice("prompt:".length);
    submitPrompt();
    return;
  }
  if (actionId === "track-all-navigation") {
    confirmNavigation(navigationByRequest.get(requestId) ?? []);
    return;
  }
  if (actionId === "choose-navigation") {
    renderNavigationPicker(navigationByRequest.get(requestId) ?? []);
    return;
  }
  const intake = intakeByRequest.get(requestId);
  const forms = formsByRequest.get(requestId) ?? [];
  if (actionId.startsWith("scope:") && intake) {
    const scope = actionId.slice("scope:".length);
    if (scope === "sitewide" || scope === "current_page") {
      const interaction = knownInteractionDefinition(intake.interaction)?.interaction;
      if (interaction) {
        highlightTargets(
          interactionTargetsByRequest.get(requestId)?.[interaction] ?? [],
          "confirmed",
        );
      }
      renderIntakeStep(requestId, selectConversationScope(intake, scope));
    }
    return;
  }
  if (actionId.startsWith("target:") && intake) {
    const target = forms.find((form) => form.id === actionId.slice("target:".length));
    if (target) {
      highlightTargets(formTargets([target]), "confirmed");
      renderIntakeStep(requestId, selectConversationTarget(intake, target));
    }
    return;
  }
  if (actionId.startsWith("success:") && intake?.target) {
    const success = intake.target.successSignals.find((signal) => signal.id === actionId.slice("success:".length));
    if (success) renderIntakeStep(requestId, selectConversationSuccess(intake, intake.target, success));
    return;
  }
  if (actionId === "confirm-specification" && intake?.canConfirm) {
    renderFormDraft(requestId, intake);
    return;
  }
  if (actionId === "confirm-interaction-specification" && intake?.canConfirm) {
    renderInteractionDraft(requestId, intake);
    return;
  }
  if (actionId === "approve-interaction-setup" && intake?.canConfirm) {
    renderInteractionApproved(requestId, intake);
    return;
  }
  if (actionId === "author-interaction-alternative" && intake?.canConfirm) {
    void authorInteractionAlternative(requestId, intake);
    return;
  }
  if (actionId === "approve-model-authored-setup" && intake?.canConfirm) {
    renderModelAuthoredApproved(requestId, intake);
    return;
  }
  if (actionId === "return-to-interaction-review" && intake?.canConfirm) {
    authoredSetupByRequest.delete(requestId);
    renderInteractionDraft(requestId, intake);
    return;
  }
  if (actionId === "confirm-form-specification" && intake?.canConfirm) {
    renderApprovedFormSetup(requestId, intake);
    return;
  }
  if (actionId === "review-ga4-configuration" && intake?.canConfirm) {
    void planLeadGa4(requestId, intake);
    return;
  }
  const ga4Plan = ga4PlansByRequest.get(requestId);
  if (actionId === "apply-ga4-configuration" && intake?.canConfirm && ga4Plan) {
    void applyLeadGa4(requestId, intake, ga4Plan);
    return;
  }
  if (actionId === "return-to-approved-setup" && intake?.canConfirm) {
    ga4PlansByRequest.delete(requestId);
    renderApprovedFormSetup(requestId, intake);
    return;
  }
  if (actionId === "plan-form-workflow" && intake?.canConfirm) {
    void planFormWorkflow(requestId, intake);
    return;
  }
  const workflowPlan = workflowPlansByRequest.get(requestId);
  if (actionId === "review-managed-replacement" && intake?.canConfirm && workflowPlan) {
    showReplacementReview(requestId, intake, workflowPlan);
    return;
  }
  if (actionId === "approve-managed-replacement" && intake?.canConfirm && workflowPlan) {
    void approveManagedReplacement(requestId, intake, workflowPlan);
    return;
  }
  if (actionId === "apply-form-workflow" && intake?.canConfirm && workflowPlan) {
    confirmWorkflowApply(requestId, intake, workflowPlan);
    return;
  }
  if (actionId === "confirm-form-workflow-apply" && intake?.canConfirm && workflowPlan) {
    void applyFormWorkflow(requestId, intake, workflowPlan);
    return;
  }
  if (actionId === "open-tag-assistant" && intake?.canConfirm) {
    void chrome.runtime.sendMessage({ type: "OPEN_TAG_ASSISTANT" });
    const preview = workflowPreviewByRequest.get(requestId);
    if (preview) renderPreviewHandoff(requestId, intake, preview);
    return;
  }
  if (actionId === "start-exact-form-preview" && intake?.canConfirm) {
    void prepareFormVerification(requestId, intake);
    return;
  }
  if (actionId === "start-exact-interaction-preview" && intake?.canConfirm) {
    prepareInteractionVerification(requestId, intake);
    return;
  }
  const workflowRepair = workflowRepairsByRequest.get(requestId);
  if (actionId === "approve-draft-repair" && intake?.canConfirm && workflowRepair) {
    void applyReviewedDraftRepair(requestId, intake, workflowRepair);
    return;
  }
  const workflowVersion = workflowVersionByRequest.get(requestId);
  if (actionId === "review-exact-publication"
    && intake?.canConfirm
    && workflowVersion
    && recognizedGtmContext?.status.publicationEnabled) {
    renderPublicationReview(requestId, intake, workflowVersion);
    return;
  }
  if (actionId === "confirm-exact-publication"
    && intake?.canConfirm
    && workflowVersion
    && recognizedGtmContext?.status.publicationEnabled) {
    void publishExactVersion(requestId, intake, workflowVersion);
    return;
  }
  const workflowPublication = workflowPublicationByRequest.get(requestId);
  if (actionId === "start-live-form-verification"
    && intake?.canConfirm
    && workflowPublication) {
    void prepareFormVerification(requestId, intake);
    return;
  }
  if (actionId === "start-live-interaction-verification"
    && intake?.canConfirm
    && workflowPublication) {
    prepareInteractionVerification(requestId, intake);
    return;
  }
  if (actionId === "review-publication-rollback"
    && intake?.canConfirm
    && workflowPublication?.targetVersionFingerprint) {
    renderRollbackReview(requestId, intake, workflowPublication);
    return;
  }
  if (actionId === "confirm-publication-rollback"
    && intake?.canConfirm
    && workflowPublication?.targetVersionFingerprint) {
    void rollbackPublication(requestId, intake, workflowPublication);
    return;
  }
  if (actionId === "return-to-failed-publication"
    && intake?.canConfirm
    && workflowPublication?.targetVersionFingerprint) {
    renderFormTaskState(requestId, intake, {
      status: "blocked",
      summary: `Live browser verification failed for published version ${workflowPublication.versionFingerprint}.`,
      verifyStatus: "blocked",
      question: `Review the recorded rollback from ${workflowPublication.versionFingerprint} to ${workflowPublication.targetVersionFingerprint}.`,
      actions: [{ id: "review-publication-rollback", label: "Review rollback" }],
    });
    return;
  }
  if (actionId === "return-to-version-review" && intake?.canConfirm && workflowVersion) {
    renderCompletedVersion(requestId, intake, {
      operationId: workflowVersion.operationId,
      status: "versioned",
      validationStatus: "passed",
      versionFingerprint: workflowVersion.versionFingerprint,
      nextStep: "await_approval",
    });
    return;
  }
  if (actionId === "return-to-form-plan" && intake?.canConfirm && workflowPlan) {
    showWorkflowPlan(requestId, intake, workflowPlan);
    return;
  }
  if (actionId === "download-form-setup" && intake?.canConfirm) {
    if (!formSetupDownloadHref(intake)) {
      renderFormTaskState(requestId, intake, {
        status: "blocked",
        summary: "The setup cannot be generated without one exact measurement destination.",
        verifyStatus: "pending",
        question: "Connect a GTM container and GA4 measurement ID to continue.",
      });
      return;
    }
    renderFormTaskState(requestId, intake, {
      status: "working",
      summary: "The reviewable GTM container import was downloaded. Nothing was applied or published.",
      verifyStatus: "active",
      question: "Import it with Merge into a new workspace, then run verification.",
      actions: [{ id: "start-form-verification", label: "Verify already-installed setup" }],
    });
    return;
  }
  if (actionId === "download-interaction-setup" && intake?.canConfirm) {
    addMessage(`Downloaded the generated ${intake.eventName ?? "interaction"} setup. Nothing was applied or published.`, "assistant");
    return;
  }
  if (actionId === "start-form-verification" && intake?.canConfirm) {
    void prepareFormVerification(requestId, intake);
    return;
  }
  if (actionId === "retry-ga4-confirmation" && intake?.canConfirm) {
    void confirmGa4Platform(requestId);
    return;
  }
  if (actionId === "cancel") { clearTargetHighlights(); addMessage("Okay — nothing was selected.", "assistant"); }
}

function renderQuickActions(
  requestId: string,
  actions: Array<{ id: string; label: string }>,
  parent: HTMLElement | undefined = responseList,
): void {
  if (!actions.length) return;
  const row = document.createElement("div");
  row.className = "quick-actions";
  for (const action of actions) {
    const downloadHref = action.id === "download-form-setup"
      ? formSetupDownloadHref(intakeByRequest.get(requestId)!)
      : action.id === "download-interaction-setup"
        ? interactionSetupDownloadHref(intakeByRequest.get(requestId)!)
      : undefined;
    const control = downloadHref ? document.createElement("a") : document.createElement("button");
    control.className = "quick";
    control.textContent = action.label;
    if (control instanceof HTMLAnchorElement) {
      control.href = downloadHref!;
      control.download = action.id === "download-interaction-setup"
        ? `gtm-observability-${intakeByRequest.get(requestId)?.eventName?.replaceAll("_", "-") ?? "interaction"}.json`
        : "gtm-observability-generate-lead.json";
      control.setAttribute("role", "button");
    }
    control.addEventListener("click", () => {
      row.remove();
      handleAssistantAction(action.id, requestId);
    });
    row.append(control);
  }
  parent?.append(row);
  if (parent?.classList.contains("agent-turn")) {
    positionAgentTask(parent);
    return;
  }
  responseList?.scrollTo({ top: responseList.scrollHeight });
}

function connectAssistant(): chrome.runtime.Port {
  if (port) return port;
  port = chrome.runtime.connect({ name: "assistant" });
  port.onDisconnect.addListener(() => {
    port = undefined;
    for (const [requestId, node] of responseNodes) {
      node.className = "agent-turn status-blocked";
      node.textContent = "The agent connection restarted. Send that task again.";
      responseNodes.delete(requestId);
      const timeout = requestTimeouts.get(requestId);
      if (timeout !== undefined) window.clearTimeout(timeout);
      requestTimeouts.delete(requestId);
    }
  });
  port.onMessage.addListener((message: {
    type?: string;
    requestId?: string;
    turn?: unknown;
    navigation?: NavigationElement[];
    forms?: FormCandidate[];
    interactionCounts?: Partial<Record<KnownInteractionTypeV1, number>>;
    intake?: ConversationIntakeResult;
  }) => {
    if (!message.requestId) return;
    const node = responseNodes.get(message.requestId);
    if (message.type === "AGENT_TURN") {
      if (!node || !isAgentTurnV1(message.turn)) {
        if (node) {
          node.classList.remove("streaming");
          node.textContent = "The agent response could not be safely read. Try again.";
        }
        return;
      }
      responseNodes.delete(message.requestId);
      const timeout = requestTimeouts.get(message.requestId);
      if (timeout !== undefined) window.clearTimeout(timeout);
      requestTimeouts.delete(message.requestId);
      navigationByRequest.set(message.requestId, message.navigation ?? []);
      formsByRequest.set(message.requestId, message.forms ?? []);
      interactionCountsByRequest.set(message.requestId, message.interactionCounts ?? {});
      if (message.intake) {
        intakeByRequest.set(message.requestId, message.intake);
        if (message.intake.state === "awaiting_target") {
          highlightTargets(formTargets(message.forms ?? []), "candidate");
        } else if (message.intake.target) {
          highlightTargets(formTargets([message.intake.target]), "confirmed");
        } else {
          const interaction = knownInteractionDefinition(message.intake.interaction)?.interaction;
          if (interaction) {
            highlightTargets(
              interactionTargetsByRequest.get(message.requestId)?.[interaction] ?? [],
              "candidate",
            );
          }
        }
      }
      renderAgentTurn(message.requestId, message.turn, node);
    }
  });
  return port;
}

function submitPrompt(): void {
  const prompt = composer?.value.trim();
  if (!prompt) return;
  clearTargetHighlights();
  composer!.value = "";
  addMessage(prompt, "user");
  const requestId = crypto.randomUUID();
  const pending = addAgentPending(requestId);
  requestTimeouts.set(requestId, window.setTimeout(() => {
    if (!responseNodes.has(requestId)) return;
    pending.className = "agent-turn status-blocked";
    pending.textContent = "The agent did not respond. Try again.";
    responseNodes.delete(requestId);
    requestTimeouts.delete(requestId);
    port?.disconnect();
  }, 8_000));
  const scan = scanNavigation();
  const forms = scanForms();
  const interactionScan = scanKnownInteractions();
  const interactionCounts = interactionScan.counts;
  interactionTargetsByRequest.set(requestId, interactionScan.targets);
  const coverage = automaticCoverage();
  connectAssistant().postMessage({
    type: "ASSISTANT_REQUEST",
    requestId,
    prompt,
    page: {
      title: scan.title,
      url: scan.pageUrl,
      navigation: scan.navigation,
      forms,
      interactionCounts,
    },
    ...(recognizedGtmContext
      ? {
          connection: {
            publicId: recognizedGtmContext.publicId,
            ...(recognizedGtmContext.measurementIds.length === 1
              ? { measurementId: recognizedGtmContext.measurementIds[0] }
              : {}),
          },
          ...(coverage ? { automaticCoverage: coverage } : {}),
        }
      : {}),
  });
  preferences.height = Math.max(preferences.height, 420);
  applyPreferences();
  persistPreferences();
}

function enableDragging(handle: HTMLElement): void {
  handle.addEventListener("pointerdown", (event) => {
    if ((event.target as Element).closest("button")) return;
    const bounds = frame!.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent): void => {
      preferences.x = Math.max(8, Math.min(innerWidth - bounds.width - 8, moveEvent.clientX - offsetX));
      preferences.y = Math.max(8, Math.min(innerHeight - bounds.height - 8, moveEvent.clientY - offsetY));
      applyPreferences();
    };
    const end = (): void => { handle.removeEventListener("pointermove", move); persistPreferences(); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end, { once: true });
  });
}

async function mountOverlay(): Promise<void> {
  if (host) return;
  const stored = await chrome.storage.local.get("overlayPreferences");
  preferences = { ...preferences, ...(stored.overlayPreferences as Partial<OverlayPreferences> | undefined) };
  host = document.createElement("div");
  host.id = "gtm-observability-root";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .assistant { position: fixed; z-index: 2147483647; min-width: 310px; min-height: 220px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: hidden; resize: both; border: 1px solid rgba(255,255,255,.19); border-radius: 22px; background: linear-gradient(145deg, rgba(26,32,38,.78), rgba(12,17,21,.7)); color: #f5f7f8; box-shadow: 0 24px 70px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.08); backdrop-filter: blur(26px) saturate(145%); -webkit-backdrop-filter: blur(26px) saturate(145%); font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; display: grid; grid-template-rows: 30px 1fr auto; transition: width .18s ease, height .18s ease, border-color .18s ease, box-shadow .18s ease; }
      .assistant:focus-within { border-color: rgba(167,243,208,.32); box-shadow: 0 26px 76px rgba(0,0,0,.34), 0 0 0 1px rgba(167,243,208,.08), inset 0 1px 0 rgba(255,255,255,.1); }
      .drag { position: relative; cursor: grab; display: flex; justify-content: flex-end; align-items: center; padding: 0 9px; user-select: none; }
      .drag::before { content: ""; position: absolute; left: 50%; width: 34px; height: 3px; border-radius: 99px; transform: translateX(-50%); background: rgba(255,255,255,.16); }
      .drag:active { cursor: grabbing; }
      button { border: 0; cursor: pointer; font: inherit; }
      .icon { width: 24px; height: 24px; border-radius: 50%; color: #aab4bc; background: transparent; font-size: 17px; }
      .icon:hover { color: white; background: rgba(255,255,255,.08); }
      .messages { overflow-y: auto; overflow-x: hidden; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
      .messages > * { min-width: 0; }
      .gtm-context { flex: none; display: grid; gap: 8px; padding: 11px 12px; border: 1px solid rgba(167,243,208,.16); border-radius: 14px; background: linear-gradient(145deg, rgba(21,36,32,.82), rgba(18,27,31,.78)); box-shadow: inset 0 1px 0 rgba(255,255,255,.045); }
      .gtm-context-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .gtm-context-heading > strong { color: #f1f7f4; font-size: 12px; font-weight: 650; }
      .gtm-context-controls { display: flex; align-items: center; gap: 5px; }
      .gtm-context-badge { padding: 3px 7px; border: 1px solid rgba(141,232,189,.2); border-radius: 999px; color: #baf3d7; background: rgba(53,105,82,.3); font-size: 9px; font-weight: 700; letter-spacing: .025em; text-transform: uppercase; }
      .gtm-context-badge.warning { border-color: rgba(251,191,36,.18); color: #f4cf75; background: rgba(120,77,18,.24); }
      .gtm-context-refresh { display: grid; place-items: center; width: 23px; height: 23px; border-radius: 8px; color: #9aa7af; background: transparent; font-size: 15px; }
      .gtm-context-refresh:hover { color: #eff6f2; background: rgba(255,255,255,.07); }
      .gtm-context-body { display: grid; gap: 4px; min-width: 0; }
      .gtm-context-body p { margin: 0 0 2px; color: #c9d4d0; font-size: 10px; }
      .gtm-context-row { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 8px; align-items: baseline; }
      .gtm-context-row span { color: #7f8d94; font-size: 9px; text-transform: uppercase; }
      .gtm-context-row strong { min-width: 0; color: #e7eeeb; font-size: 11px; font-weight: 590; overflow-wrap: anywhere; }
      .gtm-context-body small { margin-top: 3px; color: #89969e; font-size: 9px; line-height: 1.4; }
      .enhanced-review { display: grid; gap: 6px; }
      .enhanced-review > strong { color: #f1f7f4; font-size: 12px; }
      .message { max-width: 88%; padding: 9px 11px; border-radius: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
      .message.bot { align-self: flex-start; color: #e5ebef; background: rgba(41,50,57,.72); border: 1px solid rgba(255,255,255,.06); border-radius: 4px 14px 14px 14px; }
      .message.user { align-self: flex-end; color: #f5fff9; background: #28483d; border-radius: 13px 13px 4px 13px; }
      .message.streaming:empty { width: 64px; height: 16px; background: linear-gradient(100deg, rgba(52,63,71,.6) 20%, rgba(167,243,208,.18) 45%, rgba(52,63,71,.6) 70%); background-size: 220% 100%; animation: shimmer 1.15s linear infinite; }
      .agent-welcome { display: grid; gap: 3px; padding: 2px 1px 5px; }
      .agent-welcome strong { color: #eef5f1; font-size: 13px; font-weight: 650; }
      .agent-welcome small { color: #93a09f; font-size: 10px; line-height: 1.45; }
      .agent-turn { align-self: stretch; display: grid; gap: 9px; min-width: 0; padding: 12px; border: 1px solid rgba(167,243,208,.14); border-radius: 15px; background: linear-gradient(145deg, rgba(24,37,36,.9), rgba(21,29,34,.9)); box-shadow: inset 0 1px 0 rgba(255,255,255,.045); }
      .agent-turn.status-blocked, .agent-turn.status-unsupported { border-color: rgba(251,191,36,.18); }
      .agent-turn.status-completed { border-color: rgba(141,232,189,.25); }
      .agent-turn-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .agent-kicker { color: #8de8bd; font-size: 9px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
      .agent-status { padding: 2px 6px; border-radius: 999px; color: #baf3d7; background: rgba(57,113,88,.3); font-size: 8px; font-weight: 700; letter-spacing: .035em; text-transform: uppercase; }
      .status-blocked .agent-status, .status-unsupported .agent-status { color: #f4cf75; background: rgba(120,77,18,.28); }
      .agent-goal { color: #f2f7f4; font-size: 14px; font-weight: 680; line-height: 1.3; overflow-wrap: anywhere; }
      .agent-summary { color: #b8c4c2; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
      .agent-plan { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
      .agent-plan-stage { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 6px; min-height: 24px; color: #7e8c91; font-size: 10px; }
      .agent-plan-stage i { display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; color: #819097; background: rgba(255,255,255,.045); font: 700 9px/1 Inter, sans-serif; }
      .agent-plan-stage.completed { color: #aab7b4; }
      .agent-plan-stage.completed i { color: #092419; background: #8de8bd; }
      .agent-plan-stage.active { color: #eff6f2; font-weight: 620; }
      .agent-plan-stage.active i { color: #baf3d7; background: rgba(57,113,88,.42); box-shadow: inset 0 0 0 1px rgba(141,232,189,.18); }
      .agent-plan-stage.blocked { color: #e4c67e; }
      .agent-plan-stage.blocked i { color: #f4cf75; background: rgba(120,77,18,.35); }
      .agent-stage-kind { color: #84928f; font-size: 8px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; }
      .agent-receipts { display: grid; gap: 4px; padding: 8px; border-radius: 10px; background: rgba(9,15,18,.38); }
      .agent-receipt-heading { color: #85938f; font-size: 8px; font-weight: 700; letter-spacing: .055em; text-transform: uppercase; }
      .agent-receipt { display: grid; grid-template-columns: minmax(72px, .8fr) minmax(0, 1.2fr); align-items: start; gap: 8px; color: #a9b6b3; font-size: 9px; }
      .agent-receipt-label { min-width: 0; overflow-wrap: anywhere; }
      .agent-receipt-detail { min-width: 0; color: #7f8d92; text-align: right; overflow-wrap: anywhere; }
      .agent-question { padding-top: 1px; color: #e6eeea; font-size: 11px; font-weight: 590; overflow-wrap: anywhere; }
      .agent-specification { display: grid; gap: 5px; padding: 9px; border: 1px solid rgba(255,255,255,.08); border-radius: 11px; background: rgba(9,15,18,.35); }
      .agent-verification-result { display: grid; gap: 5px; padding: 9px; border: 1px solid rgba(141,232,189,.12); border-radius: 11px; background: rgba(9,15,18,.35); }
      .agent-specification-row { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 7px; font-size: 9px; }
      .agent-specification-label { color: #7f8d92; text-transform: uppercase; }
      .agent-specification-value { color: #dbe5e1; overflow-wrap: anywhere; }
      .agent-semantics { max-height: 150px; margin: 0; padding: 7px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: #c8d7d1; background: rgba(0,0,0,.22); border-radius: 7px; font: 8px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
      .agent-verification-explanation { padding-top: 4px; color: #9fadaa; font-size: 9px; line-height: 1.45; overflow-wrap: anywhere; }
      .agent-loading { min-height: 70px; background: linear-gradient(100deg, rgba(24,37,36,.9) 20%, rgba(70,105,94,.35) 45%, rgba(21,29,34,.9) 70%); background-size: 220% 100%; animation: shimmer 1.15s linear infinite; }
      .agent-turn > .quick-actions { margin-top: 1px; }
      .quick-actions { display: flex; flex-wrap: wrap; gap: 7px; }
      .quick { padding: 7px 10px; border: 1px solid rgba(167,243,208,.22); border-radius: 10px; color: #dff9ec; background: rgba(40,72,61,.58); font-size: 12px; text-decoration: none; }
      .quick:hover { border-color: rgba(167,243,208,.42); background: rgba(47,88,73,.72); }
      .gtm-action { justify-self: start; margin-top: 3px; }
      .gtm-write-note { color: #89969e; font-size: 10px; }
      .primary-quick { margin-top: 3px; justify-self: start; }
      .picker { display: grid; gap: 6px; padding: 9px; border: 1px solid rgba(255,255,255,.09); border-radius: 13px; background: rgba(22,29,34,.62); }
      .pick { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 6px; border-radius: 8px; color: #e3eaee; }
      .pick:hover { background: rgba(255,255,255,.04); }
      .pick input { accent-color: #8de8bd; }
      .pick small { color: #87949d; font-size: 10px; text-transform: uppercase; }
      .composer { margin: 0 12px 12px; padding: 6px 6px 6px 12px; display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 8px; border: 1px solid rgba(255,255,255,.14); border-radius: 15px; background: rgba(31,39,45,.72); box-shadow: inset 0 1px 0 rgba(255,255,255,.035); transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
      .composer:focus-within { border-color: rgba(167,243,208,.38); background: rgba(34,43,49,.88); box-shadow: 0 0 0 3px rgba(167,243,208,.06), inset 0 1px 0 rgba(255,255,255,.05); }
      textarea { resize: none; min-height: 38px; max-height: 120px; padding: 8px 0; border: 0; outline: 0; color: white; background: transparent; font: inherit; }
      textarea::placeholder { color: #87939c; }
      .send { width: 38px; height: 38px; border-radius: 12px; color: #0c1b15; background: linear-gradient(145deg, #c4fae0, #8de8bd); box-shadow: 0 5px 16px rgba(86,220,157,.16), inset 0 1px 0 rgba(255,255,255,.5); font-size: 20px; transition: transform .15s ease, box-shadow .15s ease; }
      .send:hover { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(86,220,157,.24), inset 0 1px 0 rgba(255,255,255,.55); }
      .assistant.collapsed { width: 48px !important; height: 48px !important; min-width: 48px; min-height: 48px; resize: none; display: grid; place-items: center; border-radius: 16px; border-color: rgba(255,255,255,.24); background: linear-gradient(145deg, rgba(48,58,67,.76), rgba(17,23,28,.7)); box-shadow: 0 12px 34px rgba(0,0,0,.3), 0 0 0 1px rgba(167,243,208,.05), inset 0 1px 0 rgba(255,255,255,.14); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); }
      .collapsed .drag, .collapsed .messages, .collapsed .composer { display: none; }
      .orb { display: none; position: relative; width: 100%; height: 100%; border-radius: 16px; color: transparent; background: transparent; }
      .orb::before { content: ""; position: absolute; inset: 13px; border-radius: 7px; background: conic-gradient(from 210deg, #8de8bd, #8bbcf6, #bd9af8, #8de8bd); filter: saturate(.78); box-shadow: 0 0 16px rgba(141,232,189,.22); }
      .orb::after { content: ""; position: absolute; inset: 17px; border-radius: 5px; background: rgba(17,23,28,.9); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }
      .collapsed .orb { display: block; }
      .collapsed:hover { transform: translateY(-2px); border-color: rgba(167,243,208,.32); box-shadow: 0 16px 42px rgba(0,0,0,.34), 0 0 24px rgba(141,232,189,.1), inset 0 1px 0 rgba(255,255,255,.16); }
      @keyframes shimmer { to { background-position: -120% 0; } }
      @media (prefers-reduced-motion: reduce) { .assistant, .send { transition: none; } .message.streaming:empty, .agent-loading { animation: none; } }
    </style>
    <section class="assistant collapsed" aria-label="Tracking agent">
      <div class="drag" aria-label="Drag agent"><button class="icon collapse" aria-label="Collapse agent">−</button></div>
      <div class="messages" aria-live="polite"><section class="gtm-context" role="region" aria-label="GTM connection"></section><div class="agent-welcome"><strong>What should we set up or check?</strong><small>I use this page and its connected measurement context automatically.</small></div></div>
      <div class="composer"><textarea aria-label="Tracking request" placeholder="Describe an action or outcome…"></textarea><button class="send" aria-label="Send request">↑</button></div>
      <button class="orb" aria-label="Open tracking agent">G</button>
    </section>`;
  frame = shadow.querySelector<HTMLElement>(".assistant")!;
  responseList = shadow.querySelector<HTMLElement>(".messages")!;
  composer = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
  gtmConnectionCard = shadow.querySelector<HTMLElement>(".gtm-context")!;
  renderGtmConnection({ kind: "loading" });
  shadow.querySelector(".orb")?.addEventListener("click", () => setCollapsed(false));
  shadow.querySelector(".collapse")?.addEventListener("click", () => setCollapsed(true));
  shadow.querySelector(".send")?.addEventListener("click", submitPrompt);
  composer.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitPrompt(); }
  });
  enableDragging(shadow.querySelector<HTMLElement>(".drag")!);
  new ResizeObserver(() => {
    if (!frame || preferences.collapsed) return;
    preferences.width = Math.round(frame.clientWidth);
    preferences.height = Math.round(frame.clientHeight);
    persistPreferences();
  }).observe(frame);
  document.documentElement.append(host);
  applyPreferences();
  if (!preferences.collapsed) void loadGtmConnectionContext();
}

document.addEventListener("click", (event) => {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
  const exactInteraction = activeInteractionVerification;
  const exactType = exactInteraction
    ? knownInteractionDefinition(exactInteraction.intake.interaction)?.interaction
    : undefined;
  const observed = anchor && exactType
    ? countKnownLinkInteractions(location.href, [anchor.getAttribute("href") ?? ""])[exactType] === 1
    : false;
  if (exactInteraction && observed) {
    window.setTimeout(() => finishInteractionVerification(exactInteraction), 1_200);
  }
  if (!anchor || verificationScope.size === 0) return;
  const expected = [...verificationScope.values()].find((item) => item.href === anchor.href && anchor.matches(item.selector));
  if (!expected) return;
  const startedAt = performance.now();
  const initial: BrowserEvidence = { navigationId: expected.id, clickedAt: new Date().toISOString(), pageUrl: location.href, linkText: (anchor.innerText || expected.text).trim(), linkUrl: anchor.href, requests: [] };
  evidence.set(expected.id, initial);
  void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: initial });
  window.setTimeout(() => {
    const item = { ...initial, requests: recentAnalyticsRequests(startedAt) };
    evidence.set(expected.id, item);
    void chrome.runtime.sendMessage({ type: "VERIFICATION_EVIDENCE", evidence: item });
  }, 1200);
}, true);

document.addEventListener("submit", (event) => {
  const active = activeFormVerification;
  const form = event.target instanceof HTMLFormElement ? event.target : undefined;
  const target = active?.intake.target;
  if (!active || !form || !target || !form.matches(target.selector)) return;
  const startedAt = new Date().toISOString();
  const startedAtPerformance = performance.now();
  window.setTimeout(
    () => settleFormVerification(
      active.requestId,
      active.intake,
      startedAt,
      startedAtPerformance,
      startedAtPerformance + 5_000,
    ),
    1_200,
  );
}, true);

if (!window.__gtmObservabilityInstalled) {
  window.__gtmObservabilityInstalled = true;
  void mountOverlay();
  chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
    if (request.type === "TOGGLE_OVERLAY") { void mountOverlay().then(() => setCollapsed(!preferences.collapsed)); sendResponse({ toggled: true }); return true; }
    if (request.type === "SCAN_NAVIGATION") { sendResponse(scanNavigation()); return; }
    if (request.type === "START_VERIFICATION") { evidence.clear(); verificationScope = new Map(request.navigation.map((item) => [item.id, item])); sendResponse({ started: true, count: verificationScope.size }); return; }
    if (request.type === "FORM_ANALYTICS_REQUEST") { recentFormRequests.push(request.request); sendResponse({ recorded: true }); return; }
    if (request.type === "GET_EVIDENCE") sendResponse({ evidence: [...evidence.values()] });
  });
}
