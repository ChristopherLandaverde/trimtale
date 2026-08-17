import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const apiBase = process.env.GTM_OBSERVABILITY_API_BASE ?? "http://127.0.0.1:18787";
const apiOrigin = new URL(apiBase).origin;

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    "service-worker": "src/service-worker.ts",
    "content-script": "src/content-script.ts",
    "sidepanel": "src/sidepanel.ts",
  },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  sourcemap: true,
  define: {
    __GTM_OBSERVABILITY_API_BASE__: JSON.stringify(apiBase),
  },
});

const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
manifest.host_permissions = [
  `${apiOrigin}/*`,
  "http://127.0.0.1:14173/*",
  "*://*.google-analytics.com/*",
  "*://analytics.google.com/*",
];
await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of ["sidepanel.html", "sidepanel.css"]) {
  await cp(`src/${file}`, `dist/${file}`);
}
