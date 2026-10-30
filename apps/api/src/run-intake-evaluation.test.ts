import {
  assertIntakeAcceptanceCorpus,
  type IntakeAcceptanceCorpusV1,
  type IntakeInterpretationInputV1,
} from "@trimtale/core";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { IntakeProviderFetch } from "./openai-intake-provider.js";
import {
  runIntakeEvaluationCommand,
  validateIntakeEvaluationCommandConfig,
  type IntakeEvaluationCommandConfigV1,
} from "./run-intake-evaluation.js";

const API_KEY = "sk-test-command-secret-that-must-never-leak";

function loadCorpus(): IntakeAcceptanceCorpusV1 {
  const value: unknown = JSON.parse(readFileSync(
    resolve(process.cwd(), "tests/acceptance/intake-interpretation.json"),
    "utf8",
  ));
  assertIntakeAcceptanceCorpus(value);
  return value;
}

function validConfig(): IntakeEvaluationCommandConfigV1 {
  return {
    schemaVersion: 1,
    reportPath: ".data/intake-evaluations.json",
    timeoutMs: 5_000,
    maxOutputTokens: 800,
    providers: [
      {
        id: "openai-model-a",
        model: "model-a-2026-08-23",
        inputCostPerMillionTokensUsd: 2.5,
        outputCostPerMillionTokensUsd: 10,
      },
      {
        id: "openai-model-b",
        model: "model-b-2026-08-23",
        inputCostPerMillionTokensUsd: 1,
        outputCostPerMillionTokensUsd: 4,
      },
    ],
  };
}

async function createWorkspace(config: unknown = validConfig()) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "gtm-observability-intake-command-"));
  const corpus = loadCorpus();
  const corpusPath = join(workspaceRoot, "tests/acceptance/intake-interpretation.json");
  const configPath = join(workspaceRoot, "config/intake-evaluation.json");
  await mkdir(dirname(corpusPath), { recursive: true });
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(corpusPath, `${JSON.stringify(corpus)}\n`, "utf8");
  await writeFile(configPath, `${JSON.stringify(config)}\n`, "utf8");
  return { workspaceRoot, corpus, configPath: "config/intake-evaluation.json" };
}

function successfulFetch(corpus: IntakeAcceptanceCorpusV1): IntakeProviderFetch {
  const byInput = new Map(corpus.cases.map((item) => [JSON.stringify(item.input), item.expected]));
  return vi.fn<IntakeProviderFetch>(async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { input?: unknown };
    const expected = byInput.get(String(request.input));
    if (!expected) throw new Error(`unexpected model input ${API_KEY}`);
    return new Response(JSON.stringify({
      status: "completed",
      output: [{
        type: "message",
        status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(expected) }],
      }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }), { status: 200 });
  });
}

describe("owner-operated intake evaluation command", () => {
  it("validates a credential-free two-or-three-model configuration", () => {
    expect(validateIntakeEvaluationCommandConfig(validConfig())).toEqual([]);
    expect(validateIntakeEvaluationCommandConfig({
      ...validConfig(),
      providers: [...validConfig().providers, {
        id: "openai-model-c",
        model: "model-c-2026-08-23",
        inputCostPerMillionTokensUsd: 3,
        outputCostPerMillionTokensUsd: 12,
      }],
    })).toEqual([]);
  });

  it.each([
    ["not an object", null],
    ["unsupported schema", { ...validConfig(), schemaVersion: 2 }],
    ["unexpected credential", { ...validConfig(), apiKey: API_KEY }],
    ["unsafe report path", { ...validConfig(), reportPath: "../outside.json" }],
    ["absolute report path", { ...validConfig(), reportPath: "/tmp/outside.json" }],
    ["tracked report path", { ...validConfig(), reportPath: "package.json" }],
    ["invalid timeout", { ...validConfig(), timeoutMs: 0 }],
    ["invalid output budget", { ...validConfig(), maxOutputTokens: 100_000 }],
    ["one provider", { ...validConfig(), providers: validConfig().providers.slice(0, 1) }],
    ["four providers", { ...validConfig(), providers: [
      ...validConfig().providers,
      { ...validConfig().providers[0]!, id: "openai-model-c" },
      { ...validConfig().providers[0]!, id: "openai-model-d" },
    ] }],
    ["duplicate providers", { ...validConfig(), providers: [
      validConfig().providers[0],
      { ...validConfig().providers[1]!, id: "openai-model-a" },
    ] }],
    ["unsafe model", { ...validConfig(), providers: [
      { ...validConfig().providers[0]!, model: "unsafe model" },
      validConfig().providers[1],
    ] }],
    ["invalid cost", { ...validConfig(), providers: [
      { ...validConfig().providers[0]!, outputCostPerMillionTokensUsd: -1 },
      validConfig().providers[1],
    ] }],
    ["zero cost", { ...validConfig(), providers: [
      { ...validConfig().providers[0]!, outputCostPerMillionTokensUsd: 0 },
      validConfig().providers[1],
    ] }],
    ["credential in provider", { ...validConfig(), providers: [
      { ...validConfig().providers[0]!, apiKey: API_KEY },
      validConfig().providers[1],
    ] }],
  ])("rejects %s", (_name, config) => {
    expect(validateIntakeEvaluationCommandConfig(config).length).toBeGreaterThan(0);
  });

  it("fails command preflight before requests or report writes", async () => {
    const cases: Array<{ config: unknown; environment: NodeJS.ProcessEnv }> = [
      { config: validConfig(), environment: { INTAKE_EVALUATION_CONFIG: "config/intake-evaluation.json" } },
      { config: validConfig(), environment: { OPENAI_API_KEY: API_KEY } },
      { config: validConfig(), environment: {
        OPENAI_API_KEY: API_KEY,
        INTAKE_EVALUATION_CONFIG: "../outside.json",
      } },
      { config: { ...validConfig(), providers: validConfig().providers.slice(0, 1) }, environment: {
        OPENAI_API_KEY: API_KEY,
        INTAKE_EVALUATION_CONFIG: "config/intake-evaluation.json",
      } },
    ];

    for (const item of cases) {
      const { workspaceRoot } = await createWorkspace(item.config);
      const fetchImpl = vi.fn<IntakeProviderFetch>();
      try {
        await expect(runIntakeEvaluationCommand({
          workspaceRoot,
          environment: item.environment,
          fetchImpl,
          writeOutput: vi.fn(),
        })).rejects.toThrow();
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(existsSync(join(workspaceRoot, ".data/intake-evaluations.json"))).toBe(false);
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    }
  });

  it("runs two models over the complete corpus and emits only a privacy-safe summary", async () => {
    const { workspaceRoot, corpus, configPath } = await createWorkspace();
    const fetchImpl = successfulFetch(corpus);
    const output: string[] = [];
    try {
      const report = await runIntakeEvaluationCommand({
        workspaceRoot,
        environment: { OPENAI_API_KEY: API_KEY, INTAKE_EVALUATION_CONFIG: configPath },
        fetchImpl,
        writeOutput: (message) => output.push(message),
        createReportId: () => "intake_report_command_1",
      });

      expect(fetchImpl).toHaveBeenCalledTimes(corpus.cases.length * 2);
      expect(report).toMatchObject({
        id: "intake_report_command_1",
        corpusCaseCount: corpus.cases.length,
        providers: [
          { providerId: "openai-model-a", outcomes: { pass: 14, fail: 0, hardFailure: 0, inconclusive: 0 } },
          { providerId: "openai-model-b", outcomes: { pass: 14, fail: 0, hardFailure: 0, inconclusive: 0 } },
        ],
      });
      const filePath = join(workspaceRoot, ".data/intake-evaluations.json");
      expect(statSync(filePath).mode & 0o777).toBe(0o600);
      const persisted = readFileSync(filePath, "utf8");
      const visible = `${output.join("\n")}\n${persisted}`;
      expect(output).toHaveLength(1);
      expect(output[0]).toContain("intake_report_command_1");
      expect(visible).not.toContain(API_KEY);
      expect(visible).not.toContain("authorization");
      expect(visible).not.toContain("providerInterpretation");
      expect(visible).not.toContain("deterministicBaseline");
      for (const item of corpus.cases) {
        for (const message of item.input.messages) expect(visible).not.toContain(message);
        for (const candidate of item.input.pageCandidates) expect(visible).not.toContain(candidate.label);
        for (const candidate of item.input.successEvidenceCandidates) expect(visible).not.toContain(candidate.label);
        for (const sentinel of item.privateSentinels) expect(visible).not.toContain(sentinel);
      }

      const calledModels = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls.map(([, init]) => (
        JSON.parse(String(init?.body)) as { model: string }
      ).model);
      expect(new Set(calledModels)).toEqual(new Set(["model-a-2026-08-23", "model-b-2026-08-23"]));
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked report path before requests or outside writes", async () => {
    const { workspaceRoot, corpus, configPath } = await createWorkspace();
    const outside = await mkdtemp(join(tmpdir(), "gtm-observability-intake-outside-"));
    const fetchImpl = successfulFetch(corpus);
    try {
      await symlink(outside, join(workspaceRoot, ".data"));
      await expect(runIntakeEvaluationCommand({
        workspaceRoot,
        environment: { OPENAI_API_KEY: API_KEY, INTAKE_EVALUATION_CONFIG: configPath },
        fetchImpl,
        writeOutput: vi.fn(),
      })).rejects.toThrow(/symbolic link/i);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(existsSync(join(outside, "intake-evaluations.json"))).toBe(false);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("does not accept unvalidated model-facing input through the adapter", async () => {
    const fetchImpl = vi.fn<IntakeProviderFetch>();
    const { OpenAIIntakeProvider } = await import("./openai-intake-provider.js");
    const adapter = new OpenAIIntakeProvider({
      ...validConfig().providers[0]!,
      apiKey: API_KEY,
      maxOutputTokens: validConfig().maxOutputTokens,
    }, fetchImpl);
    const unsafe = { schemaVersion: 1, messages: ["safe"], cookies: "private" };

    await expect(adapter.interpret(unsafe as unknown as IntakeInterpretationInputV1, {
      signal: new AbortController().signal,
    })).rejects.toThrow(/input/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
