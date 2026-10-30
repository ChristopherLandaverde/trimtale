import {
  LocalRunEvidenceStore,
  determineFormVerdict,
  type ScenarioVerdictCode,
  type TrackingRunEvidenceV1,
} from "@trimtale/core";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VerifiedResolutionRepository } from "./verified-resolutions.js";

interface AcceptanceCase {
  id: string;
  input: Record<string, unknown> & { forbiddenSentinels?: string[] };
  expected: {
    accepted: boolean;
    error?: string;
    persistedForbiddenSentinels?: string[];
    deterministicRulesChanged: boolean;
  };
}

const contract = JSON.parse(readFileSync(
  resolve(process.cwd(), "tests/acceptance/verified-resolution-foundation.json"),
  "utf8",
)) as { cases: AcceptanceCase[] };

function runEvidence(runId: string, code: ScenarioVerdictCode): TrackingRunEvidenceV1 {
  const passed = code === "browser_verified";
  return {
    schemaVersion: 1,
    runId,
    specificationId: "spec_form_contact",
    startedAt: "2026-08-22T12:00:00.000Z",
    observations: {
      interaction: { type: "form_submission", targetId: "contact", attempted: true, submissionResult: "success" },
      outcome: { observed: true, observable: true, evidenceType: "visible_element" },
      dataLayer: { matchingEvents: passed ? [{ event: "generate_lead", form_id: "contact" }] : [] },
      tagFired: passed,
      network: {
        ga4Requests: passed
          ? [{ url: "http://127.0.0.1/g/collect?v=2&tid=G-TEST123456&en=generate_lead&ep.form_id=contact&ep.form_name=contact&ep.page_location=http%3A%2F%2F127.0.0.1%2F", observedAt: "2026-08-22T12:00:00.000Z" }]
          : [],
      },
      consent: { analyticsStorage: "granted" },
    },
    verdict: {
      code,
      browserVerification: passed ? "passed" : "failed",
      platformConfirmation: "unverified",
      nextAction: passed ? "Await platform confirmation." : "Correct the setup and rerun verification.",
    },
  };
}

function evidenceStore(): LocalRunEvidenceStore {
  const store = new LocalRunEvidenceStore();
  store.save(runEvidence("run_before_failed", "outcome_observed_event_missing"));
  store.save(runEvidence("run_before_passed", "browser_verified"));
  store.save(runEvidence("run_after_passed", "browser_verified"));
  store.save(runEvidence("run_after_failed", "tag_fired_request_missing"));
  return store;
}

describe("verified resolution persistence acceptance", () => {
  it.each(contract.cases)("$id", async (acceptance) => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-resolutions-"));
    const filePath = join(directory, "verified-resolutions.json");
    const evidence = evidenceStore();
    const repository = new VerifiedResolutionRepository(filePath, evidence);
    const ruleProbe = runEvidence("run_rule_probe", "browser_verified").observations;
    const rulesBefore = determineFormVerdict(ruleProbe);

    try {
      const result = repository.save(structuredClone(acceptance.input));
      expect(result.accepted).toBe(acceptance.expected.accepted);

      if (acceptance.expected.accepted) {
        if (!result.accepted) throw new Error(`Expected accepted resolution, received ${result.error}.`);
        expect(result.resolution.humanConfirmed).toBe(true);
        expect(result.resolution.beforeEvidenceId).toBe(acceptance.input.beforeEvidenceId);
        expect(result.resolution.afterEvidenceId).toBe(acceptance.input.afterEvidenceId);
        expect(result.resolution.environment).toEqual({
          interactionType: "form_submission",
          submissionResult: "success",
          analyticsStorage: "granted",
        });

        const reopened = new VerifiedResolutionRepository(filePath, evidence);
        expect(reopened.get(result.resolution.id)).toEqual(result.resolution);
        expect(reopened.list()).toEqual([result.resolution]);

        const persisted = readFileSync(filePath, "utf8");
        const foundSentinels = (acceptance.input.forbiddenSentinels ?? []).filter((sentinel) => persisted.includes(sentinel));
        expect(foundSentinels).toEqual(acceptance.expected.persistedForbiddenSentinels ?? []);
      } else {
        if (result.accepted) throw new Error("Expected the resolution to be rejected.");
        expect(result.error).toBe(acceptance.expected.error);
        expect(repository.list()).toEqual([]);
      }

      expect(determineFormVerdict(ruleProbe)).toEqual(rulesBefore);
      expect(acceptance.expected.deterministicRulesChanged).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects an unsupported persisted collection schema", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-resolutions-"));
    const filePath = join(directory, "verified-resolutions.json");
    try {
      await writeFile(filePath, JSON.stringify({ schemaVersion: 99, resolutions: [] }), "utf8");
      expect(() => new VerifiedResolutionRepository(filePath, evidenceStore())).toThrow(
        "Unsupported verified-resolution collection schema.",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
