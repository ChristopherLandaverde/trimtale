// Runs in the extension's isolated world at document_start, immediately after the MAIN-world
// page observer and before any page script. It opens the private MessagePort to the observer
// (see page-signal-bridge.ts), re-validates every signal that arrives on it, and publishes the
// result to the content script through an isolated-world global the page cannot see.
import { pageSignalFromValue, type PageSignal } from "@trimtale/core/page-signals";
import {
  pageObserverConnectEvent,
  pageObserverStartCommand,
  pageSignalBridgeKey,
  type PageSignalBridge,
} from "./page-signal-bridge.js";

const historyLimit = 200;

if (!(pageSignalBridgeKey in globalThis)) {
  const channel = new MessageChannel();
  const history: PageSignal[] = [];
  const listeners: Array<(signal: PageSignal) => void> = [];

  channel.port1.onmessage = (event: MessageEvent<unknown>) => {
    const signal = pageSignalFromValue(event.data);
    if (!signal) return;
    history.push(signal);
    if (history.length > historyLimit) history.shift();
    for (const listener of listeners) listener(signal);
  };

  const bridge: PageSignalBridge = {
    start() {
      channel.port1.postMessage(pageObserverStartCommand);
    },
    subscribe(listener) {
      listeners.push(listener);
      for (const signal of [...history]) listener(signal);
    },
    get received() {
      return history.map((signal) => ({ ...signal }));
    },
  };
  Object.defineProperty(globalThis, pageSignalBridgeKey, { value: bridge });

  // Synchronous: the observer's listener takes port2 before this call returns.
  document.dispatchEvent(new MessageEvent(pageObserverConnectEvent, { ports: [channel.port2] }));
}

export {};
