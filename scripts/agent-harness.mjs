import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commitMessagePath = resolve(repositoryRoot, ".scratch/commit-message.md");
const commitMessageDisplayPath = ".scratch/commit-message.md";

const commands = {
  build: {
    executable: "npm",
    args: ["run", "build"],
    description: "Build every workspace",
  },
  "change-docs": {
    executable: "npm",
    args: ["run", "check:change-docs"],
    description: "Validate change records",
  },
  check: {
    executable: "npm",
    args: ["run", "check"],
    description: "Run strict TypeScript checks",
  },
  commit: {
    executable: "git",
    args: ["commit", "--file", commitMessageDisplayPath],
    description: "Commit staged changes using .scratch/commit-message.md",
    preflight: "commit",
  },
  diff: {
    executable: "git",
    args: ["diff", "--check"],
    description: "Check the working diff for whitespace errors",
  },
  e2e: {
    executable: "npm",
    args: ["run", "test:e2e"],
    description: "Run the local browser workflow",
  },
  inspect: {
    executable: "git",
    args: ["diff", "--stat"],
    description: "Summarize working-tree changes",
  },
  preflight: {
    executable: "npm",
    args: ["run", "preflight"],
    description: "Check local workflow readiness",
  },
  status: {
    executable: "git",
    args: ["status", "--short"],
    description: "Show concise repository status",
  },
  test: {
    executable: "npm",
    args: ["test"],
    description: "Run deterministic unit and scenario tests",
  },
  "update-snapshots": {
    executable: "npm",
    args: ["run", "test:e2e:update-snapshots"],
    description: "Update reviewed Playwright visual baselines",
  },
  verify: {
    executable: "npm",
    args: ["run", "verify"],
    description: "Run the required completion gate",
  },
};

export const commandNames = Object.freeze(Object.keys(commands).sort());

function helpText() {
  const width = Math.max(...commandNames.map((name) => name.length));
  const entries = commandNames.map((name) => `  ${name.padEnd(width)}  ${commands[name].description}`);
  return [
    "Usage: npm run agent -- <command>",
    "",
    "Allowed local commands:",
    ...entries,
    "",
    "No command accepts additional arguments.",
  ].join("\n");
}

export function resolveAgentCommand(args) {
  const [name, ...extraArgs] = args;
  if (!name) throw new Error("Missing agent command");
  if (!Object.hasOwn(commands, name)) throw new Error(`Unknown agent command: ${name}`);
  if (extraArgs.length > 0) throw new Error(`Agent command '${name}' does not accept arguments`);
  return commands[name];
}

const execute = (executable, args, options) => spawnSync(executable, args, options);

function checkedStatus(result, label) {
  if (result.error) throw result.error;
  if (result.status === null) throw new Error(`${label} ended without an exit status`);
  return result.status;
}

function runCommitCommand(command, executor, writeOutput) {
  if (!existsSync(commitMessagePath)) {
    writeOutput(`Commit message file is missing: ${commitMessageDisplayPath}`);
    return 2;
  }
  const message = readFileSync(commitMessagePath, "utf8").trim();
  if (!message) {
    writeOutput(`Commit message file is empty: ${commitMessageDisplayPath}`);
    return 2;
  }

  const branch = executor("git", ["branch", "--show-current"], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env,
    encoding: "utf8",
  });
  const branchStatus = checkedStatus(branch, "Branch check");
  if (branchStatus !== 0) return branchStatus;
  if (String(branch.stdout ?? "").trim() === "main") {
    writeOutput("Refusing to commit on main.");
    return 2;
  }

  const staged = executor("git", ["diff", "--cached", "--quiet"], {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: process.env,
  });
  const stagedStatus = checkedStatus(staged, "Staged diff check");
  if (stagedStatus === 0) {
    writeOutput("Refusing to commit because nothing is staged.");
    return 2;
  }
  if (stagedStatus !== 1) return stagedStatus;

  const commit = executor(command.executable, command.args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: process.env,
  });
  const commitStatus = checkedStatus(commit, "Commit command");
  if (commitStatus === 0) unlinkSync(commitMessagePath);
  return commitStatus;
}

export function dispatchAgentCommand(
  args,
  executor = execute,
  writeOutput = console.log,
) {
  if (args.length === 1 && args[0] === "help") {
    writeOutput(helpText());
    return 0;
  }

  const command = resolveAgentCommand(args);
  if (command.preflight === "commit") {
    return runCommitCommand(command, executor, writeOutput);
  }
  const result = executor(command.executable, command.args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: process.env,
  });
  return checkedStatus(result, `Agent command '${args[0]}'`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = dispatchAgentCommand(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(helpText());
    process.exitCode = 2;
  }
}
