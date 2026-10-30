import { createServer } from "node:http";
import { getFormFixtureScenario, type FormFixtureScenario } from "./form-scenarios.js";

const port = Number.parseInt(process.env.FIXTURE_PORT ?? "14173", 10);

function page(pathname: string, fixture: FormFixtureScenario, gtmContainerId?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="gtm-observability-measurement-id" content="G-TEST123456" />
    <meta name="gtm-observability-container-id" content="GTM-TEST123" />
    <title>Northstar Studio${pathname === "/" ? "" : ` — ${pathname.slice(1)}`}</title>
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

      function postLead(form, onDone) {
        const body = new FormData(form);
        const url = '/api/lead?formScenario=' + encodeURIComponent(formFixture.id);
        if (formFixture.presentation === 'embedded') {
          const request = new XMLHttpRequest();
          request.open('POST', url);
          request.onload = () => onDone(request.status >= 200 && request.status < 300);
          request.send(body);
          return;
        }
        fetch(url, { method: 'POST', body })
          .then((response) => response.json().then(() => onDone(response.ok)), () => onDone(false));
      }

      function attachFixtureForm(form, status) {
        const error = form.parentElement.querySelector('[role="alert"]');
        form.addEventListener('submit', (event) => {
          if (formFixture.transport === 'redirect') return;
          event.preventDefault();
          const email = form.querySelector('input[type="email"]');
          if (formFixture.submissionResult === 'validation_error') {
            email.setAttribute('aria-invalid', 'true');
            if (error) { error.hidden = false; error.textContent = 'Enter a work email address.'; }
            return;
          }
          postLead(form, (ok) => {
            if (!ok) {
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

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "fixture-site" }));
    return;
  }
  if (url.pathname === "/api/lead" && request.method === "POST") {
    const fixture = getFormFixtureScenario(url.searchParams.get("formScenario"));
    const failed = fixture.submissionResult === "server_error";
    request.resume();
    response.writeHead(failed ? 500 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(failed ? { error: "unavailable" } : { ok: true }));
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
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(page(
    url.pathname,
    getFormFixtureScenario(url.searchParams.get("formScenario")),
    url.searchParams.get("gtm") ?? undefined,
  ));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fixture site listening on http://127.0.0.1:${port}`);
});
