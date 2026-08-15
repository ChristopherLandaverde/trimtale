import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { validateContainerId } from "../apps/verification-target/src/render.js";

interface Options {
  containerId: string;
  project: string;
}

function options(arguments_: string[]): Options {
  const value = (name: string): string | undefined => {
    const index = arguments_.indexOf(name);
    return index >= 0 ? arguments_[index + 1] : undefined;
  };
  const containerId = value("--container");
  if (!containerId) throw new Error("Pass --container GTM-XXXXXXX.");
  return {
    containerId: validateContainerId(containerId),
    project: value("--project") ?? "consentflow",
  };
}

async function command(
  program: string,
  arguments_: string[],
  cwd: string,
  showOutput = true,
): Promise<string> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(program, arguments_, { cwd, stdio: ["inherit", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      if (showOutput) process.stdout.write(text);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveCommand(output);
      else reject(new Error(`${program} exited with status ${code ?? "unknown"}.`));
    });
  });
}

function deploymentUrl(output: string): string {
  const matches = output.match(/https:\/\/[^\s]+\.vercel\.app/g);
  const url = matches?.at(-1);
  if (!url) throw new Error("Vercel did not return a preview URL.");
  return url;
}

const selected = options(process.argv.slice(2));
const targetDirectory = resolve("apps/verification-target");

await command("vercel", ["link", "--yes", "--project", selected.project], targetDirectory);
const output = await command(
  "vercel",
  ["deploy", "--yes", "--target", "preview", "--build-env", `GTM_CONTAINER_ID=${selected.containerId}`],
  targetDirectory,
);
const url = deploymentUrl(output);
const html = await command("vercel", ["curl", url], targetDirectory, false);
if (!html.includes(`name="gtm-observability-target" content="${selected.containerId}"`)) {
  throw new Error("Preview does not contain the expected GTM container marker.");
}
if (!html.includes(`'${selected.containerId}'`)) {
  throw new Error("Preview does not install the expected GTM script.");
}

console.log(`Verification target ready: ${url}`);
console.log(`Confirmed container: ${selected.containerId}`);
