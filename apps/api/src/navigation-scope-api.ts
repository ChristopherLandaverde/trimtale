import {
  validateNavigationScopeInterpretationInput,
  type NavigationScopeInterpretationInputV1,
} from "@gtm-observability/core";
import type { LocalNavigationScopeProvider } from "./ollama-navigation-scope-provider.js";

export interface NavigationScopeApiResult {
  status: number;
  body: unknown;
}

export async function navigationScopeApiResponse(
  method: string,
  pathname: string,
  body: unknown,
  provider: LocalNavigationScopeProvider | undefined,
  timeoutMs = 30_000,
): Promise<NavigationScopeApiResult | undefined> {
  if (pathname !== "/api/agent/navigation-scope") return undefined;
  if (method !== "POST") return { status: 405, body: { error: "Method not allowed." } };
  if (validateNavigationScopeInterpretationInput(body).length > 0) {
    return { status: 400, body: { error: "Navigation scope request is invalid." } };
  }
  if (!provider) {
    return {
      status: 503,
      body: { error: "The local agent model is disabled.", code: "local_model_disabled" },
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const interpretation = await provider.interpret(
      structuredClone(body) as NavigationScopeInterpretationInputV1,
      controller.signal,
    );
    return {
      status: 200,
      body: {
        interpretation,
        provider: { id: provider.id, model: provider.model },
      },
    };
  } catch {
    return {
      status: 503,
      body: { error: "The local agent model is unavailable.", code: "local_model_unavailable" },
    };
  } finally {
    clearTimeout(timeout);
  }
}
