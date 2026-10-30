import {
  assertIntakeAcceptanceCorpus,
  type IntakeAcceptanceCorpusV1,
  type IntakeShadowProvider,
} from "@trimtale/core";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IntakeEvaluationReportRepository,
  IntakeEvaluationRunner,
  validateIntakeEvaluationReport,
} from "./intake-evaluations.js";

function loadCorpus(): IntakeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/intake-interpretation.json"),
    "utf8",
  ));
  assertIntakeAcceptanceCorpus(value);
  return value;
}

function fixtureProvider(
  corpus: IntakeAcceptanceCorpusV1,
  id: string,
  mode: "perfect" | "mixed",
  onCall?: () => void,
): IntakeShadowProvider {
  const casesByInput = new Map(corpus.cases.map((item) => [JSON.stringify(item.input), item]));
  return {
    id,
    async interpret(input, context) {
      onCall?.();
      const item = casesByInput.get(JSON.stringify(input));
      if (!item) throw new Error("Fixture input is missing.");
      if (mode === "mixed") {
        if (item.id === "ordinary-contact-lead") {
          return {
            interpretation: {
              ...item.expected,
              groundedTargetCandidateIds: [],
              groundedSuccessEvidenceCandidateIds: [],
            },
            usage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 },
          };
        }
        if (item.id === "contextual-bottom-quote-form") {
          return {
            interpretation: { ...item.expected, groundedTargetCandidateIds: ["invented-target"] },
            rawResponse: "raw-private-provider-response",
          };
        }
        if (item.id === "business-wording-booked-demo") {
          throw new Error("provider-private-exception-detail");
        }
        if (item.id === "abbreviated-demo-conversion") {
          context.signal.addEventListener("abort", () => undefined);
          return new Promise(() => undefined);
        }
      }
      return {
        interpretation: structuredClone(item.expected),
        usage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 },
      };
    },
  };
}

function runnerOptions() {
  let runSequence = 0;
  return {
    timeoutMs: 5,
    now: () => Date.parse("2026-08-23T16:00:00.000Z"),
    createReportId: () => "intake_report_1",
    createShadowRunId: () => `shadow_backend_${++runSequence}`,
  };
}

describe("backend intake evaluation runner", () => {
  it("runs two complete providers and atomically persists a privacy-safe report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-evaluations-"));
    const filePath = join(directory, "intake-evaluations.json");
    const corpus = loadCorpus();
    try {
      const repository = new IntakeEvaluationReportRepository(filePath);
      const runner = new IntakeEvaluationRunner([
        fixtureProvider(corpus, "fixture-perfect", "perfect"),
        fixtureProvider(corpus, "fixture-mixed", "mixed"),
      ], repository, runnerOptions());

      const report = await runner.run(corpus);

      expect(validateIntakeEvaluationReport(report)).toEqual([]);
      expect(report).toMatchObject({
        schemaVersion: 1,
        id: "intake_report_1",
        createdAt: "2026-08-23T16:00:00.000Z",
        corpusSchemaVersion: 1,
        corpusCaseCount: 14,
      });
      expect(report.providers).toHaveLength(2);
      expect(report.providers[0]).toMatchObject({
        providerId: "fixture-mixed",
        caseCount: 14,
        outcomes: { pass: 10, fail: 1, hardFailure: 1, inconclusive: 2 },
      });
      expect(report.providers[1]).toMatchObject({
        providerId: "fixture-perfect",
        caseCount: 14,
        outcomes: { pass: 14, fail: 0, hardFailure: 0, inconclusive: 0 },
      });

      expect(statSync(filePath).mode & 0o777).toBe(0o600);
      const persisted = readFileSync(filePath, "utf8");
      expect(persisted).not.toContain(`${process.pid}.tmp`);
      expect(persisted).not.toContain("raw-private-provider-response");
      expect(persisted).not.toContain("provider-private-exception-detail");
      expect(persisted).not.toContain("providerInterpretation");
      expect(persisted).not.toContain("deterministicBaseline");
      for (const item of corpus.cases) {
        for (const message of item.input.messages) expect(persisted).not.toContain(message);
        for (const candidate of item.input.pageCandidates) expect(persisted).not.toContain(candidate.label);
        for (const candidate of item.input.successEvidenceCandidates) expect(persisted).not.toContain(candidate.label);
        for (const sentinel of item.privateSentinels) expect(persisted).not.toContain(sentinel);
      }

      report.providers[0]!.averageScore = 100;
      expect(repository.get("intake_report_1")?.providers[0]?.averageScore).not.toBe(100);
      const reopened = new IntakeEvaluationReportRepository(filePath);
      expect(reopened.list()).toEqual([repository.get("intake_report_1")]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects invalid provider sets before calls or persistence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-evaluations-"));
    const filePath = join(directory, "intake-evaluations.json");
    const corpus = loadCorpus();
    let calls = 0;
    const provider = fixtureProvider(corpus, "fixture-provider", "perfect", () => { calls += 1; });
    try {
      const repository = new IntakeEvaluationReportRepository(filePath);
      expect(() => new IntakeEvaluationRunner([provider], repository)).toThrow(/two or three/i);
      expect(() => new IntakeEvaluationRunner([provider, provider], repository)).toThrow(/unique/i);
      expect(() => new IntakeEvaluationRunner([
        provider,
        fixtureProvider(corpus, "invalid provider id", "perfect"),
      ], repository)).toThrow(/invalid/i);
      expect(() => new IntakeEvaluationRunner([
        provider,
        fixtureProvider(corpus, "provider-2", "perfect"),
      ], repository, { timeoutMs: 0 })).toThrow(/timeout/i);
      expect(() => new IntakeEvaluationRunner([
        provider,
        fixtureProvider(corpus, "provider-2", "perfect"),
        fixtureProvider(corpus, "provider-3", "perfect"),
        fixtureProvider(corpus, "provider-4", "perfect"),
      ], repository)).toThrow(/two or three/i);
      expect(calls).toBe(0);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate report creation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-evaluations-"));
    const filePath = join(directory, "intake-evaluations.json");
    const corpus = loadCorpus();
    try {
      const repository = new IntakeEvaluationReportRepository(filePath);
      const providers = [
        fixtureProvider(corpus, "fixture-perfect", "perfect"),
        fixtureProvider(corpus, "fixture-second", "perfect"),
      ];
      const report = await new IntakeEvaluationRunner(providers, repository, runnerOptions()).run(corpus);
      expect(repository.create(report)).toEqual({ accepted: false, error: "already_exists" });
      let calls = 0;
      const duplicateRunner = new IntakeEvaluationRunner([
        fixtureProvider(corpus, "duplicate-perfect", "perfect", () => { calls += 1; }),
        fixtureProvider(corpus, "duplicate-second", "perfect", () => { calls += 1; }),
      ], repository, runnerOptions());
      await expect(duplicateRunner.run(corpus)).rejects.toThrow(/already exists/i);
      expect(calls).toBe(0);
      expect(repository.list()).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed on corrupted, unsupported, duplicate, and invalid persisted reports", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-evaluations-"));
    const filePath = join(directory, "intake-evaluations.json");
    try {
      await writeFile(filePath, "{", "utf8");
      expect(() => new IntakeEvaluationReportRepository(filePath)).toThrow(/corrupted/i);
      await writeFile(filePath, JSON.stringify({ schemaVersion: 99, reports: [] }), "utf8");
      expect(() => new IntakeEvaluationReportRepository(filePath)).toThrow(/unsupported/i);
      await writeFile(filePath, JSON.stringify({ schemaVersion: 1, reports: [{ schemaVersion: 99 }] }), "utf8");
      expect(() => new IntakeEvaluationReportRepository(filePath)).toThrow(/invalid/i);

      await rm(filePath, { force: true });
      const corpus = loadCorpus();
      const repository = new IntakeEvaluationReportRepository(filePath);
      const report = await new IntakeEvaluationRunner([
        fixtureProvider(corpus, "fixture-perfect", "perfect"),
        fixtureProvider(corpus, "fixture-second", "perfect"),
      ], repository, runnerOptions()).run(corpus);
      const inconsistent = structuredClone(report);
      inconsistent.providers[1]!.cases[0]!.inputId = "unknown-case";
      expect(validateIntakeEvaluationReport(inconsistent))
        .toContain("intake evaluation report providers must cover the same cases");

      await writeFile(filePath, JSON.stringify({ schemaVersion: 1, reports: [report, report] }), "utf8");
      expect(() => new IntakeEvaluationReportRepository(filePath)).toThrow(/duplicate/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
