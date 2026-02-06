import type { TestResult } from "../types.js";
export declare function parseForgeOutput(output: string, success: boolean): TestResult;
export declare function runForgeTests(contracts: {
    name: string;
    content: string;
}[], tests: {
    name: string;
    content: string;
}[]): Promise<TestResult>;
//# sourceMappingURL=forge-runner.d.ts.map