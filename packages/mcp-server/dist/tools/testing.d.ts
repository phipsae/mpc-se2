import type { SessionContext } from "../server.js";
export declare function createStartAnvilTool(ctx: SessionContext): {
    handler: (args: {
        projectId: string;
        port?: number;
        forkUrl?: string;
    }) => Promise<{
        rpcUrl: string;
        port: number;
        accounts: {
            address: string;
            privateKey: string;
        }[];
    }>;
};
export declare function createStopAnvilTool(ctx: SessionContext): {
    handler: (args: {
        projectId: string;
    }) => Promise<{
        success: boolean;
        message: string;
    }>;
};
export declare const runTestsTool: {
    handler: (args: {
        contracts: {
            name: string;
            content: string;
        }[];
        tests: {
            name: string;
            content: string;
        }[];
    }) => Promise<import("@mpc-se2/core").TestResult>;
};
export declare function createDeployLocalTool(ctx: SessionContext): {
    handler: (args: {
        projectId: string;
        rpcUrl: string;
        privateKey?: string;
    }) => Promise<import("@mpc-se2/core").LocalDeployResult>;
};
//# sourceMappingURL=testing.d.ts.map