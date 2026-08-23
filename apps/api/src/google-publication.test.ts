import {
  approveTrackingVersion,
  createSetupProposal,
  createTrackingChangePlan,
  type TrackingSetupOperationV1,
} from "@gtm-observability/core";
import { describe, expect, it, vi } from "vitest";
import { GtmDiscoveryClient } from "./google.js";

const now = Date.parse("2026-08-22T12:20:00.000Z");

function approved(): TrackingSetupOperationV1 {
  const proposal = createSetupProposal({
    intent: "Track navigation clicks", pageUrl: "https://example.test/", measurementId: "G-TEST123456",
    container: { accountId: "1", containerId: "10", publicId: "GTM-ABC123", name: "Lead site" },
    navigation: [{ id: "pricing", text: "Pricing", href: "https://example.test/pricing", area: "nav", selector: "nav a[href='/pricing']" }],
  });
  const plan = createTrackingChangePlan(proposal.containerFile, {});
  return approveTrackingVersion({
    schemaVersion: 1, id: "operation_navigation", status: "versioned",
    createdAt: "2026-08-22T12:00:00.000Z", updatedAt: "2026-08-22T12:10:00.000Z",
    specification: proposal.specification, generatedSetup: proposal.containerFile,
    container: { publicId: "GTM-ABC123", path: "accounts/1/containers/10" },
    workspace: { path: "accounts/1/containers/10/workspaces/2", fingerprint: "workspace-final" },
    plan, completedActionSignatures: plan.actions.map(({ entitySignature }) => entitySignature),
    validation: { status: "passed", checkedAt: "2026-08-22T12:09:00.000Z", workspaceFingerprint: "workspace-final", errors: [] },
    version: {
      path: "accounts/1/containers/10/versions/8", fingerprint: "version-8",
      priorLiveVersionPath: "accounts/1/containers/10/versions/7", priorLiveVersionFingerprint: "live-7",
    },
  }, "practitioner@example.test", "2026-08-22T12:15:00.000Z");
}

function publicationFetch(options: {
  liveFingerprint?: string;
  versionFingerprint?: string;
  publishFailure?: boolean;
} = {}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input.toString());
    if (url.pathname.endsWith("/accounts")) return Response.json({ account: [{ accountId: "1", path: "accounts/1", name: "Agency" }] });
    if (url.pathname.endsWith("/accounts/1/containers")) return Response.json({ container: [{
      accountId: "1", containerId: "10", name: "Lead", path: "accounts/1/containers/10", publicId: "GTM-ABC123", usageContext: ["WEB"],
    }] });
    if (url.pathname.endsWith("/workspaces")) return Response.json({ workspace: [] });
    if (url.pathname.endsWith("/versions:live")) return Response.json({
      path: "accounts/1/containers/10/versions/live", fingerprint: options.liveFingerprint ?? "live-7",
    });
    if (url.pathname.endsWith("/versions/8") && !init?.method) return Response.json({ path: "accounts/1/containers/10/versions/8", fingerprint: options.versionFingerprint ?? "version-8" });
    if (url.pathname.endsWith("/versions/7") && !init?.method) return Response.json({ path: "accounts/1/containers/10/versions/7", fingerprint: "live-7" });
    if (url.pathname.endsWith(":publish") && init?.method === "POST") {
      if (options.publishFailure) return Response.json({ error: "publication failed" }, { status: 500 });
      const fingerprint = url.searchParams.get("fingerprint");
      return Response.json({ compilerError: false, containerVersion: { fingerprint } });
    }
    return Response.json({ accountId: "1", containerId: "10", path: "accounts/1/containers/10", publicId: "GTM-ABC123", name: "Lead", usageContext: ["WEB"] });
  });
}

describe("approved publication and rollback", () => {
  it("publishes only the approved fingerprint while the prior live version is current", async () => {
    const fetcher = publicationFetch();
    const result = await new GtmDiscoveryClient(async () => "token", fetcher, true, true, () => now)
      .publishApprovedVersion(approved());
    expect(result).toEqual({ publishedAt: "2026-08-22T12:20:00.000Z", versionFingerprint: "version-8" });
    const publish = fetcher.mock.calls.find(([input]) => input.toString().includes(":publish"));
    expect(publish?.[0].toString()).toContain("/versions/8:publish?fingerprint=version-8");
  });

  it.each([
    ["expired approval", () => new GtmDiscoveryClient(async () => "token", publicationFetch(), true, true, () => Date.parse("2026-08-22T13:00:00.000Z")), approved],
    ["live drift", () => new GtmDiscoveryClient(async () => "token", publicationFetch({ liveFingerprint: "live-9" }), true, true, () => now), approved],
    ["wrong version", () => new GtmDiscoveryClient(async () => "token", publicationFetch({ versionFingerprint: "changed" }), true, true, () => now), approved],
  ] as const)("refuses %s", async (_name, client, operation) => {
    await expect(client().publishApprovedVersion(operation())).rejects.toMatchObject({ status: 409 });
  });

  it("requires separate backend publication enablement and surfaces publication failure", async () => {
    const disabled = publicationFetch();
    await expect(new GtmDiscoveryClient(async () => "token", disabled, true, false, () => now)
      .publishApprovedVersion(approved())).rejects.toMatchObject({ status: 403 });
    expect(disabled).not.toHaveBeenCalled();
    await expect(new GtmDiscoveryClient(async () => "token", publicationFetch({ publishFailure: true }), true, true, () => now)
      .publishApprovedVersion(approved())).rejects.toThrow("publication failed");
  });

  it("rolls back only from the failed published fingerprint to the recorded prior live fingerprint", async () => {
    const operation = approved();
    operation.status = "rollback_required";
    operation.publication = { publishedAt: "2026-08-22T12:20:00.000Z", versionFingerprint: "version-8" };
    operation.postPublicationEvidenceId = "run_failed";
    operation.rollback = { targetVersionFingerprint: "live-7", status: "required" };
    const fetcher = publicationFetch({ liveFingerprint: "version-8" });
    const result = await new GtmDiscoveryClient(async () => "token", fetcher, true, true, () => now)
      .rollbackPublishedVersion(operation);
    expect(result).toEqual({ targetVersionFingerprint: "live-7", status: "completed", completedAt: "2026-08-22T12:20:00.000Z" });
    expect(fetcher.mock.calls.find(([input]) => input.toString().includes(":publish"))?.[0].toString())
      .toContain("/versions/7:publish?fingerprint=live-7");
  });
});
