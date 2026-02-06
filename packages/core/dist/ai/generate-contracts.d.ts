import type { ProjectPlan } from "../types.js";
export interface GenerateContractsResult {
    contracts: {
        name: string;
        content: string;
    }[];
    tests: {
        name: string;
        content: string;
    }[];
}
export declare function generateContracts(prompt: string, plan: ProjectPlan, answers?: Record<string, string | number | boolean>): Promise<GenerateContractsResult>;
//# sourceMappingURL=generate-contracts.d.ts.map