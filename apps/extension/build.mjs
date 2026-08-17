import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    "service-worker": "src/service-worker.ts",
    "content-script": "src/content-script.ts",
  },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  sourcemap: true,
});

for (const file of ["manifest.json"]) {
  await cp(`src/${file}`, `dist/${file}`);
}
