// esbuild's binary loader inlines each .woff2 as bytes (see build.mjs).
declare module "*.woff2" {
  const bytes: Uint8Array<ArrayBuffer>;
  export default bytes;
}
