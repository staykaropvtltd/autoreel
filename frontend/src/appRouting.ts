export type PrivateDestination = "dashboard" | "studio";
export type WorkflowRoute =
  | "analyzing"
  | "review"
  | "plan"
  | "generating"
  | "editor";

export type AppRoute =
  | { type: "landing" }
  | { type: "auth"; mode: "signin" | "signup"; returnTo: PrivateDestination | null; workflowRecovery: boolean }
  | { type: "private"; destination: PrivateDestination | WorkflowRoute }
  | { type: "unknown" };

const PRIVATE_DESTINATIONS = new Set<PrivateDestination>(["dashboard", "studio"]);
const WORKFLOW_ROUTES = new Set<WorkflowRoute>([
  "analyzing",
  "review",
  "plan",
  "generating",
  "editor",
]);

export function safeReturnDestination(value: string | null): PrivateDestination | null {
  if (!value) return null;
  const normalized = value.replace(/^#\/?/, "").replace(/^\//, "");
  return PRIVATE_DESTINATIONS.has(normalized as PrivateDestination)
    ? (normalized as PrivateDestination)
    : null;
}

export function parseAppHash(hash: string): AppRoute {
  if (!hash || hash === "#" || hash === "#/") return { type: "landing" };

  const routeText = hash.slice(1).replace(/^\//, "");
  const queryIndex = routeText.indexOf("?");
  const path = (queryIndex < 0 ? routeText : routeText.slice(0, queryIndex)).replace(/\/$/, "");
  const params = new URLSearchParams(queryIndex < 0 ? "" : routeText.slice(queryIndex + 1));

  if (path === "signin" || path === "signup") {
    return {
      type: "auth",
      mode: path,
      returnTo: safeReturnDestination(params.get("returnTo")),
      workflowRecovery: params.get("workflowRecovery") === "1",
    };
  }
  if (path === "dashboard" || path === "studio") {
    return { type: "private", destination: path };
  }
  if (WORKFLOW_ROUTES.has(path as WorkflowRoute)) {
    return { type: "private", destination: path as WorkflowRoute };
  }
  return { type: "unknown" };
}

export function hashForScreen(screen: string): string {
  if (screen === "landing") return "";
  return `#${screen === "upload" ? "studio" : screen}`;
}

export function signInHash(returnTo: PrivateDestination, workflowRecovery = false): string {
  const recoveryParam = workflowRecovery ? "&workflowRecovery=1" : "";
  return `#signin?returnTo=${encodeURIComponent(returnTo)}${recoveryParam}`;
}

export function isWorkflowRoute(
  destination: PrivateDestination | WorkflowRoute,
): destination is WorkflowRoute {
  return WORKFLOW_ROUTES.has(destination as WorkflowRoute);
}

export function signInDestinationFor(route: AppRoute): PrivateDestination | null {
  if (route.type === "auth") return route.returnTo;
  if (route.type !== "private") return null;
  return isWorkflowRoute(route.destination) ? "studio" : route.destination;
}

export interface WorkflowAvailability {
  analysisRunning: boolean;
  generationRunning: boolean;
  hasAnalysis: boolean;
  hasPlan: boolean;
  hasGeneratedReel: boolean;
}

export function canRestoreWorkflowRoute(
  destination: WorkflowRoute,
  state: WorkflowAvailability,
): boolean {
  switch (destination) {
    case "analyzing": return state.analysisRunning;
    case "review": return state.hasAnalysis;
    case "plan": return state.hasAnalysis && state.hasPlan;
    case "generating": return state.hasPlan && state.generationRunning;
    case "editor": return state.hasGeneratedReel && state.hasPlan;
  }
}
