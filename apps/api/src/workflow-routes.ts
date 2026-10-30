import { assertTrackingRunEvidence, type TrackingRunEvidenceV1 } from "@trimtale/core";
import { GoogleIntegrationError } from "./google.js";
import { type TrackingWorkflowRequest, type TrackingWorkflowRunner } from "./workflow-runner.js";
import type { IncomingMessage, ServerResponse } from "node:http";

type SendJson = (response: ServerResponse, status: number, value: unknown) => void;
type ReadJson = (request: IncomingMessage) => Promise<unknown>;

interface WorkflowRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  requestUrl: URL;
  workflowRunner: TrackingWorkflowRunner | undefined;
  /** False unless the backend explicitly enables GTM publication. Approval and publish fail closed. */
  publicationEnabled?: boolean;
  /** The signed-in Google account's verified email, read server-side from the OAuth session. */
  approverIdentity?: () => Promise<string>;
  readJson: ReadJson;
  sendJson: SendJson;
}

function workflowUnavailable(sendJson: SendJson, response: ServerResponse): void {
  sendJson(response, 503, { error: "Google OAuth is not configured on this backend." });
}

function objectField(body: unknown, field: string): unknown {
  return typeof body === "object" && body !== null && field in body
    ? (body as Record<string, unknown>)[field]
    : undefined;
}

export async function handleGoogleWorkflowRoute({
  request,
  response,
  requestUrl,
  workflowRunner,
  publicationEnabled = false,
  approverIdentity,
  readJson,
  sendJson,
}: WorkflowRouteContext): Promise<boolean> {
  if (request.method === "POST" && requestUrl.pathname === "/api/google/workflows/plan") {
    if (!workflowRunner) {
      workflowUnavailable(sendJson, response);
      return true;
    }
    try {
      const result = await workflowRunner.plan((await readJson(request)) as TrackingWorkflowRequest);
      sendJson(response, result.status === "planned" ? 201 : result.status === "blocked" ? 409 : 200, { result });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof SyntaxError
          ? 400
          : 400;
      const message = workflowError instanceof Error
        ? workflowError.message
        : "Unable to plan the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return true;
  }

  const workflowMatch = requestUrl.pathname.match(/^\/api\/google\/workflows\/([A-Za-z0-9_-]+)$/);
  if (request.method === "GET" && workflowMatch) {
    if (!workflowRunner) {
      workflowUnavailable(sendJson, response);
      return true;
    }
    const operation = workflowRunner.get(workflowMatch[1] ?? "");
    sendJson(response, operation ? 200 : 404, operation ? { operation } : { error: "Tracking operation was not found." });
    return true;
  }

  const resumeMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/resume$/,
  );
  if (request.method === "POST" && resumeMatch) {
    if (!workflowRunner) {
      workflowUnavailable(sendJson, response);
      return true;
    }
    try {
      sendJson(response, 200, { result: await workflowRunner.resume(resumeMatch[1] ?? "") });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : 409;
      const message = workflowError instanceof Error
        ? workflowError.message
        : "Unable to resume the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return true;
  }

  const approveMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/approve$/,
  );
  const publishMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/publish$/,
  );
  if (request.method === "POST" && (approveMatch || publishMatch)) {
    if (!workflowRunner || !approverIdentity) {
      workflowUnavailable(sendJson, response);
      return true;
    }
    if (!publicationEnabled) {
      sendJson(response, 403, { error: "GTM publication is disabled on this backend." });
      return true;
    }
    try {
      const body = await readJson(request);
      const versionFingerprint = objectField(body, "versionFingerprint");
      const confirmation = objectField(body, "confirmation");
      if (typeof versionFingerprint !== "string" || !versionFingerprint.trim()
        || (approveMatch && typeof confirmation !== "string")) {
        sendJson(response, 400, {
          error: approveMatch
            ? "Publication approval requires a version fingerprint and the typed container confirmation."
            : "Publication requires the approved version fingerprint.",
        });
        return true;
      }
      // Any approver the client sends is ignored: the approver is whoever Google says
      // holds this backend's session right now.
      const account = await approverIdentity();
      const result = approveMatch
        ? workflowRunner.approvePublication(approveMatch[1] ?? "", versionFingerprint, confirmation as string, account)
        : await workflowRunner.publishApproved(publishMatch![1] ?? "", versionFingerprint, account);
      sendJson(response, result.status === "blocked" ? 409 : 200, { result });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : workflowError instanceof SyntaxError
            ? 400
            : 409;
      const message = workflowError instanceof Error
        ? workflowError.message
        : "Unable to approve or publish the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return true;
  }

  const browserVerificationMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/browser-verification$/,
  );
  if (request.method === "POST" && browserVerificationMatch) {
    if (!workflowRunner) {
      workflowUnavailable(sendJson, response);
      return true;
    }
    try {
      const body = await readJson(request);
      const evidence = objectField(body, "evidence");
      assertTrackingRunEvidence(evidence);
      const result = await workflowRunner.recordBrowserVerification(
        browserVerificationMatch[1] ?? "",
        evidence as TrackingRunEvidenceV1,
      );
      sendJson(response, 200, { result });
    } catch (workflowError) {
      const status = workflowError instanceof Error && workflowError.message.includes("not found")
        ? 404
        : workflowError instanceof SyntaxError
          ? 400
          : 409;
      const message = status === 404
        ? "Tracking operation was not found."
        : status === 400
          ? "Browser verification evidence must be valid JSON."
          : "Unable to record browser verification for the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return true;
  }

  const rollbackMatch = requestUrl.pathname.match(
    /^\/api\/google\/workflows\/([A-Za-z0-9_-]+)\/rollback$/,
  );
  if (request.method === "POST" && rollbackMatch) {
    if (!workflowRunner) {
      workflowUnavailable(sendJson, response);
      return true;
    }
    try {
      const body = await readJson(request);
      const targetVersionFingerprint = objectField(body, "targetVersionFingerprint");
      const approvedBy = objectField(body, "approvedBy");
      if (typeof targetVersionFingerprint !== "string" || typeof approvedBy !== "string" || approvedBy.trim().length === 0) {
        sendJson(response, 400, { error: "Rollback approval requires a target version fingerprint and approver." });
        return true;
      }
      const result = await workflowRunner.approveAndRollback(rollbackMatch[1] ?? "", targetVersionFingerprint);
      sendJson(response, result.status === "blocked" ? 409 : 200, { result });
    } catch (workflowError) {
      const status = workflowError instanceof GoogleIntegrationError
        ? workflowError.status
        : workflowError instanceof Error && workflowError.message.includes("not found")
          ? 404
          : workflowError instanceof SyntaxError
            ? 400
            : 409;
      const message = status === 404
        ? "Tracking operation was not found."
        : status === 400
          ? "Rollback approval must be valid JSON."
          : status === 403
            ? "GTM publication is disabled for this backend."
            : "Unable to roll back the tracking workflow.";
      sendJson(response, status, { error: message });
    }
    return true;
  }

  return false;
}
