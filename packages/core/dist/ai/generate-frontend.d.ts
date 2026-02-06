import type { ProjectPlan } from "../types.js";
export declare function generateFrontend(contracts: {
    name: string;
    content: string;
}[], plan: ProjectPlan, prompt: string): Promise<{
    path: string;
    content: string;
}[]>;
//# sourceMappingURL=generate-frontend.d.ts.map