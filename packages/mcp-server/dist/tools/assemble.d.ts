import { type DeploymentInfo } from "@mpc-se2/core";
import type { SessionContext } from "../server.js";
export declare function createAssembleProjectTool(ctx: SessionContext): {
    handler: (args: {
        projectId: string;
        contracts: {
            name: string;
            content: string;
        }[];
        pages?: {
            path: string;
            content: string;
        }[];
        tests?: {
            name: string;
            content: string;
        }[];
        deployment?: DeploymentInfo;
    }) => Promise<{
        projectPath: string;
        fileCount: number;
        files: string[];
    }>;
};
//# sourceMappingURL=assemble.d.ts.map