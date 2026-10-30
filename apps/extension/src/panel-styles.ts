import { PANEL_MONO_FAMILY, PANEL_SANS_FAMILY } from "./panel-fonts.js";

/*
 * Trimtale in-page assistant — Focosys brand.
 * Every color, font, size, space, radius and duration comes from the token block below
 * (values from portfolio-ops ux-standards references/focosys-brand.md). No hex outside it.
 * The tokens live on :host so the page's CSS cannot reach them and they cannot leak out.
 */
const tokens = `
  --surface-paper: #F3F0E6;
  --surface-raised: #EBE8DE;
  --ink-primary: #10231F;
  --ink-secondary: #426B5D;
  --line-subtle: rgba(16, 35, 31, .22);
  --state-exception: #B83A2D;
  --state-warning: #8A5A00;      /* proposed token, not yet in the site CSS */
  --state-verified: #D7FF69;
  --state-observed: #8CBFFF;
  --focus-ring: #10231F;
  --focus-ring-field: #D7FF69;

  --font-sans: "${PANEL_SANS_FAMILY}", "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "${PANEL_MONO_FAMILY}", "IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --text-title: 18px;
  --text-heading: 15px;
  --text-body: 14px;
  --text-small: 13px;
  --text-data: 13px;
  --text-label: 11px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  --radius-sm: 4px;
  --radius-md: 6px;
  --rule: 1px;
  --rule-strong: 2px;
  --label-col: 56px;
  --ease: cubic-bezier(.4, 0, .2, 1);
  --duration: 150ms;
`;

export const panelStyles = `
  :host { all: initial; ${tokens} }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  :focus-visible { outline: var(--rule-strong) solid var(--focus-ring); outline-offset: var(--space-1); box-shadow: 0 0 0 6px var(--focus-ring-field); }

  /* content-box keeps the settled-size preference in the same terms applyPreferences() writes. */
  .assistant { box-sizing: content-box; position: fixed; z-index: 2147483647; min-width: 320px; min-height: 220px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: hidden; resize: both; display: grid; grid-template-rows: auto 1fr auto; border: var(--rule) solid var(--ink-primary); border-radius: var(--radius-md); color: var(--ink-primary); background: var(--surface-paper); font: 400 var(--text-body)/1.5 var(--font-sans); -webkit-font-smoothing: antialiased; transition: width var(--duration) var(--ease), height var(--duration) var(--ease); }
  button { font: inherit; color: inherit; cursor: pointer; }
  code { font-family: var(--font-mono); font-size: var(--text-data); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

  /* Header: drag handle, product label, collapse */
  .drag { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: 40px; padding: var(--space-1) var(--space-2) var(--space-1) var(--space-4); border-bottom: var(--rule) solid var(--ink-primary); cursor: grab; user-select: none; }
  .drag:active { cursor: grabbing; }
  .product { font: 600 var(--text-label)/1.3 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
  .icon { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: var(--rule) solid transparent; border-radius: var(--radius-sm); background: transparent; font-size: var(--text-heading); line-height: 1; }
  .icon:hover { border-color: var(--ink-primary); }

  .messages { overflow: auto; padding: var(--space-3) var(--space-4) var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }

  /* Transcript */
  .message { max-width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; }
  .message.bot { align-self: stretch; }
  .message.user { align-self: flex-end; max-width: 85%; padding: var(--space-2) var(--space-3); border: var(--rule) solid var(--line-subtle); border-radius: var(--radius-sm); background: var(--surface-raised); }
  .message.streaming:empty::before { content: "Working…"; color: var(--ink-secondary); font: 500 var(--text-label)/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; animation: pulse 1.2s var(--ease) infinite alternate; }

  /* Buttons: the user's own next step. Secondary by default; one primary at a time. */
  .quick-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .quick { display: inline-flex; align-items: center; min-height: 32px; padding: var(--space-1) var(--space-3); border: var(--rule) solid var(--ink-primary); border-radius: var(--radius-sm); color: var(--ink-primary); background: var(--surface-paper); font: 500 var(--text-body)/1.3 var(--font-sans); text-decoration: none; }
  .quick:hover { background: var(--surface-raised); }
  .quick:disabled { cursor: default; color: var(--ink-secondary); border-color: var(--ink-secondary); background: var(--surface-paper); }
  .primary-quick { color: var(--surface-paper); background: var(--ink-primary); }
  .primary-quick:hover { background: var(--ink-primary); text-decoration: underline; text-underline-offset: 3px; }
  .gtm-action, .primary-quick { justify-self: start; margin-top: var(--space-2); }

  /* GTM connection card */
  .gtm-context { flex: none; display: grid; gap: var(--space-2); padding: var(--space-3); border: var(--rule) solid var(--line-subtle); border-radius: var(--radius-md); background: var(--surface-raised); }
  .gtm-context-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .gtm-context-heading > strong { font-size: var(--text-small); font-weight: 600; }
  .gtm-context-controls { display: flex; align-items: center; gap: var(--space-1); }
  .gtm-context-refresh { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: var(--rule) solid transparent; border-radius: var(--radius-sm); background: transparent; font-size: var(--text-heading); line-height: 1; }
  .gtm-context-refresh:hover { border-color: var(--ink-primary); }
  .gtm-context-body { display: grid; gap: var(--space-1); min-width: 0; }
  .gtm-context-body p { margin: 0; font-size: var(--text-body); }
  .gtm-context-row { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: var(--space-2); align-items: baseline; }
  .gtm-context-row span { color: var(--ink-secondary); font: 500 var(--text-label)/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
  .gtm-context-row strong { min-width: 0; font-size: var(--text-small); font-weight: 500; overflow-wrap: anywhere; }
  .gtm-context-row strong.mono { font-family: var(--font-mono); font-size: var(--text-data); }
  .gtm-context-body small { color: var(--ink-secondary); font-size: var(--text-small); line-height: 1.45; }

  /* Status tags: word + symbol + color */
  .tag, .gtm-context-badge { display: inline-flex; align-items: center; gap: var(--space-1); width: max-content; padding: 2px var(--space-2); border: var(--rule) solid currentColor; border-radius: var(--radius-sm); color: var(--ink-secondary); font: 600 var(--text-label)/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
  .tag.verified { color: var(--ink-primary); background: var(--state-verified); border-color: var(--ink-primary); }
  .tag.broken { color: var(--surface-paper); background: var(--state-exception); border-color: var(--state-exception); }
  .tag.review, .gtm-context-badge.warning { color: var(--state-warning); }
  .tag.observed, .gtm-context-badge.observed { color: var(--ink-primary); background: var(--state-observed); border-color: var(--ink-primary); }

  /* Findings: observed → why → fix → verify, evidence one click away */
  .finding { display: grid; gap: var(--space-2); padding: var(--space-3); border: var(--rule) solid var(--ink-primary); border-radius: var(--radius-md); background: var(--surface-paper); }
  .finding-title { margin: 0; font-size: var(--text-heading); line-height: 1.35; font-weight: 600; }
  .steps { display: grid; grid-template-columns: var(--label-col) minmax(0, 1fr); column-gap: var(--space-2); row-gap: var(--space-1); margin: 0; }
  .steps dt, .evidence dt { padding-top: 3px; color: var(--ink-secondary); font: 500 var(--text-label)/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
  .steps dd { margin: 0; font-size: var(--text-small); line-height: 1.45; }
  .disclosure { justify-self: start; min-height: 24px; padding: 2px 0; border: 0; background: none; font-size: var(--text-small); font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }
  .disclosure::before { content: "+"; display: inline-block; width: 1.4em; font-family: var(--font-mono); text-decoration: none; }
  .disclosure[aria-expanded="true"]::before { content: "−"; }
  .evidence { display: grid; grid-template-columns: fit-content(62%) minmax(0, 1fr); column-gap: var(--space-2); row-gap: 2px; margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--surface-raised); }
  .evidence dt { text-transform: none; letter-spacing: 0; overflow-wrap: normal; }
  .evidence dd { margin: 0; font-family: var(--font-mono); font-size: var(--text-data); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

  /* Navigation picker */
  .picker { display: grid; gap: var(--space-1); padding: var(--space-2); border: var(--rule) solid var(--line-subtle); border-radius: var(--radius-md); }
  .pick { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-2); min-height: 32px; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); }
  .pick:hover { background: var(--surface-raised); }
  .pick input { width: 16px; height: 16px; margin: 0; accent-color: var(--ink-primary); }
  .pick small { color: var(--ink-secondary); font: 500 var(--text-label)/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }

  /* Evidence path and setup operation timeline */
  .evidence-path { display: grid; gap: 0; padding: var(--space-3); border: var(--rule) solid var(--line-subtle); border-radius: var(--radius-md); }
  .evidence-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); padding-bottom: var(--space-3); }
  .evidence-heading span { font-size: var(--text-heading); font-weight: 600; }
  .evidence-heading small { color: var(--ink-secondary); font: 500 var(--text-label)/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; text-align: right; }
  .evidence-stage { position: relative; display: grid; grid-template-columns: 20px 1fr; gap: var(--space-2); min-height: 40px; }
  .evidence-stage:not(:last-of-type)::after { content: ""; position: absolute; top: 22px; bottom: 0; left: 9px; width: var(--rule); background: var(--line-subtle); }
  .evidence-stage i { position: relative; z-index: 1; display: grid; place-items: center; width: 20px; height: 20px; border: var(--rule) solid var(--ink-primary); border-radius: var(--radius-sm); color: var(--ink-primary); background: var(--state-verified); font: 600 var(--text-label)/1 var(--font-mono); font-style: normal; }
  .evidence-stage.pending i { color: var(--ink-secondary); border-color: var(--ink-secondary); background: var(--surface-paper); }
  .evidence-stage span { display: grid; align-content: start; gap: 2px; padding-bottom: var(--space-3); }
  .evidence-stage strong { font-size: var(--text-body); font-weight: 600; line-height: 1.35; }
  .evidence-stage small { color: var(--ink-secondary); font-size: var(--text-small); line-height: 1.45; overflow-wrap: anywhere; }
  .evidence-note, .gtm-write-note { margin: var(--space-1) 0 0; color: var(--ink-secondary); font-size: var(--text-small); line-height: 1.45; }

  /* Composer */
  .composer { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: var(--space-2); margin: 0; padding: var(--space-3) var(--space-4); border-top: var(--rule) solid var(--ink-primary); }
  textarea { resize: none; width: 100%; min-height: 40px; max-height: 120px; margin: 0; padding: var(--space-2) var(--space-3); border: var(--rule) solid var(--ink-secondary); border-radius: var(--radius-sm); color: var(--ink-primary); background: var(--surface-paper); font: inherit; }
  textarea::placeholder { color: var(--ink-secondary); opacity: 1; }
  textarea:focus-visible { outline: var(--rule-strong) solid var(--focus-ring); outline-offset: 0; box-shadow: 0 0 0 6px var(--focus-ring-field); }
  .send { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: var(--rule) solid var(--ink-primary); border-radius: var(--radius-sm); color: var(--ink-primary); background: var(--surface-paper); font: 600 var(--text-title)/1 var(--font-sans); }
  .send:hover { background: var(--surface-raised); }

  /* Collapsed launcher */
  .orb { display: none; width: 100%; height: 100%; padding: 0; border: 0; border-radius: var(--radius-md); color: var(--state-verified); background: var(--ink-primary); font: 600 var(--text-title)/1 var(--font-mono); }
  .assistant.collapsed { width: 48px !important; height: 48px !important; min-width: 48px; min-height: 48px; resize: none; display: grid; place-items: stretch; border-color: var(--ink-primary); background: var(--ink-primary); }
  .collapsed .drag, .collapsed .messages, .collapsed .composer { display: none; }
  .collapsed .orb { display: block; }
  .collapsed .orb:focus-visible { outline-offset: var(--space-1); }

  @keyframes pulse { from { opacity: 1; } to { opacity: .55; } }
  @media (prefers-reduced-motion: reduce) { .assistant { transition: none; } .message.streaming:empty::before { animation: none; } }
`;

/** Page target highlights. Ink outline with a state halo, so it reads on light and dark pages. */
export const targetHighlightStyles = `
  :host { all: initial; pointer-events: none; ${tokens} }
  .target { position: fixed; z-index: 2147483646; box-sizing: border-box; border: var(--rule-strong) solid var(--ink-primary); border-radius: var(--radius-sm); box-shadow: 0 0 0 var(--rule-strong) var(--state-observed); transition: inset var(--duration) var(--ease); }
  .target.confirmed { box-shadow: 0 0 0 var(--rule-strong) var(--state-verified); }
  .target span { position: absolute; left: -2px; bottom: calc(100% + 4px); max-width: 220px; padding: 2px var(--space-2); overflow: hidden; border: var(--rule) solid var(--ink-primary); border-radius: var(--radius-sm); color: var(--ink-primary); background: var(--state-observed); font: 600 var(--text-small)/1.3 var(--font-sans); text-overflow: ellipsis; white-space: nowrap; }
  .target.confirmed span { background: var(--state-verified); }
  @media (prefers-reduced-motion: reduce) { .target { transition: none; } }
`;
