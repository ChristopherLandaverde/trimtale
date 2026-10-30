import { watch } from "node:fs";
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const apiBase = process.env.GTM_OBSERVABILITY_API_BASE ?? "http://127.0.0.1:18787";
const apiOrigin = new URL(apiBase).origin;
const outdir = process.env.GTM_OBSERVABILITY_EXTENSION_OUTDIR ?? "dist";
const resolverToken = process.env.GTM_OBSERVABILITY_EXTENSION_TOKEN ?? "";
const shouldWatch = process.argv.includes("--watch");
let building = false;
let pending = false;

async function buildExtension() {
  if (building) {
    pending = true;
    return;
  }
  building = true;

  try {
    await rm(outdir, { recursive: true, force: true });
    await mkdir(outdir, { recursive: true });

    await build({
      entryPoints: {
        "service-worker": "src/service-worker.ts",
        "content-script": "src/content-script.ts",
        "page-observer": "src/page-observer.ts",
        "page-bridge": "src/page-bridge.ts",
        "workbench": "src/workbench.ts",
      },
      bundle: true,
      format: "esm",
      target: "chrome120",
      outdir,
      sourcemap: true,
      loader: { ".woff2": "binary" },
      define: {
        __GTM_OBSERVABILITY_API_BASE__: JSON.stringify(apiBase),
        __GTM_OBSERVABILITY_EXTENSION_TOKEN__: JSON.stringify(resolverToken),
      },
    });

    const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
    manifest.host_permissions = [
      `${apiOrigin}/*`,
      "http://127.0.0.1:14173/*",
      "*://*.google-analytics.com/*",
      "*://analytics.google.com/*",
    ];
    await writeFile(`${outdir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

    for (const file of ["workbench.html", "workbench.css"]) {
      await cp(`src/${file}`, `${outdir}/${file}`);
    }
    // The fonts are inlined into content-script.js; ship their licences beside it.
    await mkdir(`${outdir}/fonts`, { recursive: true });
    for (const file of ["OFL-DMSans.txt", "OFL-IBMPlexMono.txt"]) {
      await cp(`src/fonts/${file}`, `${outdir}/fonts/${file}`);
    }
    console.log(`Built extension in ${outdir} for ${apiBase}`);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      await buildExtension();
    }
  }
}

await buildExtension();

if (shouldWatch) {
  console.log(`Watching extension source and rebuilding ${outdir}...`);
  let timeout;
  const watchedFiles = [
    "src/content-script.ts",
    "src/panel-styles.ts",
    "src/verdict-presenter.ts",
    "src/page-observer.ts",
    "src/page-bridge.ts",
    "src/page-signal-bridge.ts",
    "src/manifest.json",
    "src/service-worker.ts",
    "src/workbench.css",
    "src/workbench.html",
    "src/workbench.ts",
  ];
  for (const file of watchedFiles) {
    watch(file, () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        void buildExtension().catch((error) => {
          console.error(error);
          process.exitCode = 1;
        });
      }, 100);
    });
  }
}
