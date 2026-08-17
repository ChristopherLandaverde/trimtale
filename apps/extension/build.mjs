import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const apiBase = process.env.GTM_OBSERVABILITY_API_BASE ?? "http://127.0.0.1:18787";

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

for (const file of ["manifest.json", "sidepanel.html", "sidepanel.css"]) {
  await cp(`src/${file}`, `dist/${file}`);
}
