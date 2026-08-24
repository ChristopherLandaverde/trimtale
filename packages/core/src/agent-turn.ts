import type { ConversationIntakeResult } from "./conversation.js";

export type AgentTaskStatus =
  | "working"
  | "completed"
  | "needs_input"
  | "ready_for_review"
  | "blocked"
  | "unsupported";

export type AgentPlanStageId = "understand" | "inspect" | "target" | "review" | "verify";
export type AgentPlanStageStatus = "completed" | "active" | "pending" | "blocked";

export interface AgentPlanStageV1 {
  id: AgentPlanStageId;
  label: string;
  status: AgentPlanStageStatus;
  kind: "work" | "approval";
}

export interface AgentActionReceiptV1 {
  id: "page-inspected" | "gtm-connected";
  label: string;
  detail: string;
  status: "completed";
}

export interface AgentTurnV1 {
  schemaVersion: 1;
  task: {
    goal: string;
    status: AgentTaskStatus;
    summary: string;
  };
  plan: AgentPlanStageV1[];
  question?: string;
  actions: Array<{ id: string; label: string }>;
  receipts: AgentActionReceiptV1[];
}

export interface AgentTurnContext {
  formCount: number;
  navigationCount: number;
  connection?: {
    publicId: string;
    measurementId?: string;
  };
}

function boundedCount(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 999) : 0;
}

function pageDetail(context: AgentTurnContext): string {
  const forms = boundedCount(context.formCount);
  const navigation = boundedCount(context.navigationCount);
  return `${forms} form${forms === 1 ? "" : "s"} · ${navigation} navigation link${navigation === 1 ? "" : "s"}`;
}

function countWord(count: number): string {
  if (count === 0) return "no";
  if (count === 1) return "one";
  if (count === 2) return "two";
  return String(count);
}

function plan(
  targetStatus: AgentPlanStageStatus,
  reviewStatus: AgentPlanStageStatus = "pending",
  verifyStatus: AgentPlanStageStatus = "pending",
): AgentPlanStageV1[] {
  return [
    { id: "understand", label: "Understand the outcome", status: "completed", kind: "work" },
    { id: "inspect", label: "Inspect this page", status: "completed", kind: "work" },
    { id: "target", label: "Confirm measurement scope", status: targetStatus, kind: "work" },
    { id: "review", label: "Review tracking setup", status: reviewStatus, kind: "approval" },
    { id: "verify", label: "Run verification", status: verifyStatus, kind: "work" },
  ];
}

function safeConnection(context: AgentTurnContext): AgentActionReceiptV1 | undefined {
  const publicId = context.connection?.publicId.trim().toUpperCase();
  const measurementId = context.connection?.measurementId?.trim().toUpperCase();
  if (!publicId || !/^GTM-[A-Z0-9]+$/.test(publicId)) return undefined;
  const detail = measurementId && /^G-[A-Z0-9]+$/.test(measurementId)
    ? `${publicId} · ${measurementId}`
    : publicId;
  return { id: "gtm-connected", label: "Connected measurement context", detail, status: "completed" };
}

export function agentTurnForIntake(
  intake: ConversationIntakeResult,
  context: AgentTurnContext,
): AgentTurnV1 {
  const receipts: AgentActionReceiptV1[] = [{
    id: "page-inspected",
    label: "Page inspected",
    detail: pageDetail(context),
    status: "completed",
  }];
  const connection = safeConnection(context);
  if (connection) receipts.push(connection);
  const actions = intake.options.map((action) => ({ id: action.id, label: action.label }));

  if (intake.interaction === "navigation_click") {
    const count = boundedCount(context.navigationCount);
    return {
      schemaVersion: 1,
      task: {
        goal: "Set up navigation click tracking",
        status: count > 0 ? "needs_input" : "blocked",
        summary: count > 0
          ? `I found ${count} navigation link${count === 1 ? "" : "s"}. Use all of them or narrow the scope.`
          : "I could not find an observable navigation link on this page.",
      },
      plan: plan(count > 0 ? "active" : "blocked"),
      ...(count > 0 ? { question: "Should I track every navigation link or only selected links?" } : {}),
      actions,
      receipts,
    };
  }

  if (intake.interaction === "form_submission") {
    const count = boundedCount(context.formCount);
    if (intake.state === "insufficient_evidence") {
      return {
        schemaVersion: 1,
        task: {
          goal: "Set up lead-form tracking",
          status: "blocked",
          summary: count === 0
            ? "I could not find an observable form on this page."
            : "I found the form but not a safe observable signal that proves it succeeded.",
        },
        plan: plan("blocked"),
        actions,
        receipts,
      };
    }
    if (intake.state === "awaiting_target") {
      return {
        schemaVersion: 1,
        task: {
          goal: "Set up lead-form tracking",
          status: "needs_input",
          summary: `I found ${countWord(count)} forms and need you to choose which one represents a qualified inquiry.`,
        },
        plan: plan("active"),
        question: "Which form should count as a lead?",
        actions,
        receipts,
      };
    }
    if (intake.state === "awaiting_success_evidence") {
      return {
        schemaVersion: 1,
        task: {
          goal: "Set up lead-form tracking",
          status: "needs_input",
          summary: `I found ${intake.target?.label ?? "the selected form"}. Now I need the signal that proves a successful outcome.`,
        },
        plan: plan("active"),
        question: "What should prove that this form succeeded?",
        actions,
        receipts,
      };
    }
    if (intake.state === "draft_ready") {
      return {
        schemaVersion: 1,
        task: {
          goal: "Set up lead-form tracking",
          status: "ready_for_review",
          summary: `I can track successful ${intake.target?.label ?? "form"} submissions as generate_lead without counting submit attempts or validation errors.`,
        },
        plan: plan("completed", "active"),
        question: "Review the grounded setup before I generate anything.",
        actions,
        receipts,
      };
    }
  }

  if (intake.state === "unsupported") {
    return {
      schemaVersion: 1,
      task: {
        goal: "Set up measurement for this interaction",
        status: "unsupported",
        summary: `I understand this as ${intake.interaction.replaceAll("_", " ")} tracking, which is not supported in this build yet.`,
      },
      plan: plan("blocked"),
      actions: [],
      receipts,
    };
  }

  return {
    schemaVersion: 1,
    task: {
      goal: "Define a tracking task",
      status: "needs_input",
      summary: "Tell me the measurable outcome you want, and I will ground it in what is visible on this page.",
    },
    plan: [
      { id: "understand", label: "Understand the outcome", status: "active", kind: "work" },
      { id: "inspect", label: "Inspect this page", status: "completed", kind: "work" },
      { id: "target", label: "Confirm measurement scope", status: "pending", kind: "work" },
      { id: "review", label: "Review tracking setup", status: "pending", kind: "approval" },
      { id: "verify", label: "Run verification", status: "pending", kind: "work" },
    ],
    question: "What user outcome should be measured?",
    actions,
    receipts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

export function isAgentTurnV1(value: unknown): value is AgentTurnV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.task)) return false;
  const statuses = new Set<unknown>(["working", "completed", "needs_input", "ready_for_review", "blocked", "unsupported"]);
  if (!boundedText(value.task.goal, 160)
    || !statuses.has(value.task.status)
    || !boundedText(value.task.summary, 500)
    || (value.question !== undefined && !boundedText(value.question, 240))
    || !Array.isArray(value.plan)
    || value.plan.length < 1
    || value.plan.length > 8
    || !Array.isArray(value.actions)
    || value.actions.length > 20
    || !Array.isArray(value.receipts)
    || value.receipts.length > 10) return false;
  const stageIds = new Set<unknown>(["understand", "inspect", "target", "review", "verify"]);
  const stageStatuses = new Set<unknown>(["completed", "active", "pending", "blocked"]);
  if (!value.plan.every((stage) => isRecord(stage)
    && stageIds.has(stage.id)
    && boundedText(stage.label, 100)
    && stageStatuses.has(stage.status)
    && (stage.kind === "work" || stage.kind === "approval"))) return false;
  if (!value.actions.every((action) => isRecord(action)
    && boundedText(action.id, 128)
    && /^[-:a-zA-Z0-9_]+$/.test(action.id)
    && boundedText(action.label, 120))) return false;
  return value.receipts.every((receipt) => isRecord(receipt)
    && (receipt.id === "page-inspected" || receipt.id === "gtm-connected")
    && boundedText(receipt.label, 120)
    && boundedText(receipt.detail, 240)
    && receipt.status === "completed");
}
