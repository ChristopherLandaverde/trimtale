export type NavigationArea = "header" | "nav" | "footer" | "unknown";

export interface NavigationElement {
  id: string;
  text: string;
  href: string;
  area: NavigationArea;
  selector: string;
  groupId?: string;
  groupLabel?: string;
}

export interface ContainerContext {
  accountId: string;
  containerId: string;
  publicId: string;
  name: string;
}

export interface SetupRequest {
  intent: string;
  pageUrl: string;
  measurementId: string;
  navigation: NavigationElement[];
  navigationScope?: import("./navigation-scope.js").NavigationScopeV1;
  container: ContainerContext;
}

export interface SetupProposal {
  id: string;
  specification: import("./contracts.js").TrackingSpecificationV1;
  eventName: "navigation_click";
  pageUrl: string;
  measurementId: string;
  navigation: NavigationElement[];
  navigationScope: import("./navigation-scope.js").NavigationScopeV1;
  warnings: string[];
  preflight: {
    status: "passed" | "failed";
    checks: string[];
  };
  containerFile: GtmContainerExport;
}

export interface FormSetupRequest {
  specification: import("./contracts.js").TrackingSpecificationV1;
  measurementId: string;
  container: ContainerContext;
}

export interface FormSetupProposal {
  id: string;
  specification: import("./contracts.js").TrackingSpecificationV1;
  eventName: "generate_lead";
  measurementId: string;
  warnings: string[];
  preflight: {
    status: "passed";
    checks: string[];
  };
  containerFile: GtmContainerExport;
}

export interface BrowserEvidence {
  navigationId: string;
  clickedAt: string;
  pageUrl: string;
  linkText: string;
  linkUrl: string;
  requests: Array<{
    url: string;
    observedAt: string;
  }>;
}

export interface VerificationVerdict {
  status: "passed" | "failed" | "incomplete";
  browserVerification: "verified" | "failed" | "pending";
  platformConfirmation: "unverified";
  runEvidence?: import("./contracts.js").TrackingRunEvidenceV1;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface GtmParameter {
  type: "TEMPLATE" | "BOOLEAN" | "INTEGER" | "LIST" | "MAP";
  key?: string;
  value?: string;
  list?: GtmParameter[];
  map?: GtmParameter[];
}

export interface GtmContainerExport {
  exportFormatVersion: 2;
  exportTime: string;
  containerVersion: {
    path: string;
    accountId: string;
    containerId: string;
    containerVersionId: string;
    name: string;
    description: string;
    container: {
      path: string;
      accountId: string;
      containerId: string;
      name: string;
      publicId: string;
      usageContext: ["WEB"];
    };
    tag: unknown[];
    trigger: unknown[];
    variable?: unknown[];
    builtInVariable: unknown[];
  };
}
