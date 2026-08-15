const GTM_ID = /^GTM-[A-Z0-9]+$/i;

export function validateContainerId(containerId: string): string {
  const normalized = containerId.trim().toUpperCase();
  if (!GTM_ID.test(normalized)) {
    throw new Error("GTM_CONTAINER_ID must look like GTM-XXXXXXX.");
  }
  return normalized;
}

export function renderVerificationTarget(containerId: string): string {
  const id = validateContainerId(containerId);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="gtm-observability-target" content="${id}">
    <title>ConsentFlow Verification Target</title>
    <script>
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${id}');
    </script>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; color: #15322d; background: #f5f8f7; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header, footer { background: #073c35; color: white; padding: 1rem max(1.5rem, calc((100% - 64rem) / 2)); }
      nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
      nav div { display: flex; gap: 1rem; }
      a { color: inherit; }
      main { max-width: 64rem; margin: 0 auto; padding: 5rem 1.5rem; }
      h1 { max-width: 13ch; font-size: clamp(2.5rem, 7vw, 5rem); line-height: .95; margin: 0 0 1.5rem; }
      p { max-width: 42rem; font-size: 1.1rem; line-height: 1.6; }
      .card { margin-top: 3rem; padding: 1.5rem; border: 1px solid #bad1cc; border-radius: 1rem; background: white; }
      button { border: 0; border-radius: .6rem; padding: .9rem 1.2rem; background: #ef6c45; color: white; font-weight: 700; cursor: pointer; }
      code { background: #e4eeeb; padding: .15rem .35rem; border-radius: .3rem; }
      footer { margin-top: 4rem; }
    </style>
  </head>
  <body>
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <header>
      <nav aria-label="Primary navigation">
        <strong>ConsentFlow</strong>
        <div><a href="#features">Features</a><a href="#contact">Contact</a></div>
      </nav>
    </header>
    <main>
      <h1>Safe tracking, observable by design.</h1>
      <p>This isolated deployment is a verification target for testing a GTM tracking setup without changing a production website.</p>
      <section class="card" id="features">
        <h2>Ready for a tracking check</h2>
        <p>Expected container: <code>${id}</code>. Use the navigation links and action below to produce deterministic browser evidence.</p>
        <button id="request-demo" type="button">Request a demo</button>
      </section>
      <section class="card" id="contact">
        <h2>Contact</h2>
        <p><a href="mailto:test@example.com">test@example.com</a></p>
      </section>
    </main>
    <footer><a href="#features">Explore ConsentFlow</a></footer>
    <script>
      document.querySelector('#request-demo').addEventListener('click', function () {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'verification_target_demo_request' });
      });
    </script>
  </body>
</html>`;
}
