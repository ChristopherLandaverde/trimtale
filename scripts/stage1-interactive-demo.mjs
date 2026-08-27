import { chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve("apps/extension/dist");
const profile = await mkdtemp(join(tmpdir(), "gtm-observability-stage1-demo-"));
const operationId = "operation_spec_form_manual_demo";
let resumeCount = 0;

const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: false,
  viewport: null,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--start-maximized",
  ],
});

await context.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
  contentType: "application/javascript",
  body: "",
}));
await context.route("https://www.google-analytics.com/g/collect?*", (route) => route.fulfill({
  status: 204,
  body: "",
}));
await context.route("http://127.0.0.1:8787/api/google/status", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    configured: true,
    connected: true,
    scope: "container-edit",
    containerWritesEnabled: true,
    publicationScopeRequested: true,
    publicationEnabled: true,
    tokenPersistenceEnabled: true,
    analyticsReadEnabled: false,
  }),
}));
await context.route("http://127.0.0.1:8787/api/google/containers/recognize?*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    containerWritesEnabled: true,
    result: {
      status: "recognized",
      publicId: "GTM-DEMO123",
      account: { accountId: "1", name: "Safe demo agency" },
      container: {
        accountId: "1",
        containerId: "10",
        name: "Interactive Stage 1 demo",
        publicId: "GTM-DEMO123",
      },
      measurementIds: ["G-DEMO123456"],
    },
  }),
}));
await context.route("http://127.0.0.1:8787/api/google/workflows/plan", (route) => route.fulfill({
  status: 201,
  contentType: "application/json",
  body: JSON.stringify({
    result: {
      status: "planned",
      operation: {
        id: operationId,
        status: "planned",
        plan: {
          status: "ready",
          fingerprint: "plan_manual_demo",
          actions: [
            { kind: "trigger", action: "create", generatedName: "Trigger - successful Demo lead form" },
            { kind: "tag", action: "create", generatedName: "GA4 Event - generate_lead" },
          ],
        },
      },
    },
  }),
}));
await context.route("http://127.0.0.1:8787/api/google/workflows/*/verify-draft", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    result: {
      status: "draft_verified",
      nextStep: "create_version",
      operation: { id: operationId, status: "draft_verified" },
    },
  }),
}));
await context.route("http://127.0.0.1:8787/api/google/workflows/*/resume", (route) => {
  resumeCount += 1;
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      result: resumeCount === 1
        ? {
            status: "awaiting_preview",
            nextStep: "run_tag_assistant_preview",
            preview: {
              setupFingerprint: "setup_manual_demo",
              workspaceFingerprint: "workspace-manual-demo",
              previewVersionFingerprint: "preview-manual-demo-8",
            },
            operation: {
              id: operationId,
              status: "validated",
              validation: { status: "passed" },
            },
          }
        : {
            status: "versioned",
            nextStep: "await_approval",
            operation: {
              id: operationId,
              status: "versioned",
              validation: { status: "passed" },
              version: {
                fingerprint: "version-manual-demo-8",
                priorLiveVersionFingerprint: "live-manual-demo-7",
              },
            },
          },
    }),
  });
});
await context.route("http://127.0.0.1:8787/api/google/workflows/*/approve-publication", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    result: {
      status: "approved",
      nextStep: "publish",
      operation: {
        id: operationId,
        status: "approved",
        version: { fingerprint: "version-manual-demo-8" },
        approval: {
          approvedAt: new Date().toISOString(),
          versionFingerprint: "version-manual-demo-8",
        },
      },
    },
  }),
}));
await context.route("http://127.0.0.1:8787/api/google/workflows/*/publish", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    result: {
      status: "published",
      nextStep: "verify_publication",
      operation: {
        id: operationId,
        status: "published",
        version: { fingerprint: "version-manual-demo-8" },
        publication: {
          publishedAt: new Date().toISOString(),
          versionFingerprint: "version-manual-demo-8",
        },
      },
    },
  }),
}));
await context.route("http://127.0.0.1:8787/api/google/workflows/*/verify-publication", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    result: {
      status: "completed",
      nextStep: "complete",
      operation: {
        id: operationId,
        status: "completed",
        version: { fingerprint: "version-manual-demo-8" },
        publication: { versionFingerprint: "version-manual-demo-8" },
        postPublicationEvidenceId: "run-live-manual-demo-8",
      },
    },
  }),
}));

await context.route("http://127.0.0.1:4175/stage1-demo", (route) => route.fulfill({
  contentType: "text/html",
  body: `<!doctype html>
    <html lang="en"><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="gtm-observability-container-id" content="GTM-DEMO123">
      <meta name="gtm-observability-measurement-id" content="G-DEMO123456">
      <title>Safe Stage 1 interactive demo</title>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-DEMO123"></script>
      <style>
        *{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial,sans-serif;background:#f2f7f5;color:#17221e}
        main{max-width:920px;margin:0 auto;padding:42px 28px}.safe{background:#123c31;color:#fff;padding:14px 18px;border-radius:12px;font-weight:700}
        .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;margin-top:26px}.card{background:#fff;border:1px solid #cbdad4;border-radius:18px;padding:26px;box-shadow:0 12px 32px #183d3020}
        h1{font-size:38px;line-height:1.12;margin:24px 0 10px}ol{padding-left:22px}label{display:block;font-weight:700;margin-bottom:8px}input{width:100%;padding:12px;border:1px solid #8da49b;border-radius:8px}
        button{margin-top:14px;padding:12px 18px;border:0;border-radius:9px;background:#146c53;color:#fff;font-weight:700;cursor:pointer}#demo-success{margin-top:16px;padding:12px;background:#dff8eb;border-radius:8px}
        code{background:#e7efec;padding:2px 5px;border-radius:4px}@media(max-width:760px){.grid{grid-template-columns:1fr}}
      </style>
    </head><body><main>
      <div class="safe">SAFE CONTROLLED DEMO — no Google workspace or live container will be changed.</div>
      <h1>Stage 1: verified GTM setup from chat</h1>
      <p>Use the tracking agent in the lower-right corner to build, preview, version, and publish this controlled setup.</p>
      <div class="grid">
        <section class="card">
          <h2>Demo lead form</h2>
          <form id="demo-lead" aria-label="Demo lead form" data-success-selector="#demo-success">
            <label for="work-email">Work email</label>
            <input id="work-email" name="email" type="email" required placeholder="you@example.com">
            <button type="submit">Request demo</button>
          </form>
          <p id="demo-success" role="status" hidden>Thanks — your demo request was received.</p>
        </section>
        <aside class="card">
          <h2>Suggested test</h2>
          <ol>
            <li>Open the tracking agent.</li>
            <li>Ask: <code>Track successful submissions of this form</code></li>
            <li>Review and approve the setup.</li>
            <li>Prepare, apply, and validate the draft.</li>
            <li>Confirm that no version exists before the browser run.</li>
            <li>Start the exact run, then submit this form.</li>
            <li>Review and publish the exact demo version.</li>
            <li>Run live verification and submit the form once more.</li>
            <li>Finish at the Live and verified receipt.</li>
          </ol>
        </aside>
      </div>
      <script>
        window.dataLayer = window.dataLayer || [];
        document.querySelector('#demo-lead').addEventListener('submit', function (event) {
          event.preventDefault();
          document.documentElement.dataset.transport = 'ajax';
          document.documentElement.dataset.submissionResult = 'success';
          document.documentElement.dataset.outcomeObserved = 'true';
          document.documentElement.dataset.outcomeObservable = 'true';
          document.documentElement.dataset.tagFired = 'true';
          document.documentElement.dataset.consent = 'granted';
          document.querySelector('#demo-success').hidden = false;
          window.dataLayer.push({ event: 'demo_lead_success' });
          var beacon = document.createElement('img');
          beacon.hidden = true;
          beacon.src = 'https://www.google-analytics.com/g/collect?v=2&en=generate_lead';
          document.body.appendChild(beacon);
        });
      </script>
    </main></body></html>`,
}));

const pages = context.pages();
const page = pages[0] ?? await context.newPage();
await page.goto("http://127.0.0.1:4175/stage1-demo");
await page.bringToFront();

console.log("Stage 1 interactive demo opened. Close Chromium when finished.");
await new Promise((resolveClose) => context.on("close", resolveClose));
await rm(profile, { recursive: true, force: true });
