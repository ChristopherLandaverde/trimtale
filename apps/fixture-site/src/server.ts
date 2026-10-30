import { createServer } from "node:http";
import { formEndpointStatus, getFormFixtureScenario, type FormFixtureScenario } from "./form-scenarios.js";

const port = Number.parseInt(process.env.FIXTURE_PORT ?? "14173", 10);

export type FixtureAdversary = "datalayer" | "consent";

/**
 * A hostile page script (`?adversary=datalayer|consent`). It runs in the page's own JavaScript
 * world, after the extension's document_start scripts — exactly where a real site's or a
 * third-party tag's script runs — and tries every way a page could tamper with the evidence
 * the extension receives from its MAIN-world observer:
 * - pre-sets the observer's old `window.__trimtalePageObserver` guard flag;
 * - listens for every page-observer event and message to read the signal stream;
 * - wraps `JSON.stringify`, `EventTarget.prototype.dispatchEvent` and
 *   `MessagePort.prototype.postMessage` to read or rewrite what the observer sends;
 * - repeatedly dispatches forged `trimtale:page-signal` events (a generate_lead event, or a
 *   denied consent state) and `trimtale:page-signal-replay` events that started polling;
 * - offers the observer a MessagePort of its own and asks it to start.
 * Nothing it forges ever enters `window.dataLayer`, so GTM never sees it.
 */
function adversaryScript(adversary: FixtureAdversary): string {
  return `<script>
    (() => {
      const stolen = [];
      window.__stolenSignals = stolen;
      const stringify = JSON.stringify;
      const forgedSignal = () => ${adversary === "consent"
        ? "({ kind: 'consent', analyticsStorage: 'denied', at: Date.now() })"
        : "({ kind: 'datalayer_event', event: 'generate_lead', formId: 'contact', at: Date.now() })"};
      try { Object.defineProperty(window, '__trimtalePageObserver', { value: true, writable: false, configurable: false }); } catch {}
      const describe = (value) => { try { return typeof value === 'string' ? value : stringify(value); } catch { return String(value); } };
      const record = (label) => (event) => { if (!event.__forged) stolen.push(label + ' ' + describe(event.detail ?? event.data ?? null)); };
      for (const name of ['trimtale:page-signal', 'trimtale:page-signal-replay', 'trimtale:page-observer-connect']) {
        document.addEventListener(name, record(name), true);
        window.addEventListener(name, record(name), true);
      }
      window.addEventListener('message', record('message'), true);
      JSON.stringify = function (value, ...rest) {
        if (value && (value.kind === 'datalayer_event' || value.kind === 'consent')) {
          stolen.push('json ' + stringify(value));
          return stringify(forgedSignal());
        }
        return stringify.call(this, value, ...rest);
      };
      const dispatch = EventTarget.prototype.dispatchEvent;
      EventTarget.prototype.dispatchEvent = function (event) {
        if (String(event.type).startsWith('trimtale:') && !event.__forged) stolen.push('dispatch ' + event.type + ' ' + describe(event.detail ?? null));
        return dispatch.call(this, event);
      };
      const post = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function (message, ...rest) {
        if (!(message && message.__forged)) stolen.push('port ' + describe(message));
        return post.call(this, message, ...rest);
      };
      const forged = (event) => { event.__forged = true; return event; };
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => stolen.push('own-port ' + describe(event.data));
      document.dispatchEvent(forged(new MessageEvent('trimtale:page-observer-connect', { ports: [channel.port2] })));
      setInterval(() => {
        document.dispatchEvent(forged(new CustomEvent('trimtale:page-signal', { detail: stringify(forgedSignal()) })));
        document.dispatchEvent(forged(new CustomEvent('trimtale:page-signal-replay')));
        post.call(channel.port1, { type: 'start', __forged: true });
      }, 25);
    })();
    </script>`;
}

function page(pathname: string, fixture: FormFixtureScenario, gtmContainerId?: string, adversary?: FixtureAdversary): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="gtm-observability-measurement-id" content="G-TEST123456" />
    <meta name="gtm-observability-container-id" content="GTM-TEST123" />
    <title>Northstar Studio${pathname === "/" ? "" : ` — ${pathname.slice(1)}`}</title>
    ${adversary ? adversaryScript(adversary) : ""}
    ${gtmContainerId ? `<script src="/fixture-gtm.js?id=${gtmContainerId}"></script>` : ""}
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; color: #17212b; }
      header, footer { display: flex; align-items: center; justify-content: space-between; padding: 20px 8vw; }
      header { border-bottom: 1px solid #ddd; }
      footer { margin-top: 80px; border-top: 1px solid #ddd; }
      nav { display: flex; gap: 20px; }
      a { color: #194db4; }
      main { max-width: 900px; margin: 70px auto; padding: 0 24px; }
      h1 { font-size: 48px; max-width: 680px; }
      .fixture-forms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 42px; }
      form { display: grid; gap: 10px; padding: 18px; border: 1px solid #ddd; border-radius: 12px; }
      label { display: grid; gap: 5px; }
      input { padding: 9px; }
      .lead-form { display: contents; }
    </style>
  </head>
  <body>
    <header>
      <a id="logo" href="/">Northstar</a>
      <nav aria-label="Primary navigation">
        <a href="/services">Services</a>
        <a href="/work">Work</a>
        <a href="/contact">Contact</a>
      </nav>
    </header>
    <main>
      <h1>Lead-generation websites for growing teams.</h1>
      <p>This deterministic fixture represents a small agency website.</p>
      <section class="fixture-forms" aria-label="Lead forms">
        ${fixture.presentation === "cross_origin_iframe" ? '<iframe title="External lead form" src="http://127.0.0.1:4174/external-form"></iframe>' : `
        <section class="lead-form" aria-label="Contact sales form">
          <form id="contact" aria-label="Contact sales"${fixture.transport === "redirect" ? ` action="/thank-you?formScenario=${encodeURIComponent(fixture.id)}" method="post"` : ""}>
            <label>Work email <input name="email" type="email"${fixture.validation === "html5" ? " required" : ""} /></label>
            <button type="submit">Contact sales</button>
          </form>
          ${fixture.transport === "redirect" ? "" : '<p role="status" id="contact-success" hidden></p>'}
          <p role="alert" class="form-error" hidden></p>
        </section>
        <section class="lead-form" aria-label="Newsletter form">
          <form id="newsletter" aria-label="Newsletter signup">
            <label>Email <input name="email" type="email" /></label>
            <button type="submit">Join newsletter</button>
          </form>
          <p role="status" id="newsletter-success" hidden></p>
          <p role="alert" class="form-error" hidden></p>
        </section>
        `}
      </section>
    </main>
    <footer>
      <nav aria-label="Footer navigation">
        <a href="/privacy">Privacy</a>
      </nav>
    </footer>
    <script>
      // This fixture behaves like a real lead-gen site. It sets no verdict flags: the
      // extension must read the submit, the visible outcome, the dataLayer, consent and
      // GA4 delivery from the browser itself.
      const formFixture = ${JSON.stringify(fixture)};
      window.__formFixture = formFixture;
      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      if (formFixture.consent !== 'unknown') {
        gtag('consent', 'default', { analytics_storage: formFixture.consent, ad_storage: formFixture.consent });
      }
      const duplicate = new URLSearchParams(location.search).get('scenario') === 'duplicate';
      document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link) return;
        event.preventDefault();
        const endpoint = '/g/collect?v=2&tid=G-TEST123456&en=navigation_click&ep.link_text=' +
          encodeURIComponent(link.textContent.trim()) + '&ep.link_url=' + encodeURIComponent(link.href);
        navigator.sendBeacon(endpoint);
        if (duplicate) navigator.sendBeacon(endpoint);
        setTimeout(() => { location.href = link.href; }, 250);
      }, true);

      // Deterministic stand-in for GTM: a generate_lead trigger fires the GA4 event tag.
      function fireLeadTag(formId, formName) {
        if (!formFixture.tagFired) return;
        const parameters = formFixture.includeRequiredParameters
          ? '&ep.form_id=' + encodeURIComponent(formId) + '&ep.form_name=' + encodeURIComponent(formName) + '&ep.page_location=' + encodeURIComponent(location.origin + location.pathname)
          : '';
        const request = '/g/collect?v=2&tid=G-TEST123456&en=generate_lead' + parameters;
        if (formFixture.ga4RequestCount === 0) {
          navigator.sendBeacon(request + '&fixture_drop=1');
          return;
        }
        for (let index = 0; index < formFixture.ga4RequestCount; index += 1) navigator.sendBeacon(request);
      }

      function trackLead(formId, formName, email) {
        if (!formFixture.dataLayerEvent) return;
        // Adversarial on purpose: real sites sometimes push the typed email into the dataLayer.
        window.dataLayer.push({ event: 'generate_lead', form_id: formId, form_name: formName, lead_email: email });
        fireLeadTag(formId, formName);
      }

      function postLead(form, onDone, attempt = 1) {
        const body = new FormData(form);
        const url = '/api/lead?formScenario=' + encodeURIComponent(formFixture.id) + '&attempt=' + attempt;
        // A retrying form library: one more attempt after a failed request.
        const done = (ok) => (!ok && formFixture.retriesFailedResponse && attempt === 1 ? postLead(form, onDone, 2) : onDone(ok));
        if (formFixture.presentation === 'embedded') {
          const request = new XMLHttpRequest();
          request.open('POST', url);
          request.onload = () => done(request.status >= 200 && request.status < 300);
          request.send(body);
          return;
        }
        fetch(url, { method: 'POST', body })
          .then((response) => response.json().then(() => done(response.ok)), () => done(false));
      }

      // A third-party widget on another origin whose own endpoint is failing.
      function callThirdPartyWidget() {
        if (!formFixture.thirdPartyErrorAfterSubmit) return;
        fetch('http://localhost:' + location.port + '/widget/collect', { method: 'POST', mode: 'cors' })
          .then((response) => response.text(), () => undefined);
      }

      function attachFixtureForm(form, status) {
        const error = form.parentElement.querySelector('[role="alert"]');
        form.addEventListener('submit', (event) => {
          if (formFixture.transport === 'redirect') return;
          event.preventDefault();
          const email = form.querySelector('input[type="email"]');
          if (formFixture.submissionResult === 'validation_error' && formFixture.validation !== 'endpoint') {
            email.setAttribute('aria-invalid', 'true');
            if (error) { error.hidden = false; error.textContent = 'Enter a work email address.'; }
            return;
          }
          callThirdPartyWidget();
          postLead(form, (ok) => {
            // reportsSuccessOnFailure: a broken page that ignores the failed response.
            if (!ok && !formFixture.reportsSuccessOnFailure) {
              if (error) { error.hidden = false; error.textContent = 'Something went wrong. Try again.'; }
              return;
            }
            if (!formFixture.outcomeObserved) return;
            if (formFixture.transport === 'spa') history.pushState({}, '', '/lead-complete?formScenario=' + encodeURIComponent(formFixture.id));
            if (status) { status.hidden = false; status.textContent = "Thanks, we'll be in touch."; }
            trackLead(form.id, form.getAttribute('aria-label'), email.value);
          });
        });
      }

      if (location.pathname === '/thank-you' && formFixture.transport === 'redirect' && formFixture.outcomeObserved) {
        document.querySelector('h1').textContent = "Thanks, we'll be in touch.";
        trackLead('contact', 'Contact sales', '');
      }

      if (formFixture.presentation === 'dynamic') {
        document.querySelector('#contact')?.remove();
        setTimeout(() => {
          const dynamic = document.createElement('form');
          dynamic.id = 'dynamic-contact';
          dynamic.setAttribute('aria-label', 'Dynamic contact');
          dynamic.innerHTML = '<label>Work email <input name="email" type="email"></label><button type="submit">Contact sales</button>';
          document.querySelector('#contact-success')?.before(dynamic);
          attachFixtureForm(dynamic, document.querySelector('#contact-success'));
        }, 150);
      }

      if (formFixture.presentation === 'embedded') {
        // A third-party embed script that renders its form into the page without an iframe.
        document.querySelector('#contact')?.closest('.lead-form')?.remove();
        setTimeout(() => {
          const embed = document.createElement('div');
          embed.setAttribute('role', 'region');
          embed.setAttribute('aria-label', 'Partner demo request');
          embed.innerHTML = '<form id="hsForm_8f3a2c" class="hs-form" aria-label="Request a demo"><label>Work email <input name="email" type="email"></label><button type="submit">Request a demo</button></form><p role="status" id="hsForm_8f3a2c_status" hidden></p><p role="alert" hidden></p>';
          document.querySelector('.fixture-forms')?.prepend(embed);
          attachFixtureForm(embed.querySelector('form'), embed.querySelector('[role="status"]'));
        }, 100);
      }

      document.querySelectorAll('form').forEach((form) => {
        attachFixtureForm(form, form.parentElement.querySelector('[role="status"]'));
      });
    </script>
  </body>
</html>`;
}

function fixtureAdversary(value: string | null): FixtureAdversary | undefined {
  return value === "datalayer" || value === "consent" ? value : undefined;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "fixture-site" }));
    return;
  }
  if (url.pathname === "/api/lead" && request.method === "POST") {
    const fixture = getFormFixtureScenario(url.searchParams.get("formScenario"));
    const status = formEndpointStatus(fixture, Number.parseInt(url.searchParams.get("attempt") ?? "1", 10));
    const ok = status >= 200 && status < 300;
    request.resume();
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(ok ? { ok: true } : { error: status >= 500 ? "unavailable" : "rejected" }));
    return;
  }
  if (url.pathname === "/widget/collect") {
    // Reached cross-origin (http://localhost) by the third_party_error_after_success scenario.
    request.resume();
    response.writeHead(500, { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store", "Content-Type": "text/plain" });
    response.end("widget unavailable");
    return;
  }
  if (url.pathname === "/g/collect" && url.searchParams.get("fixture_drop") === "1") {
    // Simulates a GA4 request that never reaches Google (blocked or dropped connection).
    request.socket.destroy();
    return;
  }
  if (url.pathname === "/g/collect") {
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if (url.pathname === "/fixture-gtm.js") {
    response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" });
    response.end("// Deterministic local GTM runtime marker.");
    return;
  }
  request.resume();
  const fixture = getFormFixtureScenario(url.searchParams.get("formScenario"));
  // A native form POST lands here; the page it returns carries the form endpoint's status.
  const status = request.method === "POST" && url.pathname === "/thank-you" ? formEndpointStatus(fixture) : 200;
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(page(
    url.pathname,
    fixture,
    url.searchParams.get("gtm") ?? undefined,
    fixtureAdversary(url.searchParams.get("adversary")),
  ));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fixture site listening on http://127.0.0.1:${port}`);
});
