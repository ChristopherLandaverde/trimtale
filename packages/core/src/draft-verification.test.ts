import { describe, expect, it } from "vitest";
import { createSetupProposal } from "./generator.js";
import { createTrackingChangePlan } from "./change-plan.js";
import {
  assertExactDraftRunCurrent,
  bindExactDraftBrowserRun,
  createDraftRepairLedger,
  markRepairPassedToVerification,
  recordDraftRepairAttempt,
  resumeDraftRepairAfterFailure,
  setupArtifactFingerprint,
  trackingIntentFingerprint,
  verifiedDraftBindingCurrent,
  type ExactDraftBrowserRunV1,
} from "./draft-verification.js";
import type { TrackingRunEvidenceV1 } from "./contracts.js";
import type { TrackingSetupOperationV1 } from "./tracking-operation.js";

function operation(): TrackingSetupOperationV1 {
  const proposal = createSetupProposal({
    intent: "Track navigation clicks",
    pageUrl: "https://example.test/",
    measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Site" },
    navigation: [{ id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav", selector: "nav a[href='/pricing']" }],
  });
  const plan = createTrackingChangePlan(proposal.containerFile, {});
  return {
    schemaVersion: 1,
    id: "operation_navigation",
    status: "validated",
    createdAt: "2026-08-24T12:00:00.000Z",
    updatedAt: "2026-08-24T12:05:00.000Z",
    specification: proposal.specification,
    generatedSetup: proposal.containerFile,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: { path: "accounts/1/containers/10/workspaces/2", fingerprint: "workspace-2" },
    plan,
    completedActionSignatures: plan.actions.map(({ entitySignature }) => entitySignature),
    validation: {
      status: "passed",
      checkedAt: "2026-08-24T12:05:00.000Z",
      workspaceFingerprint: "workspace-2",
      previewVersionFingerprint: "preview-2",
      errors: [],
    },
  };
}

function evidence(specificationId: string): TrackingRunEvidenceV1 {
  return {
    schemaVersion: 1,
    runId: "run_pricing_1",
    specificationId,
    startedAt: "2026-08-24T12:06:00.000Z",
    observations: {
      interaction: { type: "navigation_click", targetId: "pricing", attempted: true, submissionResult: "success" },
      outcome: { observed: true, observable: true, evidenceType: "navigation_click" },
      dataLayer: { matchingEvents: [] },
      tagFired: true,
      network: { ga4Requests: [{ url: "https://www.google-analytics.com/g/collect?v=2", observedAt: "2026-08-24T12:06:01.000Z" }] },
      consent: { analyticsStorage: "granted" },
    },
    verdict: {
      code: "browser_verified",
      browserVerification: "passed",
      platformConfirmation: "unverified",
      nextAction: "Await platform confirmation.",
    },
  };
}

function exactRun(subject: TrackingSetupOperationV1): ExactDraftBrowserRunV1 {
  return {
    schemaVersion: 1,
    operationId: subject.id,
    setupFingerprint: setupArtifactFingerprint(subject),
    workspaceFingerprint: subject.workspace.fingerprint,
    previewVersionFingerprint: subject.validation!.previewVersionFingerprint!,
    completedAt: "2026-08-24T12:07:00.000Z",
    evidence: evidence(subject.specification.id),
  };
}

describe("exact workspace draft verification", () => {
  it("binds passing browser evidence to the setup, workspace, and GTM preview", () => {
    const subject = operation();
    const binding = bindExactDraftBrowserRun(subject, exactRun(subject));

    expect(binding).toMatchObject({
      operationId: subject.id,
      workspaceFingerprint: "workspace-2",
      previewVersionFingerprint: "preview-2",
      evidenceRunId: "run_pricing_1",
    });
    expect(binding.evidenceFingerprint).toMatch(/^evidence_[a-f0-9]{12}$/);
    expect(verifiedDraftBindingCurrent(subject, binding)).toBe(true);
  });

  it.each([
    ["setup", (subject: TrackingSetupOperationV1) => {
      (subject.generatedSetup.containerVersion.tag[0] as Record<string, unknown>).name = "Changed";
    }],
    ["workspace", (subject: TrackingSetupOperationV1) => { subject.workspace.fingerprint = "workspace-3"; subject.validation!.workspaceFingerprint = "workspace-3"; }],
    ["preview", (subject: TrackingSetupOperationV1) => { subject.validation!.previewVersionFingerprint = "preview-3"; }],
  ])("invalidates evidence after a %s change", (_name, mutate) => {
    const subject = operation();
    const binding = bindExactDraftBrowserRun(subject, exactRun(subject));
    mutate(subject);
    expect(verifiedDraftBindingCurrent(subject, binding)).toBe(false);
  });

  it("rejects passing live-site evidence mislabeled as another preview", () => {
    const subject = operation();
    const run = { ...exactRun(subject), previewVersionFingerprint: "preview-live" };
    expect(() => bindExactDraftBrowserRun(subject, run)).toThrow("another GTM preview fingerprint");
  });

  it("accepts exact failed evidence for repair without treating it as verification", () => {
    const subject = operation();
    const run = exactRun(subject);
    run.evidence.verdict = {
      code: "tag_fired_request_missing",
      browserVerification: "failed",
      platformConfirmation: "unverified",
      nextAction: "Review a bounded repair.",
    };

    expect(() => assertExactDraftRunCurrent(subject, run)).not.toThrow();
    expect(() => bindExactDraftBrowserRun(subject, run)).toThrow("Only passing browser evidence");
  });

  it("bounds repair and stops immediately when the fix becomes ambiguous", () => {
    const subject = operation();
    const intentFingerprint = trackingIntentFingerprint(subject);
    let ledger = createDraftRepairLedger(subject, 2);
    ledger = recordDraftRepairAttempt(ledger, {
      attemptedAt: "2026-08-24T12:08:00.000Z",
      intentFingerprint,
      fromSetupFingerprint: "setup_1",
      toSetupFingerprint: "setup_2",
      reasonCode: "selector_not_observed",
      result: "applied",
    });
    ledger = markRepairPassedToVerification(ledger);
    expect(ledger.status).toBe("passed_to_verification");
    ledger = resumeDraftRepairAfterFailure(ledger);

    ledger = recordDraftRepairAttempt(ledger, {
      attemptedAt: "2026-08-24T12:09:00.000Z",
      intentFingerprint,
      fromSetupFingerprint: "setup_2",
      toSetupFingerprint: "setup_3",
      reasonCode: "multiple_targets",
      result: "ambiguous",
    });
    expect(ledger.status).toBe("stopped_ambiguous");
    expect(() => recordDraftRepairAttempt(ledger, {
      attemptedAt: "2026-08-24T12:10:00.000Z",
      intentFingerprint,
      fromSetupFingerprint: "setup_3",
      toSetupFingerprint: "setup_4",
      reasonCode: "retry",
      result: "applied",
    })).toThrow("does not accept another attempt");
  });

  it("allows the final bounded repair to reach verification, then exhausts after failure", () => {
    const subject = operation();
    const intentFingerprint = trackingIntentFingerprint(subject);
    let ledger = createDraftRepairLedger(subject, 2);
    for (const attemptedAt of ["2026-08-24T12:08:00.000Z", "2026-08-24T12:09:00.000Z"]) {
      ledger = recordDraftRepairAttempt(ledger, {
        attemptedAt,
        intentFingerprint,
        fromSetupFingerprint: setupArtifactFingerprint(subject),
        toSetupFingerprint: setupArtifactFingerprint(subject),
        reasonCode: "workspace_entity_drift",
        result: "applied",
      });
      ledger = markRepairPassedToVerification(ledger);
      if (ledger.attempts.length < 2) {
        ledger = resumeDraftRepairAfterFailure(ledger);
      }
    }

    expect(ledger.status).toBe("passed_to_verification");
    expect(resumeDraftRepairAfterFailure(ledger).status).toBe("exhausted");
  });

  it("rejects an attempt beyond the configured limit before another status transition", () => {
    const subject = operation();
    const intentFingerprint = trackingIntentFingerprint(subject);
    let ledger = createDraftRepairLedger(subject, 1);
    ledger = recordDraftRepairAttempt(ledger, {
      attemptedAt: "2026-08-24T12:08:00.000Z",
      intentFingerprint,
      fromSetupFingerprint: setupArtifactFingerprint(subject),
      toSetupFingerprint: setupArtifactFingerprint(subject),
      reasonCode: "workspace_entity_drift",
      result: "applied",
    });

    expect(() => recordDraftRepairAttempt(ledger, {
      attemptedAt: "2026-08-24T12:09:00.000Z",
      intentFingerprint,
      fromSetupFingerprint: setupArtifactFingerprint(subject),
      toSetupFingerprint: setupArtifactFingerprint(subject),
      reasonCode: "workspace_entity_drift",
      result: "applied",
    })).toThrow("exhausted its attempt limit");
  });

  it("rejects a repair that widens or changes the confirmed intent", () => {
    const ledger = createDraftRepairLedger(operation());
    expect(() => recordDraftRepairAttempt(ledger, {
      attemptedAt: "2026-08-24T12:08:00.000Z",
      intentFingerprint: "intent_changed",
      fromSetupFingerprint: "setup_1",
      toSetupFingerprint: "setup_2",
      reasonCode: "change_outcome",
      result: "applied",
    })).toThrow("cannot change the confirmed tracking intent");
  });
});
