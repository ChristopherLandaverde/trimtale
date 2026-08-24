import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(root, "src/react-page.tsx")],
  bundle: true,
  format: "iife",
  outfile: resolve(root, "dist/react-page.js"),
  platform: "browser",
  sourcemap: true,
});
