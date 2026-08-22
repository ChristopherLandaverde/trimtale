import { createServer } from "node:http";

const port = Number.parseInt(process.env.FIXTURE_PORT ?? "4173", 10);

function page(pathname: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Northstar Studio${pathname === "/" ? "" : ` — ${pathname.slice(1)}`}</title>
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
      <section class="fixture-forms" aria-label="Lead forms">
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
      </section>
    </main>
    <footer>
      <nav aria-label="Footer navigation">
        <a href="/privacy">Privacy</a>
      </nav>
    </footer>
    <script>
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
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(page(url.pathname));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fixture site listening on http://127.0.0.1:${port}`);
});
