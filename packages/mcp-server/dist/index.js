#!/usr/bin/env node
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AnvilManager } from "@mpc-se2/core";
import { ProjectStore } from "./state/project-store.js";
import { createServer } from "./server.js";
const { values } = parseArgs({
    options: {
        stdio: { type: "boolean", default: false },
        port: { type: "string" },
    },
    strict: false,
});
async function runStdio() {
    const ctx = {
        sessionId: "stdio",
        projectStore: new ProjectStore(),
        anvilManager: new AnvilManager(),
    };
    const server = createServer(ctx);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MPC-SE2 MCP Server running on stdio");
    const shutdown = async () => {
        await ctx.anvilManager.stopAll();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
async function runHttp(port) {
    // Dynamic import to avoid loading express when using stdio
    const { startHttpServer } = await import("./http-server.js");
    startHttpServer(port);
}
async function main() {
    if (values.stdio) {
        await runStdio();
    }
    else {
        const port = parseInt(String(values.port || process.env.PORT || "3000"), 10);
        await runHttp(port);
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map