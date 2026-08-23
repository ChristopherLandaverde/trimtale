import { describe, expect, it, vi } from "vitest";
import {
  commandNames,
  dispatchAgentCommand,
  resolveAgentCommand,
} from "./agent-harness.mjs";

type CommandExecutor = NonNullable<Parameters<typeof dispatchAgentCommand>[1]>;

describe("agent command harness", () => {
  it("resolves every supported command to a fixed local invocation", () => {
    const expectedCommands = {
      build: ["npm", ["run", "build"], "Build every workspace"],
      "change-docs": ["npm", ["run", "check:change-docs"], "Validate change records"],
      check: ["npm", ["run", "check"], "Run strict TypeScript checks"],
      diff: ["git", ["diff", "--check"], "Check the working diff for whitespace errors"],
      e2e: ["npm", ["run", "test:e2e"], "Run the local browser workflow"],
      inspect: ["git", ["diff", "--stat"], "Summarize working-tree changes"],
      preflight: ["npm", ["run", "preflight"], "Check local workflow readiness"],
      status: ["git", ["status", "--short"], "Show concise repository status"],
      test: ["npm", ["test"], "Run deterministic unit and scenario tests"],
      verify: ["npm", ["run", "verify"], "Run the required completion gate"],
    } as const;

    expect(commandNames).toEqual(Object.keys(expectedCommands).sort());
    for (const [name, [executable, args, description]] of Object.entries(expectedCommands)) {
      expect(resolveAgentCommand([name])).toEqual({ executable, args, description });
    }
  });

  it("executes from the fixed repository root and returns the child status", () => {
    const executor = vi.fn<CommandExecutor>().mockReturnValue({ status: 7 });
    const result = dispatchAgentCommand(["check"], executor);

    expect(result).toBe(7);
    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith("npm", ["run", "check"], {
      cwd: expect.stringMatching(/gtm-observability$/),
      stdio: "inherit",
      env: process.env,
    });
  });

  it.each([
    [["unknown"], "Unknown agent command: unknown"],
    [["test", "--watch"], "Agent command 'test' does not accept arguments"],
    [[], "Missing agent command"],
  ])("rejects invalid input before execution", (args, message) => {
    const executor = vi.fn<CommandExecutor>();
    expect(() => dispatchAgentCommand(args, executor)).toThrow(message);
    expect(executor).not.toHaveBeenCalled();
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
