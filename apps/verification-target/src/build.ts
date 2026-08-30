import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderVerificationTarget } from "./render.js";

const containerId = process.env.GTM_CONTAINER_ID?.trim() || "GTM-TEST000";
const outputDirectory = resolve(process.cwd(), "dist");

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "index.html"), renderVerificationTarget(containerId));
console.log(`Built verification target for ${containerId}.`);
