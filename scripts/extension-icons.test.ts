import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const extensionSrc = new URL("../apps/extension/src/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", extensionSrc), "utf8")) as {
  icons?: Record<string, string>;
  action?: { default_icon?: Record<string, string> };
};

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(new URL(path, extensionSrc));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("extension icons", () => {
  it("declares the Chrome icon sizes for the extensions page and the toolbar", () => {
    expect(Object.keys(manifest.icons ?? {}).sort()).toEqual(["128", "16", "32", "48"]);
    expect(Object.keys(manifest.action?.default_icon ?? {}).sort()).toEqual(["16", "32"]);
  });

  it("points every declared size at a square PNG of that size", () => {
    const declared = { ...manifest.icons, ...manifest.action?.default_icon };
    for (const [size, path] of Object.entries(declared)) {
      expect(pngSize(path)).toEqual({ width: Number(size), height: Number(size) });
    }
  });

  it("copies the icons into the built extension", () => {
    const build = readFileSync(new URL("../apps/extension/build.mjs", import.meta.url), "utf8");
    expect(build).toContain("src/icons/icon-${size}.png");
    expect(build).toContain("[16, 32, 48, 128]");
  });
});
