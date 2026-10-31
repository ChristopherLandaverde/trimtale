# README demo builder

Regenerates `docs/media/form-verified.gif`, the four-frame storyboard at the top of the README.
Run it again whenever the assistant panel or the evidence list changes. It is not part of
`npm run verify` or CI.

```bash
npm run build                               # the extension, API and fixture site
node scripts/readme-demo/capture.mjs        # drives the real extension, writes test-results/readme-demo/
node scripts/readme-demo/build.mjs          # renders the frames and writes docs/media/form-verified.gif
```

Needs Playwright's Chromium (`npx playwright install chromium`) and ffmpeg (`FFMPEG=/path/to/ffmpeg`,
otherwise `/opt/homebrew/bin/ffmpeg` or `ffmpeg` on `PATH`). Both scripts start the local API and
fixture site if they are not already running, on the same ports as the E2E tests.

| File | Role |
|---|---|
| `capture.mjs` | Runs two confirmed lead-form journeys on the bundled fixture site: `ajax_success` (correctly tagged) and `missing_required_parameter` (tag sends no form details). Saves panel and page screenshots, the GTM export, the finding copy, the evidence rows and the `/g/collect` URLs Playwright saw into `test-results/readme-demo/run.json`. |
| `frame.html` | The frame layout: ink stage, paper cards, DM Sans and IBM Plex Mono from the extension's bundled fonts, lime only as the verified fill. |
| `build.mjs` | Fills four frames from `run.json`, screenshots them at 880×640 and assembles a two-pass palette GIF, 4 s per frame. It fails if a run's verdict or an expected evidence row is missing. |

Only the headlines and connecting words are written in `build.mjs`; every quoted string, value and
count comes from `run.json`. Nothing contacts Google: the fixture's stand-in GA4 tag sends
`/g/collect` to the fixture itself (`127.0.0.1:14173`).
