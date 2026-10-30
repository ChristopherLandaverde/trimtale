// Runs in the page's MAIN world at document_start, before any page script. Once the extension
// starts a form verification, it reads window.dataLayer passively (polling for new entries; it
// never replaces dataLayer.push or any page function) and sends only sanitized signals — event
// names, identifier-shaped form IDs/names and consent states — to the extension's isolated
// world. Form values and other dataLayer fields never leave this function.
//
// Page scripts share this world, so everything they could tamper with is closed off:
// - The only channel out is a MessagePort received once, at document_start, from the
//   isolated-world bridge (see page-signal-bridge.ts). No DOM event carries signals or commands,
//   so a page cannot forge signals, start polling, or read the stream.
// - Every built-in on that path (event listeners, MessagePort, timers, the clock) is captured
//   here, before page scripts can replace them, and called through the captured Reflect.apply.
// - There is no global flag a page could pre-set to disable the observer; its state lives in
//   this closure.
// What remains page-controlled by definition is window.dataLayer itself, and the sanitizer
// below, which reads page objects with built-ins a page may have rewritten. The isolated world
// re-validates every signal, so the most a hostile page can do through this observer is report
// dataLayer content it could equally have pushed to its own dataLayer.
import { signalsFromDataLayerPush, type PageSignal } from "@trimtale/core/page-signals";
import { pageObserverConnectEvent, pageObserverStartCommand } from "./page-signal-bridge.js";

declare global {
  interface Window { dataLayer?: unknown }
}

const pollIntervalMs = 50;

const apply = Reflect.apply;
const isArray = Array.isArray;
const now = Date.now;
const addListener = EventTarget.prototype.addEventListener;
const removeListener = EventTarget.prototype.removeEventListener;
const setTimer = window.setInterval;
const MessageEventType = MessageEvent;
const MessagePortType = MessagePort;
const portPostMessage = MessagePort.prototype.postMessage;
const portStart = MessagePort.prototype.start;
const messagePorts = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "ports")!.get!;
const messageData = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data")!.get!;
const pageWindow = window;
const pageDocument = document;

let port: MessagePort | undefined;
let started = false;
let observedLayer: unknown[] | undefined;
let processed = 0;

const send = (signal: PageSignal): void => {
  if (port) apply(portPostMessage, port, [signal]);
};

const poll = (): void => {
  try {
    readDataLayer();
  } catch {
    // A hostile dataLayer (a throwing getter or Proxy) must not break the observer.
  }
};

function readDataLayer(): void {
  const layer = pageWindow.dataLayer;
  if (!apply(isArray, undefined, [layer])) return;
  const entries = layer as unknown[];
  if (entries !== observedLayer) {
    observedLayer = entries;
    processed = 0;
  }
  if (entries.length < processed) processed = 0;
  const at = apply(now, Date, []);
  while (processed < entries.length) {
    try {
      const signals = signalsFromDataLayerPush(entries[processed], at);
      for (let index = 0; index < signals.length; index += 1) send(signals[index]!);
    } catch {
      // A hostile getter on a dataLayer entry must not break the observer.
    }
    processed += 1;
  }
}

// The observer stays idle until the extension starts a form verification on this page.
// dataLayer keeps its history, so consent defaults and earlier events are still read.
const onCommand = (event: Event): void => {
  if (apply(messageData, event, []) !== pageObserverStartCommand) return;
  if (!started) {
    started = true;
    apply(setTimer, pageWindow, [poll, pollIntervalMs]);
    apply(addListener, pageWindow, ["pagehide", poll]);
  }
  poll();
};

const onConnect = (event: Event): void => {
  if (port || !(event instanceof MessageEventType)) return;
  const ports = apply(messagePorts, event, []) as readonly MessagePort[];
  const candidate = ports.length === 1 ? ports[0] : undefined;
  if (!(candidate instanceof MessagePortType)) return;
  port = candidate;
  apply(removeListener, pageDocument, [pageObserverConnectEvent, onConnect, true]);
  apply(addListener, port, ["message", onCommand]);
  apply(portStart, port, []);
};

apply(addListener, pageDocument, [pageObserverConnectEvent, onConnect, true]);

export {};
