import type { ProjectPlan, GeneratedCode, BuildResult } from "../types.js";
export interface BuildOptions {
    prompt: string;
    plan: ProjectPlan;
    existingCode?: GeneratedCode;
    maxIterations?: number;
    onProgress?: (status: string, message: string, iteration: number) => void;
}
export declare function buildDApp(opts: BuildOptions): Promise<BuildResult>;
//# sourceMappingURL=build-pipeline.d.ts.map