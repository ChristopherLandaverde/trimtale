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

## Deliberate boundary

The repository still has no real provider adapter, model SDK, prompt, credential,
shadow-record repository, API route, visible UI behavior, or GTM action. The next safe
slice is an offline weighted comparison using backend-configured adapters and this
harness; it must not change the practitioner workflow.
