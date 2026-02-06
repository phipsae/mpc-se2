import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AnvilManager } from "@mpc-se2/core";
import { ProjectStore } from "./state/project-store.js";
export interface SessionContext {
    sessionId: string;
    projectStore: ProjectStore;
    anvilManager: AnvilManager;
}
export declare function createServer(ctx: SessionContext): McpServer;
//# sourceMappingURL=server.d.ts.map