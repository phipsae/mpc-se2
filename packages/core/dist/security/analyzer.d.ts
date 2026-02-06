import type { SecurityWarning } from "../types.js";
export declare function analyzeSecurityPatterns(contracts: {
    name: string;
    content: string;
}[]): SecurityWarning[];
export declare function estimateGas(bytecode: string): {
    estimated: string;
    costEth: string;
    costUsd: string;
};
export declare function checkSize(bytecode: string): {
    bytes: number;
    kb: string;
    withinLimit: boolean;
};
//# sourceMappingURL=analyzer.d.ts.map