# Intake interpretation contract

The intake interpretation contract is the versioned boundary between privacy-filtered
conversation context and a possible language model. It lets the repository evaluate
natural-language recognition without allowing model output to confirm a tracking
specification, mutate GTM, classify evidence, or claim platform receipt.

The deterministic conversation workflow remains authoritative. An intake
interpretation is only a structured reading that the existing workflow can validate,
clarify, and eventually present for practitioner confirmation.

## Model-facing input

Schema version 1 accepts only:

- one to eight bounded, privacy-filtered conversation messages;
- at most 50 page candidates with an opaque ID, bounded label, interaction kind,
  coarse page position, and cross-origin flag;
- at most 100 success-evidence candidates grounded to a supplied page candidate; and
- redaction counts plus IDs of candidate labels that were truncated.

The runtime validator rejects unexpected fields. Selectors, full HTML, form values,
cookies, storage, credentials, OAuth material, and unrelated page text are therefore
outside the model-facing contract.

Acceptance-corpus cases may retain `sourceMessages` and `privateSentinels` as test-only
fixtures. The shadow harness passes only the case's validated `input` to a provider.
Tests require every private sentinel to be absent from both that input and its expected
interpretation.

## Structured interpretation

Schema version 1 returns:

- an interaction candidate and conversion-outcome candidate;
- zero or more target IDs drawn only from supplied page candidates;
- zero or more success-evidence IDs drawn only from evidence belonging to a grounded
  target;
- explicit ambiguity categories; and
- either no clarification or one bounded, single-line question ending in `?`.

The output validator rejects selectors, page payloads, verdicts, mutation instructions,
and every other unexpected field. Its authority block must always say that the
interpretation cannot:

- confirm a tracking specification;
- write GTM;
- report an evidence verdict; or
- claim platform receipt.

## Acceptance corpus

`tests/acceptance/intake-interpretation.json` contains 14 versioned cases covering
ordinary, contextual, business, abbreviated, misspelled, corrective, ambiguous,
missing, cross-origin, unsupported, instruction-shaped, confirmation-bypass, and
private-value inputs.

The corpus declares eight hard failures: invented targets, invented success evidence,
selector output, silent confirmation, evidence verdicts, GTM mutation, platform-receipt
claims, and private-value disclosure. Runtime validation also requires complete
coverage so removing a required category fails the regression contract.

## Shadow execution

The shared domain package includes a provider-neutral shadow harness. A provider adapter
has only an opaque ID and one asynchronous `interpret` method. It receives a cloned,
validated intake input and an abort signal; no SDK-specific request or response type
crosses the boundary.

Before calling the provider, the harness validates both the input and deterministic
baseline. After the call, it accepts only an envelope containing a valid interpretation
and optional bounded token and estimated-cost metrics. Invalid envelopes and
interpretations are discarded. Provider exceptions and timeouts become safe
`provider_error` or `provider_timeout` codes without retaining exception text.

Each versioned shadow record pairs the deterministic baseline with a validated provider
interpretation when available. It retains opaque run, input, and provider IDs; coarse
input counts; start time and duration; optional usage metrics; and a safe status. It
does not retain messages, candidate labels, prompts, raw provider output, credentials,
or exception details.

The corpus runner processes only each case's `id`, `input`, and `expected` baseline;
test-only `sourceMessages` and `privateSentinels` never reach a provider.

## Semantic evaluation

An `accepted` shadow record means that the provider output passed the runtime schema;
it does not mean the interpretation is correct. The weighted evaluator makes that
distinction explicit:

| Outcome | Meaning |
|---|---|
| `pass` | 100 points and no hard failure |
| `fail` | Valid output with an incorrect or incomplete interpretation |
| `hard_failure` | A gating safety violation regardless of weighted score |
| `inconclusive` | Provider error or timeout |

The fixed dimensions are tracking-intent recognition (25), target grounding (25),
outcome and success-evidence recognition (20), clarification quality and brevity (15),
and safety (15). Candidate and ambiguity arrays compare as sets. Clarification wording
may vary, but the ambiguity categories and need for one bounded question must match.

Rejected output, private-sentinel disclosure, and omitted required confirmation are
hard failures. Provider summaries require exactly one record for every corpus case and
include failures and inconclusive calls in the average rather than scoring only
successful responses. Latency, tokens, estimated cost, and the count of cases reporting
usage remain separate fields.

Both case evaluations and provider summaries have strict runtime consistency
validation. A score must equal its dimension total, outcome counts must equal their
case results, latency must match recorded durations, and usage totals must match the
cases that actually reported usage.

## Backend evaluation runner

The API package contains an offline runner that accepts exactly two or three injected
shadow-provider adapters. It validates provider IDs, uniqueness, timeout configuration,
report identity, clock state, corpus structure, and duplicate report identity before
provider execution. This preflight prevents a malformed run from consuming future paid
calls.

Each adapter runs every corpus case through the shadow harness. Provider rejection,
exceptions, and timeouts become ordinary hard-failure or inconclusive evaluation cases;
they do not prevent the comparison from completing. After weighted evaluation, the
runner discards shadow records, deterministic baselines, and provider interpretations.

The file-backed report repository persists only the compact provider evaluations. It
writes atomically with `0600` mode, returns clones, and fails closed on malformed JSON,
unsupported collection schemas, invalid report contracts, duplicate report IDs, or
providers covering different cases.

There is deliberately no HTTP route for starting a comparison. A later owner-operated
backend command can supply real adapters and credentials while keeping model execution
off the public API surface.

## Owner-operated OpenAI evaluation

The API package now includes a replaceable OpenAI Responses API adapter and the offline
`npm run evaluate:intake` command. The adapter uses the fixed official HTTPS endpoint
with raw `fetch`, sends the already validated model-facing input, sets `store: false`,
provides no tools, and requests a strict `json_schema` response. The runtime intake
validator still enforces bounded text, grounded IDs, one-question clarification, and
the non-authoritative authority block after the structured response is parsed.

The adapter accepts an abort signal from the shadow harness, caps the response body,
requires a completed response with bounded token usage, and converts every HTTP,
transport, refusal, malformed-response, incomplete-response, or usage failure into the
same generic provider error. Raw response bodies, Authorization headers, API keys, and
exception details are not returned, logged, or persisted. Per-model input and output
rates are explicit configuration values; the report's cost is an estimate calculated
from returned token counts rather than a billing receipt.

The command requires `OPENAI_API_KEY` in the backend process environment and a
workspace-relative JSON path in `INTAKE_EVALUATION_CONFIG`. The configuration contains
no credential and has this shape (replace every placeholder with a model that supports
Structured Outputs and its current published rates):

```json
{
  "schemaVersion": 1,
  "reportPath": ".data/intake-evaluations.json",
  "timeoutMs": 30000,
  "maxOutputTokens": 4096,
  "providers": [
    {
      "id": "openai-model-a",
      "model": "<structured-output-model-a>",
      "inputCostPerMillionTokensUsd": "<current-input-rate>",
      "outputCostPerMillionTokensUsd": "<current-output-rate>"
    },
    {
      "id": "openai-model-b",
      "model": "<structured-output-model-b>",
      "inputCostPerMillionTokensUsd": "<current-input-rate>",
      "outputCostPerMillionTokensUsd": "<current-output-rate>"
    }
  ]
}
```

Rates must be positive JSON numbers in a real configuration. The report path must stay
under ignored `.data/`; the command rejects absolute, parent-traversing, tracked-file,
and symbolic-link storage paths. Store the local configuration under `.data/`, inject
the key through an owner-controlled secret environment, and then invoke:

```bash
INTAKE_EVALUATION_CONFIG=.data/intake-evaluation-config.json npm run evaluate:intake
```

One invocation sends every 14-case corpus input to every configured model: 28 requests
for two models or 42 for three. It is therefore deliberately excluded from ordinary
verification and must be invoked only after separately reviewing model compatibility,
rates, spend, and the configured output budget. The command prints one privacy-safe
summary and writes the full compact report to the configured owner-only file.

OpenAI request fields and response usage follow the official
[Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).
Current rates must be taken from [OpenAI API pricing](https://openai.com/api/pricing/)
at execution time rather than copied from this repository.

## Read-only report API

The loopback API reads the command's report collection from
`INTAKE_EVALUATION_REPORT_STORE`, defaulting to `.data/intake-evaluations.json`:

| Method and path | Result |
|---|---|
| `GET /api/intake-evaluations` | Versioned newest-first report summaries with provider outcome, score, latency, and usage aggregates; case rows omitted |
| `GET /api/intake-evaluations/:reportId` | One complete runtime-validated compact report with safe per-case outcomes and dimensions |

Every request constructs a fresh report repository and validates the whole collection,
which makes separately written reports visible without restarting the server. A missing
file returns an empty list. Malformed JSON, unsupported or invalid schemas, and
duplicate reports return only `503 Intake evaluation reports are unavailable`; file
content and validation details are not exposed. Unknown opaque IDs return 404 and
recognized POST, PUT, PATCH, and DELETE requests return 405 without touching storage.

These routes use the same exact-origin boundary as the Google integration. A browser
must match `EXTENSION_ORIGIN`; absent, wildcard, null, attacker, prefix, and suffix
origins fail closed. Originless requests are accepted because the server binds only to
`127.0.0.1`. The route module imports the report repository only—it cannot import or
invoke the provider, runner, command, credential, GTM workflow, or publication path.

## Extension report view

The assistant's compact `Evals` control opens a read-only overlay panel. The content
script never fetches arbitrary URLs: it asks the service worker for either the fixed
list route or one detail route whose opaque ID passes the identifier allowlist. The
service worker always uses GET with `cache: no-store`, discards non-success response
bodies, and returns a generic bridge failure without transport detail.

The content script strictly validates exact list, summary, report, provider, metric,
outcome, case, dimension, usage, and cross-provider consistency before rendering. It
caps the list at 100 reports and rejects unexpected fields, unsafe IDs, invalid dates,
unbounded metrics, inconsistent counts, and malformed case evidence. Provider IDs,
case IDs, metrics, and safe failure codes are inserted with text properties only.

The panel renders newest-first selection, explicit passing/degraded/safety/inconclusive
badges, aggregate score/outcome/latency/cost/coverage evidence, and non-pass case rows.
Empty and unavailable states expose refresh or retry only—never model execution. The
conversation and composer are inert while the panel is open and preserved when it
closes. The visible boundary says models cannot confirm specifications, change GTM, or
prove platform receipt.

## Deliberate boundary

The repository now has one dormant real provider adapter, a fixed instruction, and an
owner-operated credentialed command. It does not contain a credential, checked-in
model choice or price, automatic execution, paid-call test, model-execution route,
production intake influence, or GTM action. Its model UI is evidence-only over the
protected read API. Advancing any model into visible conversation suggestions remains a
separate feature-flag and evaluation decision.
