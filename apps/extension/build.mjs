import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const productAuthDefine = {
  __PRODUCT_AUTHORIZATION_ENDPOINT__: JSON.stringify(process.env.PRODUCT_AUTHORIZATION_ENDPOINT ?? ""),
  __PRODUCT_TOKEN_ENDPOINT__: JSON.stringify(process.env.PRODUCT_TOKEN_ENDPOINT ?? ""),
  __PRODUCT_REVOCATION_ENDPOINT__: JSON.stringify(process.env.PRODUCT_REVOCATION_ENDPOINT ?? ""),
  __PRODUCT_OAUTH_CLIENT_ID__: JSON.stringify(process.env.PRODUCT_OAUTH_CLIENT_ID ?? ""),
  __PRODUCT_OAUTH_SCOPE__: JSON.stringify(process.env.PRODUCT_OAUTH_SCOPE ?? "openid user:org:read offline_access"),
  __TEST_PRODUCT_ACCESS_TOKEN__: JSON.stringify(
    process.env.NODE_ENV === "test" ? process.env.TEST_PRODUCT_ACCESS_TOKEN ?? "" : "",
  ),
};

await build({
  entryPoints: { "service-worker": "src/service-worker.ts" },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  sourcemap: true,
  define: productAuthDefine,
});

await build({
  entryPoints: { "content-script": "src/content-script.ts" },
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  sourcemap: true,
});

for (const file of ["manifest.json"]) {
  await cp(`src/${file}`, `dist/${file}`);
}
