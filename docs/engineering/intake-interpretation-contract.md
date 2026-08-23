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
fixtures. A future harness must pass only the case's validated `input` to a provider.
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

## Deliberate boundary

This slice makes no provider call and adds no prompt, credential, visible UI behavior,
or GTM action. The next safe slice is a provider-neutral shadow harness that sends only
validated input, validates structured output, and records it beside the deterministic
baseline without changing the practitioner workflow.
