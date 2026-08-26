# Verified Custom HTML and JavaScript authoring

Delivery mode: implementation
Status: in progress

## Production outcome

The website agent can adapt one authoritative third-party integration into reviewable
Custom HTML or JavaScript, expose its code and data behavior, and pass positive and
negative browser verification before version approval.

## Non-goals

- Inventing undocumented vendor protocols.
- Silent personal-data collection.
- General-purpose arbitrary code execution.
- Publication without the ordinary exact-version approval.

## Authorization

The user selected custom code as an MVP capability and authorized continuous Stage 1
implementation on 2026-08-24.

## Regression contract

- `packages/core/src/custom-code.test.ts` proves static policy checks reject forbidden data sources, undeclared destinations, and
  unsafe configuration shapes.
- Browser tests cover the expected page, an excluded page, consent-granted and denied
  states, duplicate prevention, outgoing destinations, and new page errors.
- The review displays exact code, destinations, inputs, firing scope, and evidence.

## Dependencies

- Issues 01, 02, and 04.
