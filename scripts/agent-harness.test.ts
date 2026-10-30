import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  commandNames,
  dispatchAgentCommand,
  resolveAgentCommand,
} from "./agent-harness.mjs";

type CommandExecutor = NonNullable<Parameters<typeof dispatchAgentCommand>[1]>;
// The harness runs from the repository root derived from its own file location,
// not from the checkout folder name, so worktrees and renamed clones behave the same.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commitMessagePath = resolve(repositoryRoot, ".scratch/commit-message.md");

let originalCommitMessage: string | undefined;

beforeEach(() => {
  originalCommitMessage = existsSync(commitMessagePath)
    ? readFileSync(commitMessagePath, "utf8")
    : undefined;
});

afterEach(() => {
  if (originalCommitMessage === undefined) {
    if (existsSync(commitMessagePath)) unlinkSync(commitMessagePath);
  } else {
    writeFileSync(commitMessagePath, originalCommitMessage);
  }
});

describe("agent command harness", () => {
  it("resolves every supported command to a fixed local invocation", () => {
    const expectedCommands = {
      build: ["npm", ["run", "build"], "Build every workspace"],
      "change-docs": ["npm", ["run", "check:change-docs"], "Validate change records"],
      check: ["npm", ["run", "check"], "Run strict TypeScript checks"],
      commit: ["git", ["commit", "--file", ".scratch/commit-message.md"], "Commit staged changes using .scratch/commit-message.md"],
      diff: ["git", ["diff", "--check"], "Check the working diff for whitespace errors"],
      e2e: ["npm", ["run", "test:e2e"], "Run the local browser workflow"],
      inspect: ["git", ["diff", "--stat"], "Summarize working-tree changes"],
      preflight: ["npm", ["run", "preflight"], "Check local workflow readiness"],
      status: ["git", ["status", "--short"], "Show concise repository status"],
      test: ["npm", ["test"], "Run deterministic unit and scenario tests"],
      "update-snapshots": ["npm", ["run", "test:e2e:update-snapshots"], "Update reviewed Playwright visual baselines"],
      verify: ["npm", ["run", "verify"], "Run the required completion gate"],
    } as const;

    expect(commandNames).toEqual(Object.keys(expectedCommands).sort());
    for (const [name, [executable, args, description]] of Object.entries(expectedCommands)) {
      expect(resolveAgentCommand([name])).toMatchObject({ executable, args, description });
    }
  });

  it("executes from the fixed repository root and returns the child status", () => {
    const executor = vi.fn<CommandExecutor>().mockReturnValue({ status: 7 });
    const result = dispatchAgentCommand(["check"], executor);

    expect(result).toBe(7);
    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith("npm", ["run", "check"], {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: process.env,
    });
  });

  it.each([
    [["unknown"], "Unknown agent command: unknown"],
    [["test", "--watch"], "Agent command 'test' does not accept arguments"],
    [["commit", "-m", "message"], "Agent command 'commit' does not accept arguments"],
    [[], "Missing agent command"],
  ])("rejects invalid input before execution", (args, message) => {
    const executor = vi.fn<CommandExecutor>();
    expect(() => dispatchAgentCommand(args, executor)).toThrow(message);
    expect(executor).not.toHaveBeenCalled();
  });

  it("routes visual baseline updates through a fixed npm script", () => {
    const command = resolveAgentCommand(["update-snapshots"]);
    expect(command).toEqual({
      executable: "npm",
      args: ["run", "test:e2e:update-snapshots"],
      description: "Update reviewed Playwright visual baselines",
    });
    expect(() => resolveAgentCommand(["update-snapshots", "--update-snapshots"])).toThrow(
      "Agent command 'update-snapshots' does not accept arguments",
    );
  });

  it("commits staged changes from a fixed message file and removes it after success", () => {
    writeFileSync(commitMessagePath, "Harness commit message\n");
    const executor = vi.fn<CommandExecutor>()
      .mockReturnValueOnce({ status: 0, stdout: "feature/testing\n" })
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    expect(dispatchAgentCommand(["commit"], executor)).toBe(0);
    expect(executor).toHaveBeenNthCalledWith(1, "git", ["branch", "--show-current"], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "inherit"],
      env: process.env,
      encoding: "utf8",
    });
    expect(executor).toHaveBeenNthCalledWith(2, "git", ["diff", "--cached", "--quiet"], {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: process.env,
    });
    expect(executor).toHaveBeenNthCalledWith(3, "git", ["commit", "--file", ".scratch/commit-message.md"], {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: process.env,
    });
    expect(existsSync(commitMessagePath)).toBe(false);
  });

  it.each([
    ["missing", undefined, "Commit message file is missing: .scratch/commit-message.md"],
    ["empty", "  \n", "Commit message file is empty: .scratch/commit-message.md"],
  ])("refuses to commit with a %s message file", (_name, message, expected) => {
    if (message === undefined) {
      if (existsSync(commitMessagePath)) unlinkSync(commitMessagePath);
    } else {
      writeFileSync(commitMessagePath, message);
    }
    const executor = vi.fn<CommandExecutor>();
    const writeOutput = vi.fn();

    expect(dispatchAgentCommand(["commit"], executor, writeOutput)).toBe(2);
    expect(executor).not.toHaveBeenCalled();
    expect(writeOutput).toHaveBeenCalledWith(expected);
  });

  it("refuses to commit on main", () => {
    writeFileSync(commitMessagePath, "Harness commit message\n");
    const executor = vi.fn<CommandExecutor>().mockReturnValue({ status: 0, stdout: "main\n" });
    const writeOutput = vi.fn();

    expect(dispatchAgentCommand(["commit"], executor, writeOutput)).toBe(2);
    expect(executor).toHaveBeenCalledOnce();
    expect(writeOutput).toHaveBeenCalledWith("Refusing to commit on main.");
  });

  it("refuses to commit when nothing is staged", () => {
    writeFileSync(commitMessagePath, "Harness commit message\n");
    const executor = vi.fn<CommandExecutor>()
      .mockReturnValueOnce({ status: 0, stdout: "feature/testing\n" })
      .mockReturnValueOnce({ status: 0 });
    const writeOutput = vi.fn();

    expect(dispatchAgentCommand(["commit"], executor, writeOutput)).toBe(2);
    expect(executor).toHaveBeenCalledTimes(2);
    expect(writeOutput).toHaveBeenCalledWith("Refusing to commit because nothing is staged.");
  });

  it("keeps risky executable surfaces outside the allowlist", () => {
    for (const name of commandNames) {
      const command = resolveAgentCommand([name]);
      expect(["npm", "git"]).toContain(command.executable);
      expect(command.executable).not.toBe("npx");
      expect(command.args).not.toContain("install");
      expect(command.args).not.toContain("push");
      expect(command.args).not.toContain("reset");
    }
  });

  it("prints help without starting a child process", () => {
    const executor = vi.fn<CommandExecutor>();
    const writeOutput = vi.fn();
    expect(dispatchAgentCommand(["help"], executor, writeOutput)).toBe(0);
    expect(executor).not.toHaveBeenCalled();
    expect(writeOutput).toHaveBeenCalledWith(expect.stringContaining("npm run agent -- <command>"));
  });
});
