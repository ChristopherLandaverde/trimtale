import React, { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    __reactFixtureVersion?: string;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const measurementId = "G-TEST123456";

function LeadForm(): React.JSX.Element {
  const [complete, setComplete] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const formName = form.getAttribute("aria-label") ?? "React demo request";
    const page = document.documentElement.dataset;
    page.submitAttempted = "true";
    page.submissionResult = "success";
    page.outcomeObserved = "true";
    page.tagFired = "true";
    page.dataLayerEvent = "true";

    window.dataLayer?.push({ event: "generate_lead", form_id: form.id, form_name: formName });
    const endpoint = `/g/collect?v=2&tid=${measurementId}&en=generate_lead`
      + `&ep.form_id=${encodeURIComponent(form.id)}`
      + `&ep.form_name=${encodeURIComponent(formName)}`
      + `&ep.page_location=${encodeURIComponent(`${location.origin}/react`)}`;
    navigator.sendBeacon(endpoint);
    history.pushState({}, "", "/react/complete");
    setComplete(true);
  }

  return (
    <main>
      <h1>React lead request</h1>
      <p>This form is rendered and submitted by React.</p>
      <form
        id="react-lead-form"
        aria-label="React demo request"
        data-success-selector="#react-success"
        onSubmit={submit}
      >
        <label>
          Work email
          <input name="email" type="email" required />
        </label>
        <button type="submit">Request demo</button>
      </form>
      <p id="react-success" role="status" aria-live="polite" hidden={!complete}>
        Your React demo request was received.
      </p>
    </main>
  );
}

const node = document.querySelector("#react-app");
if (!(node instanceof HTMLElement)) {
  throw new Error("React fixture root is missing.");
}

window.__reactFixtureVersion = React.version;
window.dataLayer = window.dataLayer ?? [];
document.documentElement.dataset.fixtureScenario = "react_success";
document.documentElement.dataset.consent = "granted";
document.documentElement.dataset.transport = "spa";
document.documentElement.dataset.outcomeObservable = "true";
createRoot(node).render(<LeadForm />);
