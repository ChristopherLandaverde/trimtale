// Runs in the page's MAIN world. Once the extension starts a form verification, it reads
// window.dataLayer passively
// (polling for new entries; it never replaces dataLayer.push or any page function) and
// forwards only sanitized signals — event names, identifier-shaped form IDs/names and
// consent states — to the extension's isolated content script. Form values and other
// dataLayer fields never leave this function.
import { signalsFromDataLayerPush, type PageSignal } from "@trimtale/core/page-signals";

const signalEvent = "trimtale:page-signal";
const replayEvent = "trimtale:page-signal-replay";
const historyLimit = 200;
const pollIntervalMs = 50;

declare global {
  interface Window { __trimtalePageObserver?: boolean; dataLayer?: unknown }
}

if (!window.__trimtalePageObserver) {
  window.__trimtalePageObserver = true;
  const history: string[] = [];
  let observedLayer: unknown[] | undefined;
  let processed = 0;

  const emit = (signal: PageSignal): void => {
    const serialized = JSON.stringify(signal);
    history.push(serialized);
    if (history.length > historyLimit) history.shift();
    document.dispatchEvent(new CustomEvent(signalEvent, { detail: serialized }));
  };

  const poll = (): void => {
    const layer = window.dataLayer;
    if (!Array.isArray(layer)) return;
    if (layer !== observedLayer) {
      observedLayer = layer;
      processed = 0;
    }
    if (layer.length < processed) processed = 0;
    const now = Date.now();
    while (processed < layer.length) {
      let entry: unknown;
      try {
        entry = layer[processed];
      } catch {
        entry = undefined;
      }
      processed += 1;
      try {
        for (const signal of signalsFromDataLayerPush(entry, now)) emit(signal);
      } catch {
        // A hostile getter on a dataLayer entry must not break the observer.
      }
    }
  };

  // The observer stays idle until the extension starts a form verification on this page.
  // dataLayer keeps its history, so consent defaults and earlier events are still read.
  let started = false;
  document.addEventListener(replayEvent, () => {
    if (!started) {
      started = true;
      window.setInterval(poll, pollIntervalMs);
      window.addEventListener("pagehide", poll);
    }
    poll();
    for (const serialized of history) document.dispatchEvent(new CustomEvent(signalEvent, { detail: serialized }));
  });
}

export {};
