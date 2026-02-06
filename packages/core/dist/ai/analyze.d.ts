import type { ClarificationQuestion, ProjectPlan } from "../types.js";
export interface AnalyzeResult {
    status: "ready" | "needs_clarification";
    plan?: ProjectPlan;
    questions?: ClarificationQuestion[];
}
export declare function analyzePrompt(prompt: string, answers?: Record<string, string | number | boolean>, isFollowUp?: boolean): Promise<AnalyzeResult>;
//# sourceMappingURL=analyze.d.ts.map