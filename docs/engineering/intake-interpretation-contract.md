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

## Deliberate boundary

The repository still has no real provider adapter, model SDK, prompt, credential,
shadow-record repository, API route, visible UI behavior, or GTM action. The next safe
slice is the first offline comparison using two or three explicitly authorized,
backend-configured adapters and this evaluator; it must not change the practitioner
workflow.
