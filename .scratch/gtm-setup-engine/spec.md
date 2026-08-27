# Natural-language GTM and GA4 setup engine

Delivery mode: specification
Status: draft

## Product outcome

An agency practitioner or client operator describes a desired website measurement
behavior from the website itself. A GTM- and GA4-focused agent uses the observed page,
the connected container, and the connected GA4 property to propose a complete tracking
setup, explain useful parameters, apply the approved draft in one managed workspace,
test the exact draft, repair bounded failures, and present one verified container
version for human-controlled publication.

The product optimizes **time to verified setup**, not time to emit a tag or a block of
code.

## Product surfaces

### Website agent

Tagging setup happens from the website being configured. The website agent owns:

- natural-language tracking intent;
- page and runtime inspection;
- target and success-evidence confirmation;
- setup suggestions and clarification;
- tracking change review;
- managed-workspace application;
- guided browser verification;
- bounded repair of a failed draft;
- review of the verified container version;
- publication confirmation in chat; and
- publication of the confirmed version.

### Control portal

The signed-in portal is not a tag editor. It owns:

- organization and user identity;
- durable Google authorization;
- accessible GTM account and container inventory;
- effective access for each container;
- connected GA4 property and stream context;
- version and workspace change awareness across containers;
- durable setup, approval, publication, and rollback history; and
- consistent status for operations initiated from the website agent.

A user does not need to leave the website-agent conversation to publish a completed
setup. The portal records and exposes the resulting state; it is not a required
publication step.

The portal may later become the home for debugging and ongoing observability. Those
later capabilities do not enter this Stage 1 specification.

## Supported provider boundary

Stage 1 supports:

- Google Tag Manager web containers; and
- Google Analytics 4 web properties and streams associated with those containers.

Server-side GTM, mobile containers, Google Ads configuration, non-Google analytics
destinations, general marketing automation, debugging as a standalone product, and
scheduled observability remain outside Stage 1.

## Setup workflow

```text
signed-in portal establishes organization and Google access
    -> website agent recognizes the exact page container
    -> user states a tracking intent
    -> agent inspects website, GTM, and GA4 context
    -> agent proposes a tracking specification and useful parameters
    -> user reviews the intended behavior
    -> agent produces a firing policy and GTM entity graph
    -> deterministic validation and change planning
    -> explicit approval to change the managed workspace
    -> idempotent application
    -> hand off the exact workspace draft to Tag Assistant on the website
    -> browser and GA4 verification
    -> bounded evidence-driven repair when needed
    -> create one exact container version
    -> website agent presents that verified version in chat
    -> human confirms publication of that version in chat
    -> publish that version
    -> portal records the approval, publication, and resulting state
```

No step may treat a generated draft, applied workspace, compiler-valid version,
browser request, or aggregate GA4 count as evidence for a later stage that did not
occur.

Stage 1 uses a supported human-assisted Tag Assistant handoff for the exact workspace
browser run. The agent prepares the workspace, guides the run, and accepts evidence
only when it is bound to the same setup, workspace, and quick-preview fingerprints. It
does not depend on an undocumented Tag Assistant session interface.

## Generic authoring model

Events are configuration data rather than runtime product branches. A tracking setup
must describe at least:

```text
tracking intent
    -> business outcome
    -> tag action and destination
    -> event name and parameter mappings
    -> trigger source
    -> include conditions
    -> exclusion conditions
    -> firing frequency
    -> consent requirements
    -> verification contract
```

The generic model must support composition of:

- page, DOM-ready, window-loaded, history-change, click, form-outcome, element-
  visibility, and custom-data-layer trigger sources;
- exact, contains, prefix, suffix, and safe regular-expression comparisons;
- AND conditions, OR through multiple triggers, and exception triggers;
- built-in variables, data-layer variables, constants, and explicit parameter
  mappings;
- standard GTM tag templates, approved custom or community templates, and Custom HTML;
  and
- positive and negative browser-verification expectations.

Navigation clicks, confirmed lead forms, page-scoped events, phone clicks, downloads,
and custom data-layer events must use the same authoring, planning, application, and
verification pipeline. A new event that uses existing primitives must not require a
new generator or user-interface state machine.

## Language-model responsibility

The language model is a specialized GTM and GA4 authoring assistant. It may:

- interpret ordinary language against privacy-filtered website and container context;
- propose event names, trigger logic, variables, parameters, and exclusions;
- explain required, recommended, and optional parameters;
- compose novel configurations from generic GTM tools;
- adapt authoritative third-party integration instructions;
- generate Custom HTML or JavaScript when safer standard mechanisms are insufficient;
- use failed verification evidence to propose a bounded repair; and
- explain the exact reviewed change in plain language.

The model does not provide evidence, grant itself mutation authority, approve a
workspace change, approve publication, or claim GA4 receipt. Deterministic contracts,
tool results, provider responses, and approval checkpoints remain authoritative.

Routine schema lookup, semantic comparison, validation, application, evidence
normalization, and verdict classification must not require a model call. Model calls
are reserved for language interpretation, business suggestions, novel composition,
custom code, and failures unresolved by known rules.

## Parameter suggestions

Each parameter proposal is classified as one of:

- provider-required;
- provider-recommended;
- observed and available;
- model-suggested for the stated business outcome;
- unavailable;
- requiring clarification;
- requiring a GA4 custom definition; or
- prohibited because it is private or unsafe.

Required and useful optional suggestions appear in the draft by default. Every
suggestion remains visible and removable before approval. The system never silently
maps form values, message contents, email addresses, phone numbers, cookies, or other
private values into analytics parameters.

## Custom HTML and JavaScript

Custom code is an MVP capability because many third-party integrations supply or
require JavaScript. The agent follows this preference order:

```text
standard GTM feature
    -> installed or approved template
    -> sandboxed custom template
    -> Custom HTML or JavaScript
```

When authoritative vendor instructions exist, the agent adapts those instructions
instead of inventing an integration. A custom-code proposal must expose:

- the code and a plain-language behavior summary;
- every external network destination;
- the data inputs it reads;
- consent requirements;
- pages and events on which it may run;
- positive and negative verification evidence; and
- the exact approver and version fingerprint.

Custom code is never published from an unverified workspace or through a general
authorization.

## GA4 configuration

Stage 1 may read and propose changes for:

- Enhanced Measurement coverage;
- event and parameter contracts;
- event-scoped custom dimensions and custom metrics; and
- key-event configuration.

GTM and GA4 remain separate provider state. A combined review may present both, but
each provider mutation has its own exact target, approval, action receipt, and
verification evidence. GA4 writes never follow implicitly from a GTM change.

## Website adaptability

The authoring engine is framework-independent. The browser observation layer uses web
and GTM runtime boundaries rather than production branches named for WordPress, React,
Shopify, Webflow, or another framework.

The same tracking specification must be testable across static documents, server-
rendered pages, client-routed applications, dynamically inserted elements, eligible
frames, and open shadow roots. Inaccessible cross-origin frames, closed shadow roots,
CAPTCHA, or unobservable business outcomes produce an exact boundary rather than a
fabricated result.

## Approval and publication

The agent may create and repair a managed-workspace draft and create a container
version only after the relevant approval checkpoints. In chat, the website agent
presents the verified version, its changes, and its evidence, then asks the human to
approve publication of that version. The publication action is bound to the displayed
version fingerprint. Any later container or version change invalidates that approval.

The agent never publishes automatically or treats earlier setup approval as publication
approval. Rollback retains the recorded prior-live version and remains a separate
approved action. The portal shows these actions and their results without being a
required stop in the setup workflow.

A same-name semantic change to a product-owned managed entity requires a separate
review of the exact current and proposed semantics. Approval binds the plan, entity
kind, entity ID, and current Google fingerprint. A fresh mismatch blocks application;
human-owned and unmarked entities remain in conflict.

## Container inventory and change awareness

For every connected organization, the portal lists accessible GTM accounts and web
containers with their effective access. It records enough normalized version and
workspace state to identify a newly observed configuration change without claiming
that the website behavior changed.

Container change awareness is configuration evidence, not a scheduled website scan or
incident diagnosis.

## Success measures

The primary measure is time to verified setup from submitted tracking intent through
passing browser verification. Supporting measures are:

- first-pass verification rate;
- manual GTM edits required;
- clarification count;
- model calls per completed setup;
- bounded repair attempts;
- setups abandoned or handed off; and
- undetected errors in the scenario corpus.

Latency targets remain product hypotheses until measured in representative workflows.

## Acceptance criteria

- [x] One generic contract represents open event names, parameters, trigger sources,
  conditions, exclusions, tag actions, consent requirements, and verification.
- [x] Existing navigation and lead-form workflows migrate without losing their
  regression evidence.
- [x] At least three additional event examples use existing primitives without new
  event-specific production branches.
- [x] One model-backed authoring loop proposes a schema-valid setup without supplying
  selectors, evidence, approval, or provider authority.
- [x] Parameter suggestions distinguish required, recommended, custom-definition,
  unavailable, and prohibited values.
- [x] A known interaction uses shared scope and review states, the generic compiler,
  and the durable managed-workspace planner without a separate event generator.
- [x] Outbound-link and file-download requests reuse the known-interaction workflow,
  prefer exact-stream Enhanced Measurement when already enabled, and otherwise create
  privacy-safe custom setups without destination values.
- [x] Page-view, scroll, site-search, and video-engagement requests report exact-stream
  Enhanced-measurement coverage or its exact gap without creating fallback GTM setup.
- [x] Email-link requests use observable `mailto:` evidence and the shared scoped setup
  workflow without sending addresses, URL values, subject/body values, or link text.
- [x] Every automatically resolved form and locally matched known link is visibly
  grounded on the page before setup review without crossing the privacy boundary.
- [ ] One authoritative third-party JavaScript example is generated, reviewed,
  applied to the managed workspace, positively and negatively verified, versioned,
  approved, and published through the ordinary workflow.
- [x] The exact workspace draft is exercised in a real browser before version approval.
- [x] Failed verification may cause bounded repair without widening the confirmed
  tracking intent or publication authority.
- [x] A same-name product-owned entity can be replaced only after exact semantic
  review bound to its entity ID, current fingerprint, and durable plan.
- [x] GA4 custom definitions and key events use separate explicit provider actions.
- [ ] The portal lists accessible containers and effective access and identifies a
  newly observed version or workspace change.
- [ ] Tag creation and editing remain absent from the portal.
- [x] A user can review and publish one verified version from chat without visiting
  the portal.
- [x] Publication requires human approval bound to the displayed verified version
  fingerprint.
- [x] The same supported setup passes representative static, dynamic, client-routed,
  and adversarial browser fixtures.

## Non-goals

- A general-purpose marketing or coding assistant.
- A raw MCP wrapper around unrestricted GTM and GA4 APIs.
- Tag creation or editing in the control portal.
- Automatic publication.
- Server-side or mobile GTM containers.
- Google Ads or non-Google destination configuration.
- Scheduled website scanning, alerts, incident management, or general debugging.
- Proving event-level or user-level identity in GA4.
- Collecting private form values or unrelated page content.

## Migration boundary

The current navigation and form generators are retained as behavioral references until
the generic engine passes their existing acceptance and browser tests. They are not
removed first, and their regressions are not weakened to make the migration pass.

The existing managed-workspace, semantic planning, resumable application, versioning,
publication, rollback, browser evidence, and GA4 correlation foundations should be
reused unless a later implementation issue demonstrates a concrete incompatibility.

## Open implementation choices

- Portal technology, deployment, identity provider, and storage.
- Production model selection and routing.
- Exact model-call and repair-attempt budgets.
- Initial third-party integration used to prove custom code.
- Exact container-change polling and retention policy.
- Whether agency administrators may separately grant `tagmanager.manage.users` for
  verified ACL inventory; without it, access remains explicitly unavailable.

These choices do not authorize runtime implementation while this specification remains
in specification mode.

## Ordered optimization backlog

The completed Stage 1 workflow proves the supported architecture. Optimization now
prioritizes fewer false starts, broader evidence reuse, and lower time to verified
setup without weakening approval, privacy, or provider boundaries:

1. Issue 23 keeps confirmed verification targets operable when the website agent and
   page controls compete for a narrow viewport.
2. Issue 24 defines an explicit exact-preview readiness receipt before a browser run
   can begin.
3. Issue 25 defines one generic browser-evidence contract for expected requests,
   permitted automatic events, required parameters, and duplicate policy.
4. Issue 26 proves the callback pattern with one selected cross-origin provider before
   any generalized adapter framework is proposed.
5. Issue 27 distinguishes active Google stages from timeouts and prevents UI retries
   from duplicating in-flight provider work.
6. Issue 28 establishes representative measures for verification time, first-pass
   success, false verdicts, provider calls, restart recovery, and required human
   actions.

Server-side and mobile measurement remain separate projects. A parent-page Custom HTML
tag does not bypass the browser's cross-origin boundary; iframe coverage requires a
trusted provider callback, validated `postMessage`, code running on the iframe origin,
or another supported completion signal.
