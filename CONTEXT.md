# GTM Observability

GTM Observability is a commercial site-aware analytics assistant for implementing, investigating, and observing website measurement from the website itself. Google Tag Manager is its initial implementation target; verification evidence connects setup work with later monitoring and diagnosis.

## Language

**Site-aware analytics assistant**:
A persistent assistant that understands the current website, its measurement configuration, and its observed analytics behavior so a client operator or tracking practitioner can carry out tracking work in context.
_Avoid_: Chatbot, AI tag generator, GTM copilot

**Tracking intent**:
A plain-language description of the user behavior and analytics outcome a person wants to verify.
_Avoid_: Prompt, tracking request, tagging instruction

**Observed interaction**:
A browser-visible action performed by a website visitor, such as clicking a link or submitting a form. It can provide evidence of a conversion outcome but is not itself necessarily a conversion.
_Avoid_: Conversion, goal, event

**Conversion outcome**:
A business-significant result that a website intends to measure and optimize, such as a qualified inquiry, booked appointment, signup, or purchase.
_Avoid_: Goal, conversion event, button click

**Experiment intent**:
A plain-language description of the variants, eligible audience, success outcome, and decision a tracking practitioner wants an experiment to support.
_Avoid_: A/B-test prompt, GA function, test request

**Analysis task**:
A question about measurement or experiment evidence that requires computation beyond immediate page inspection while remaining connected to the originating website and conversation.
_Avoid_: Heavy query, background AI job, GA function

**Measurement lifecycle**:
The connected progression from tracking intent through implementation, verification, continuous observation, incident diagnosis, and corrected setup, preserving evidence between each stage.
_Avoid_: Feature stack, three tools, tag workflow

**Tracking check**:
An investigation that exercises a website and compares observed tracking behavior with a tracking intent, producing evidence that the intent works or explaining why it does not.
_Avoid_: Preview, audit, scan

**Diagnostic handoff**:
A continuation of an inconclusive website investigation in a guided workspace that preserves the tracking intent and collected evidence while helping a person supply what the assistant could not observe.
_Avoid_: Failure screen, manual debugging, escalation

**Verified resolution**:
A diagnosis and corrective action supported by before-and-after tracking evidence and confirmed by a person when business interpretation is required.
_Avoid_: Agent learning, chat answer, suggested fix

**Tracking setup**:
The process that turns a tracking intent into a tested Google Tag Manager configuration that a tracking practitioner can review and deploy.
_Avoid_: Tag creation, AI-generated tag, automatic tagging

**Tracking practitioner**:
A freelancer or agency team member responsible for implementing and verifying tracking on client websites.
_Avoid_: GTM person, marketer, user

**Client operator**:
A customer-success or account-management professional responsible for a client's website outcomes who needs professional tracking without specialist knowledge of tag-manager internals.
_Avoid_: Non-technical user, marketer, junior GTM user

**Lead-generation site**:
A website whose important measurable outcomes are prospect actions such as form submissions, phone calls, or appointment requests rather than purchases.
_Avoid_: Simple website, brochure site

**Navigation click**:
A click on a practitioner-confirmed navigation element, recorded through one consistent analytics event shape with details about the selected link and its navigation area.
_Avoid_: Menu click, individual link event

**Navigation scope**:
The set of navigation elements discovered by the agent and confirmed by the tracking practitioner before a tracking setup is created.
_Avoid_: All links, automatic selection

**Generated container file**:
A downloadable GTM-compatible JSON file containing the ordinary tags, triggers, and variables for a tracking setup, intended to be imported into a GTM workspace.
_Avoid_: Custom template, container template, production update

**Implementation confidence**:
An evidence-based assessment of how likely a tracking setup is to produce the intended browser-side behavior across comparable tested scenarios.
_Avoid_: AI confidence, success probability, platform confidence

**Platform confirmation**:
Evidence from an analytics or advertising destination that it received or processed tracking data. It remains separate from implementation confidence because browser evidence cannot prove every platform-side outcome.
_Avoid_: Browser verification, guaranteed attribution, delivery confidence

**Scenario corpus**:
A collection of reproducible website, consent, GTM, and destination configurations with known expected outcomes, used to test diagnoses, generated setups, and implementation-confidence calibration.
_Avoid_: Training data, mock websites, examples

**Time to verified setup**:
The elapsed time from submitting a tracking intent to the generated tracking setup passing its browser check after import.
_Avoid_: Setup time, generation time

**Undetected error**:
A defect present in a tracking setup that the product reports as passing despite a scenario-corpus check capable of exposing it.
_Avoid_: Hallucination, missed bug, platform uncertainty
