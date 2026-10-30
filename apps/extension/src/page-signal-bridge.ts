import type { PageSignal } from "@trimtale/core/page-signals";

// The private channel between the MAIN-world page observer and the extension's isolated world.
//
// Both ends run at document_start, before any page script, and in manifest order: the observer
// (page-observer.js, MAIN world) first, then the bridge (page-bridge.js, isolated world).
// Chrome documents both guarantees: document_start scripts are injected "before any other DOM
// is constructed or any other script is run", and static content scripts "are injected in the
// order in which they are specified in the manifest"
// (https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
//
// The handshake is one synchronous DOM event: the bridge creates a MessageChannel and dispatches
// a MessageEvent carrying one port on `document`; the observer's listener — the only listener
// that can exist at that point — takes the port and removes itself. From then on the two worlds
// talk only over that MessagePort, which no page script holds a reference to: a page cannot
// forge signals into it, start the observer through it, or read what crosses it. Later
// handshake events (from a page script) find no listener.

/** The DOM event that carries the bridge's MessagePort to the observer, once, at document_start. */
export const pageObserverConnectEvent = "trimtale:page-observer-connect";

/** The only command the bridge sends: start (or resume) polling window.dataLayer. */
export const pageObserverStartCommand = "start";

/** Isolated-world global under which the bridge is published to the content script. */
export const pageSignalBridgeKey = Symbol.for("trimtale.pageSignalBridge");

export interface PageSignalBridge {
  /** Asks the observer to read window.dataLayer (it stays idle until the first call). */
  start(): void;
  /** Delivers every signal received so far, in order, then each new one. */
  subscribe(listener: (signal: PageSignal) => void): void;
  /** Re-validated signals received from the observer (most recent last, bounded). */
  readonly received: readonly PageSignal[];
}

/**
 * The bridge published by page-bridge.js in this isolated world, if the manifest content
 * scripts ran on this page. A content script injected later on demand (a tab opened before the
 * extension was installed) has no observer and therefore no page signals.
 */
export function pageSignalBridge(): PageSignalBridge | undefined {
  return (globalThis as Record<symbol, PageSignalBridge | undefined>)[pageSignalBridgeKey];
}
