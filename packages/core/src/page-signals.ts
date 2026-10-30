// Page signals are the only data that crosses from the page's own JavaScript world into
// the extension. They carry event names, identifier-shaped form IDs/names and consent
// states — never form values, free text or arbitrary dataLayer payloads.
// This module has no imports so it can be bundled into the MAIN-world page observer.

export type ConsentState = "granted" | "denied";

export type PageSignal =
  | { kind: "datalayer_event"; event: string; formId?: string; formName?: string; at: number }
  | { kind: "consent"; analyticsStorage: ConsentState; at: number };

const safeEventName = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.prototype.toString.call(value) !== "[object Arguments]";
}

function arrayLike(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (Object.prototype.toString.call(value) === "[object Arguments]") return Array.from(value as ArrayLike<unknown>);
  return undefined;
}

function identifier(value: unknown): string | undefined {
  return typeof value === "string" && safeIdentifier.test(value) ? value : undefined;
}

function eventSignal(event: unknown, parameters: unknown, at: number): PageSignal[] {
  if (typeof event !== "string" || !safeEventName.test(event)) return [];
  const source = isRecord(parameters) ? parameters : {};
  const formId = identifier(source.form_id);
  const formName = identifier(source.form_name);
  return [{ kind: "datalayer_event", event, ...(formId ? { formId } : {}), ...(formName ? { formName } : {}), at }];
}

function consentState(value: unknown): ConsentState | undefined {
  return value === "granted" || value === "denied" ? value : undefined;
}

/** Extracts safe signals from one dataLayer entry (object push or gtag() arguments). */
export function signalsFromDataLayerPush(entry: unknown, at: number): PageSignal[] {
  if (isRecord(entry)) return "event" in entry ? eventSignal(entry.event, entry, at) : [];
  const command = arrayLike(entry);
  if (!command) return [];
  if (command[0] === "event") return eventSignal(command[1], command[2], at);
  if (command[0] === "consent" && (command[1] === "default" || command[1] === "update") && isRecord(command[2])) {
    const analyticsStorage = consentState(command[2].analytics_storage);
    return analyticsStorage ? [{ kind: "consent", analyticsStorage, at }] : [];
  }
  return [];
}

/** Strictly re-validates a serialized signal received from the page world. */
export function parsePageSignal(serialized: string): PageSignal | undefined {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  if (value.kind === "consent") {
    const analyticsStorage = consentState(value.analyticsStorage);
    return analyticsStorage ? { kind: "consent", analyticsStorage, at: value.at } : undefined;
  }
  if (value.kind !== "datalayer_event") return undefined;
  if (value.formId !== undefined && !identifier(value.formId)) return undefined;
  if (value.formName !== undefined && !identifier(value.formName)) return undefined;
  const [signal] = eventSignal(value.event, { form_id: value.formId, form_name: value.formName }, value.at);
  return signal;
}
