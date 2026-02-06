export declare function fetchOpenZeppelinContract(importPath: string): Promise<string | null>;
export declare function resolveImports(sources: Record<string, {
    content: string;
}>, resolved?: Set<string>): Promise<void>;
export interface CompileResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    abi?: unknown[];
    bytecode?: string;
    deployedBytecode?: string;
}
export declare function compileContracts(contracts: {
    name: string;
    content: string;
}[]): Promise<CompileResult>;
//# sourceMappingURL=solc-compiler.d.ts.map