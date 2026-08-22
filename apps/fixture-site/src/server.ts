import { createServer } from "node:http";
import { getFormFixtureScenario, type FormFixtureScenario } from "./form-scenarios.js";

const port = Number.parseInt(process.env.FIXTURE_PORT ?? "4173", 10);

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
      <section class="fixture-forms" aria-label="Lead forms" data-presentation="${fixture.presentation}">
        ${fixture.presentation === "cross_origin_iframe" ? '<iframe title="External lead form" src="http://127.0.0.1:4174/external-form"></iframe>' : `
        <form id="contact" aria-label="Contact sales" data-success-selector="#contact-success">
          <label>Work email <input name="email" type="email" /></label>
          <button type="submit">Contact sales</button>
        </form>
        <form id="newsletter" aria-label="Newsletter signup" data-success-selector="#newsletter-success">
          <label>Email <input name="email" type="email" /></label>
          <button type="submit">Join newsletter</button>
        </form>
        <p id="contact-success" hidden>Thanks, we'll be in touch.</p>
        <p id="newsletter-success" hidden>Thanks for subscribing.</p>
        `}
      </section>
    </main>
    <footer>
      <nav aria-label="Footer navigation">
        <a href="/privacy">Privacy</a>
      </nav>
    </footer>
    <script>
      const formFixture = ${JSON.stringify(fixture)};
      window.__formFixture = formFixture;
      window.dataLayer = window.dataLayer || [];
      document.documentElement.dataset.fixtureScenario = formFixture.id;
      document.documentElement.dataset.consent = formFixture.consent;
      document.documentElement.dataset.transport = formFixture.transport;
      document.documentElement.dataset.outcomeObservable = String(formFixture.presentation !== 'cross_origin_iframe');
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

      function attachFixtureForm(form) {
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          document.documentElement.dataset.submitAttempted = 'true';
          document.documentElement.dataset.submissionResult = formFixture.submissionResult;
          document.documentElement.dataset.tagFired = String(formFixture.tagFired);
          document.documentElement.dataset.dataLayerEvent = String(formFixture.dataLayerEvent);
          if (formFixture.submissionResult !== 'success' || !formFixture.outcomeObserved) {
            document.documentElement.dataset.submissionResult = formFixture.submissionResult;
            return;
          }
          if (formFixture.dataLayerEvent) {
            window.dataLayer.push({ event: 'generate_lead', form_id: form.id, form_name: form.getAttribute('aria-label') });
          }
          const parameters = formFixture.includeRequiredParameters
            ? '&ep.form_id=' + encodeURIComponent(form.id) + '&ep.form_name=' + encodeURIComponent(form.getAttribute('aria-label')) + '&ep.page_location=' + encodeURIComponent(location.origin + location.pathname)
            : '';
          for (let index = 0; index < formFixture.ga4RequestCount; index += 1) {
            navigator.sendBeacon('/g/collect?v=2&tid=G-TEST123456&en=generate_lead' + parameters);
          }
          if (formFixture.transport === 'redirect') {
            location.href = '/thank-you?scenario=' + encodeURIComponent(formFixture.id);
            return;
          }
          if (formFixture.transport === 'spa') history.pushState({}, '', '/lead-complete?scenario=' + encodeURIComponent(formFixture.id));
          const success = document.querySelector(form.dataset.successSelector || '');
          if (success) success.hidden = false;
          document.documentElement.dataset.outcomeObserved = 'true';
        });
      }

      if (formFixture.presentation === 'dynamic') {
        const contact = document.querySelector('#contact');
        contact?.remove();
        setTimeout(() => {
          const dynamic = document.createElement('form');
          dynamic.id = 'dynamic-contact';
          dynamic.setAttribute('aria-label', 'Dynamic contact');
          dynamic.dataset.successSelector = '#contact-success';
          dynamic.innerHTML = '<label>Work email <input name="email" type="email"></label><button type="submit">Contact sales</button>';
          document.querySelector('.fixture-forms')?.prepend(dynamic);
          attachFixtureForm(dynamic);
        }, 150);
      }
      document.querySelectorAll('form').forEach(attachFixtureForm);
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
