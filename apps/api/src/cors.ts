export type CorsDecision = {
  allowed: boolean;
  allowOrigin?: string;
};

function isGoogleRoute(pathname: string): boolean {
  return pathname === "/api/google" || pathname.startsWith("/api/google/");
}

export function corsDecision(
  pathname: string,
  requestOrigin: string | undefined,
  configuredExtensionOrigin: string | undefined,
): CorsDecision {
  if (!isGoogleRoute(pathname)) {
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
