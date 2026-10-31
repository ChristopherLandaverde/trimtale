#!/usr/bin/env node
// Step 2 of the README demo: render the storyboard frames from test-results/readme-demo/run.json
// (written by capture.mjs) and assemble docs/media/form-verified.gif. Every quoted string and
// number below is read from run.json; only the headlines and connecting words are written here.

import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const work = resolve(root, "test-results/readme-demo");
const output = resolve(root, "docs/media/form-verified.gif");
const ffmpeg = process.env.FFMPEG ?? (existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");
const secondsPerFrame = 4;

const run = JSON.parse(readFileSync(join(work, "run.json"), "utf8"));
const { fixed, broken } = run;
if (fixed.verdictCode !== "browser_verified") throw new Error(`fixed run verdict was ${fixed.verdictCode}`);
if (broken.verdictCode !== "missing_parameter") throw new Error(`broken run verdict was ${broken.verdictCode}`);

const image = (name) => pathToFileURL(join(work, name)).href;
const field = (evidence, label) => {
  const row = evidence.find((item) => item.label === label);
  if (!row) throw new Error(`run.json has no evidence row ${label}`);
  return row.value;
};
const shortUrl = (url) => url.replace(/^https?:\/\//, "");

/** The request Playwright saw leave the browser, one decoded query parameter per line. */
function requestLines(url, marks) {
  const parsed = new URL(url);
  return [
    { text: `${parsed.host}${parsed.pathname}`, mark: marks.host },
    ...[...parsed.searchParams].map(([key, value]) => ({ text: `  ${key}=${value}`, mark: marks[key] })),
  ];
}

// Whitespace-only reflow so the markup fits the card: the input goes on its own line.
const formLines = fixed.formMarkup.replace(" <input", "\n            <input").split("\n").map((line) => line.replace(/^\s{10}/, ""));
const missing = broken.finding.observed.match(/without (.+)\.$/)?.[1];
if (!missing) throw new Error("broken finding does not name the missing parameters");
const missingNames = missing.split(/, | and /);
const missingCount = missingNames.length;
const missingList = missingNames.flatMap((name, index) => [
  ...(index === 0 ? [] : [index === missingNames.length - 1 ? " and " : ", "]), { code: name },
]);
const formsFound = fixed.formQuestion.match(/I found (\d+) forms?/)?.[1];
if (!formsFound) throw new Error("run.json has no form-count message");
const exportTag = fixed.exportTag;
const formName = exportTag.eventParameters.find((item) => item.name === "form_name")?.value;
if (!formName) throw new Error("export has no form_name parameter");

const frames = [
  {
    headline: ["Ask in plain words. Trimtale finds the forms and you confirm one."],
    page: { url: shortUrl(fixed.url), image: image("fixed-target-page.png") },
    code: {
      label: "Page DOM",
      path: "form#contact on the bundled fixture",
      lines: formLines.map((text, index) => ({ text, mark: index === 0 ? "observed" : undefined })),
    },
    note: [
      "Request: “", run.request, "”. ", { num: formsFound }, " forms found; ",
      { code: formName }, " confirmed as ", { num: exportTag.eventName }, ".",
    ],
    panel: image("fixed-target-panel.png"),
  },
  {
    headline: ["Broken variant: the lead request leaves without its form details."],
    page: { url: shortUrl(broken.url), image: image("broken-submitted-page.png") },
    code: {
      label: "Request the browser sent",
      path: "seen by Playwright, decoded",
      lines: requestLines(broken.collected[0], { en: "broken" }),
    },
    note: [
      { broken: broken.finding.status }, " ", { num: field(broken.evidence, "network.ga4Requests") }, " ",
      { code: field(broken.evidence, "network.ga4Requests[0].en") }, " request, ", { num: String(missingCount) },
      " required parameters missing: ", ...missingList, ".",
    ],
    panel: image("broken-finding-panel.png"),
  },
  {
    headline: ["The fix the finding names: the GA4 tag sends the form details."],
    page: { url: shortUrl(fixed.url), image: image("fixed-submitted-page.png") },
    code: {
      label: "GTM export",
      path: fixed.exportName,
      lines: [
        { text: `tag            ${exportTag.name}` },
        { text: `eventName      ${exportTag.eventName}` },
        { text: `measurementId  ${exportTag.measurementId}` },
        { text: "eventParameters" },
        ...exportTag.eventParameters.map((item) => ({ text: `  ${item.name.padEnd(14)}${item.value}`, mark: "verified" })),
      ],
    },
    note: [
      "Re-run on the fixture's correctly tagged variant (", { code: fixed.scenario }, "): ",
      { verified: fixed.finding.status }, " ", { num: field(fixed.evidence, "network.ga4Requests") }, " request after “",
      fixed.successMessage, "”",
    ],
    panel: image("fixed-finding-panel.png"),
  },
  {
    headline: ["Show evidence: the request the browser actually sent."],
    page: { url: shortUrl(fixed.url), image: image("fixed-submitted-page.png") },
    code: {
      label: "Request the browser sent",
      path: "seen by Playwright, decoded",
      lines: requestLines(fixed.collected[0], { host: "observed", tid: "observed", en: "observed", "ep.form_id": "observed" }),
    },
    note: [
      "Host ", { num: field(fixed.evidence, "network.ga4Requests[0].host") }, " is the fixture's stand-in collector. ",
      { num: field(fixed.evidence, "network.ga4Requests[0].tid") }, ", ", { num: field(fixed.evidence, "network.ga4Requests[0].en") },
      ", form_id ", { num: field(fixed.evidence, "network.ga4Requests[0].ep.form_id") }, ". Browser evidence only: platform confirmation ",
      { code: field(fixed.evidence, "verdict.platformConfirmation") }, ".",
    ],
    panel: image("fixed-evidence-panel.png"),
  },
].map((frame, index, all) => ({ ...frame, counter: `${index + 1} / ${all.length}` }));

const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 880, height: 640 }, deviceScaleFactor: 1 });
  for (const [index, frame] of frames.entries()) {
    await page.goto(pathToFileURL(resolve(import.meta.dirname, "frame.html")).href);
    await page.evaluate((data) => window.renderFrame(data), frame);
    await page.screenshot({ path: join(work, `frame-${index + 1}.png`) });
  }
} finally {
  await browser.close();
}

function ff(args) {
  const result = spawnSync(ffmpeg, ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
  if (result.status !== 0) throw new Error(`ffmpeg failed:\n${result.stderr?.toString().slice(-2000)}`);
}
// Two-pass palette GIF: one shared palette for all frames, each frame held secondsPerFrame.
const input = ["-framerate", `1/${secondsPerFrame}`, "-i", join(work, "frame-%d.png")];
ff([...input, "-vf", "palettegen=max_colors=128:stats_mode=full", join(work, "palette.png")]);
ff([...input, "-i", join(work, "palette.png"), "-lavfi", "paletteuse=dither=none", "-loop", "0", output]);
console.log(`Wrote ${output} (${(statSync(output).size / 1024).toFixed(0)} KB, ${frames.length} frames x ${secondsPerFrame}s)`);
