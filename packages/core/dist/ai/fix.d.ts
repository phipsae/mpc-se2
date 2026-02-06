import type { SecurityWarning } from "../types.js";
export declare function fixCompilation(contracts: {
    name: string;
    content: string;
}[], errors: string[]): Promise<{
    name: string;
    content: string;
}[]>;
export declare function fixSecurity(contracts: {
    name: string;
    content: string;
}[], warnings: SecurityWarning[]): Promise<{
    name: string;
    content: string;
}[]>;
export declare function fixTestFailures(contracts: {
    name: string;
    content: string;
}[], tests: {
    name: string;
    content: string;
}[], testOutput: string): Promise<{
    contracts: {
        name: string;
        content: string;
    }[];
    tests: {
        name: string;
        content: string;
    }[];
}>;
//# sourceMappingURL=fix.d.ts.map