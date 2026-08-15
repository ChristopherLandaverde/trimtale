import type { NavigationElement } from "./types.js";

export function normalizeNavigation(
  navigation: NavigationElement[],
): NavigationElement[] {
  const seen = new Set<string>();

  return navigation
    .map((item) => ({
      ...item,
      text: item.text.replace(/\s+/g, " ").trim() || "Untitled link",
      href: item.href.trim(),
      selector: item.selector.trim(),
    }))
    .filter((item) => {
      if (!item.href || !item.selector) return false;
      const key = `${item.selector}\u0000${item.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function isNavigationIntent(intent: string): boolean {
  return /\b(nav(?:igation)?|menu|header|footer)\b/i.test(intent) &&
    /\b(click|track|tag|measure)\w*\b/i.test(intent);
}
