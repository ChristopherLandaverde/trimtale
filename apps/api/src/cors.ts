export type CorsDecision = {
  allowed: boolean;
  allowOrigin?: string;
};

function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function corsDecision(
  pathname: string,
  requestOrigin: string | undefined,
  configuredExtensionOrigin: string | undefined,
): CorsDecision {
  if (!isApiRoute(pathname)) {
    return { allowed: true, allowOrigin: "*" };
  }

  if (requestOrigin === undefined) {
    return { allowed: true };
  }

  const allowedOrigin = configuredExtensionOrigin?.trim();
  if (!allowedOrigin || allowedOrigin === "*" || allowedOrigin === "null") {
    return { allowed: false };
  }

  return requestOrigin === allowedOrigin
    ? { allowed: true, allowOrigin: allowedOrigin }
    : { allowed: false };
}
