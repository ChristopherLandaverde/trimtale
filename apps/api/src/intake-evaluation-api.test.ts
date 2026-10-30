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
  intakeEvaluationApiResponse,
  type IntakeEvaluationApiResponse,
} from "./intake-evaluation-api.js";
import {
  IntakeEvaluationReportRepository,
  IntakeEvaluationRunner,
  type IntakeEvaluationReportV1,
} from "./intake-evaluations.js";

function loadCorpus(): IntakeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/intake-interpretation.json"),
    "utf8",
  ));
  assertIntakeAcceptanceCorpus(value);
  return value;
}

function perfectProvider(corpus: IntakeAcceptanceCorpusV1, id: string): IntakeShadowProvider {
  const cases = new Map(corpus.cases.map((item) => [JSON.stringify(item.input), item]));
  return {
    id,
    async interpret(input) {
      const item = cases.get(JSON.stringify(input));
      if (!item) throw new Error("private fixture error");
      return {
        interpretation: structuredClone(item.expected),
        usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
      };
    },
  };
}

async function createReport(
  filePath: string,
  corpus: IntakeAcceptanceCorpusV1,
  id: string,
  createdAt: string,
): Promise<IntakeEvaluationReportV1> {
  let shadowSequence = 0;
  return await new IntakeEvaluationRunner([
    perfectProvider(corpus, "openai-model-a"),
    perfectProvider(corpus, "openai-model-b"),
  ], new IntakeEvaluationReportRepository(filePath), {
    now: () => Date.parse(createdAt),
    createReportId: () => id,
    createShadowRunId: () => `shadow_api_${++shadowSequence}`,
  }).run(corpus);
}

function expectGenericUnavailable(response: IntakeEvaluationApiResponse | undefined): void {
  expect(response).toEqual({
    status: 503,
    body: { error: "Intake evaluation reports are unavailable." },
  });
}

describe("read-only intake evaluation report API", () => {
  it("returns an empty versioned list without creating a report file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-api-"));
    const filePath = join(directory, "missing-reports.json");
    try {
      expect(intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath)).toEqual({
        status: 200,
        body: { schemaVersion: 1, reports: [] },
      });
      expect(existsSync(filePath)).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns newest-first aggregate summaries and a complete safe detail", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-api-"));
    const filePath = join(directory, "reports.json");
    const corpus = loadCorpus();
    try {
      const older = await createReport(filePath, corpus, "intake_report_older", "2026-08-23T14:00:00.000Z");
      const newer = await createReport(filePath, corpus, "intake_report_newer", "2026-08-23T15:00:00.000Z");
      const modifiedBefore = statSync(filePath).mtimeMs;

      const list = intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath);
      expect(list).toEqual({
        status: 200,
        body: {
          schemaVersion: 1,
          reports: [newer, older].map((report) => ({
            schemaVersion: 1,
            id: report.id,
            createdAt: report.createdAt,
            corpusSchemaVersion: 1,
            corpusCaseCount: corpus.cases.length,
            providers: report.providers.map(({ cases: _cases, ...provider }) => provider),
          })),
        },
      });
      expect(JSON.stringify(list)).not.toContain('"cases"');

      const detail = intakeEvaluationApiResponse(
        "GET",
        "/api/intake-evaluations/intake_report_newer",
        filePath,
      );
      expect(detail).toEqual({ status: 200, body: { schemaVersion: 1, report: newer } });
      expect(JSON.stringify(detail)).toContain('"outcome":"pass"');
      expect(statSync(filePath).mtimeMs).toBe(modifiedBefore);

      const visible = `${JSON.stringify(list)}\n${JSON.stringify(detail)}`;
      expect(visible).not.toContain("providerInterpretation");
      expect(visible).not.toContain("deterministicBaseline");
      expect(visible).not.toContain("authorization");
      expect(visible).not.toContain("private fixture error");
      for (const item of corpus.cases) {
        for (const message of item.input.messages) expect(visible).not.toContain(message);
        for (const candidate of item.input.pageCandidates) expect(visible).not.toContain(candidate.label);
        for (const candidate of item.input.successEvidenceCandidates) expect(visible).not.toContain(candidate.label);
        for (const sentinel of item.privateSentinels) expect(visible).not.toContain(sentinel);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reopens the collection on each request so a later owner report appears", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-api-"));
    const filePath = join(directory, "reports.json");
    const corpus = loadCorpus();
    try {
      expect(intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath))
        .toMatchObject({ body: { reports: [] } });
      await createReport(filePath, corpus, "intake_report_after_start", "2026-08-23T16:00:00.000Z");
      expect(intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath))
        .toMatchObject({ body: { reports: [{ id: "intake_report_after_start" }] } });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns explicit method and not-found responses without modifying storage", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-api-"));
    const filePath = join(directory, "reports.json");
    try {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(intakeEvaluationApiResponse(method, "/api/intake-evaluations", filePath)).toEqual({
          status: 405,
          body: { error: "Intake evaluation reports are read-only." },
        });
        expect(intakeEvaluationApiResponse(method, "/api/intake-evaluations/intake_report_1", filePath))
          .toEqual({ status: 405, body: { error: "Intake evaluation reports are read-only." } });
      }
      expect(intakeEvaluationApiResponse("GET", "/api/intake-evaluations/unknown-report", filePath))
        .toEqual({ status: 404, body: { error: "Intake evaluation report was not found." } });
      expect(intakeEvaluationApiResponse("GET", "/api/intake-evaluations/unsafe%2Fid", filePath)).toBeUndefined();
      expect(intakeEvaluationApiResponse("GET", "/api/intake-evaluations/", filePath)).toBeUndefined();
      expect(intakeEvaluationApiResponse("GET", "/api/other", filePath)).toBeUndefined();
      expect(existsSync(filePath)).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed with one generic response for corrupted or invalid collections", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gtm-observability-intake-api-"));
    const filePath = join(directory, "reports.json");
    const corpus = loadCorpus();
    try {
      await writeFile(filePath, "private-corrupt-detail {", "utf8");
      expectGenericUnavailable(intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath));

      await writeFile(filePath, JSON.stringify({ schemaVersion: 99, reports: [] }), "utf8");
      expectGenericUnavailable(intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath));

      await writeFile(filePath, JSON.stringify({ schemaVersion: 1, reports: [{ schemaVersion: 99 }] }), "utf8");
      expectGenericUnavailable(intakeEvaluationApiResponse("GET", "/api/intake-evaluations", filePath));

      await rm(filePath, { force: true });
      const report = await createReport(filePath, corpus, "intake_report_duplicate", "2026-08-23T16:00:00.000Z");
      await writeFile(filePath, JSON.stringify({ schemaVersion: 1, reports: [report, report] }), "utf8");
      const response = intakeEvaluationApiResponse(
        "GET",
        "/api/intake-evaluations/intake_report_duplicate",
        filePath,
      );
      expectGenericUnavailable(response);
      expect(JSON.stringify(response)).not.toMatch(/private-corrupt-detail|duplicate|schemaVersion must/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
