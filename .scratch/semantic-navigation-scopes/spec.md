# Semantic navigation scope and container-scale reuse

Status: accepted

## Outcome

A tracking practitioner can ask for navigation tracking in ordinary language, review
the page's meaningful navigation groups, confirm the intended regions, and receive one
region-aware, reusable GTM change plan even when the connected workspace already
contains hundreds of entities.

## Workflow

1. Deterministic page inspection groups navigation targets by observed landmark and
   page region without sending selectors or HTML to a model.
2. A provider-neutral interpreter receives bounded group summaries and may propose
   only supplied group IDs or one shortest useful clarification.
3. The practitioner confirms one semantic navigation scope.
4. Deterministic compilation converts that scope into region-aware GTM entities.
5. A normalized container inventory produces reuse, create, managed update, no-op, or
   conflict actions without exposing the full container to the model.

## Acceptance criteria

- [x] Header, footer, and independently labeled navigation landmarks remain distinct even
  when they contain the same destination URL.
- [x] Responsive variants can share one target group when deterministic evidence supports
  equivalence; uncertain variants remain separate.
- [x] An unspecified request such as “track navigation clicks” asks about meaningful
  groups rather than defaulting to every discovered link.
- [x] A scoped request such as “track header navigation, not the footer” can propose the
  exact supplied group and still requires practitioner confirmation.
- [x] Local model output is schema-validated, non-authoritative, loopback-only, and falls
  back to deterministic clarification when unavailable or invalid.
- [x] Generated navigation setup is constrained by confirmed target selectors as well as
  destination URLs and includes a safe navigation-area parameter.
- [x] Planning remains deterministic and idempotent with at least 200 unrelated existing
  GTM entities; unmarked entities are never updated automatically.
- [x] No full HTML, selector, form value, cookie, storage value, OAuth material, or raw
  container dump enters model context.
