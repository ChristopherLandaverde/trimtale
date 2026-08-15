# GTM Observability

GTM Observability is a commercial product that turns a tracking practitioner's description of desired website tracking into a tested Google Tag Manager configuration. Verification makes the setup trustworthy and supports later monitoring and diagnosis features.

## Language

**Tracking intent**:
A plain-language description of the user behavior and analytics outcome a person wants to verify.
_Avoid_: Prompt, tracking request, tagging instruction

**Tracking check**:
An investigation that exercises a website and compares observed tracking behavior with a tracking intent, producing evidence that the intent works or explaining why it does not.
_Avoid_: Preview, audit, scan

**Tracking setup**:
The process that turns a tracking intent into a tested Google Tag Manager configuration that a tracking practitioner can review and deploy.
_Avoid_: Tag creation, AI-generated tag, automatic tagging

**Tracking practitioner**:
A freelancer or agency team member responsible for implementing and verifying tracking on client websites.
_Avoid_: GTM person, marketer, user

**Verification target**:
An isolated deployed website environment where a tracking setup can be installed and checked without risking a production site.
_Avoid_: Test website, fixture deployment, staging URL

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
