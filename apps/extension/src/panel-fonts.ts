import dmSans400 from "./fonts/dm-sans-latin-400-normal.woff2";
import dmSans500 from "./fonts/dm-sans-latin-500-normal.woff2";
import dmSans600 from "./fonts/dm-sans-latin-600-normal.woff2";
import plexMono400 from "./fonts/ibm-plex-mono-latin-400-normal.woff2";
import plexMono500 from "./fonts/ibm-plex-mono-latin-500-normal.woff2";

/**
 * Focosys type families, bundled with the extension (SIL OFL 1.1, see fonts/OFL-*.txt).
 *
 * The assistant runs inside arbitrary pages, so it cannot rely on Google Fonts or on the
 * page's own fonts. `@font-face` rules inside a shadow root are ignored by Chrome, so the
 * faces are registered on the document from in-memory bytes. That needs no network fetch,
 * no `web_accessible_resources` entry and is not subject to the page's `font-src` CSP.
 * The family names are prefixed so a page that also uses DM Sans cannot replace ours.
 */
export const PANEL_SANS_FAMILY = "Trimtale DM Sans";
export const PANEL_MONO_FAMILY = "Trimtale IBM Plex Mono";

const faces: Array<{ family: string; weight: string; bytes: Uint8Array<ArrayBuffer> }> = [
  { family: PANEL_SANS_FAMILY, weight: "400", bytes: dmSans400 },
  { family: PANEL_SANS_FAMILY, weight: "500", bytes: dmSans500 },
  { family: PANEL_SANS_FAMILY, weight: "600", bytes: dmSans600 },
  { family: PANEL_MONO_FAMILY, weight: "400", bytes: plexMono400 },
  { family: PANEL_MONO_FAMILY, weight: "500", bytes: plexMono500 },
];

let registered = false;

export function registerPanelFonts(fontSet: FontFaceSet = document.fonts): void {
  if (registered) return;
  registered = true;
  for (const face of faces) {
    try {
      const fontFace = new FontFace(face.family, face.bytes, { weight: face.weight, style: "normal", display: "swap" });
      fontSet.add(fontFace);
      void fontFace.load().catch(() => undefined);
    } catch {
      // The fallback stacks in the panel tokens keep the panel readable without these faces.
    }
  }
}
