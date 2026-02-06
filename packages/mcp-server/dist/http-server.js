// ============================================================================
// HTTP server for public MCP access via Streamable HTTP transport
// ============================================================================
import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { AnvilManager } from "@mpc-se2/core";
import { ProjectStore } from "./state/project-store.js";
import { createServer } from "./server.js";
const sessions = new Map();
export function startHttpServer(port) {
    const app = createMcpExpressApp({ host: "0.0.0.0" });
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", sessions: sessions.size });
    });
    // POST /mcp — Handle initialize (new session) or route to existing session
    app.post("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        try {
            if (sessionId && sessions.has(sessionId)) {
                // Route to existing session
                const entry = sessions.get(sessionId);
                await entry.transport.handleRequest(req, res, req.body);
                return;
            }
            if (!sessionId && isInitializeRequest(req.body)) {
                // New session — create isolated context
                const ctx = {
                    sessionId: randomUUID(),
                    projectStore: new ProjectStore(),
                    anvilManager: new AnvilManager(),
                };
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => ctx.sessionId,
                    onsessioninitialized: (sid) => {
                        console.error(`[HTTP] Session initialized: ${sid}`);
                        sessions.set(sid, { transport, ctx });
                    },
                });
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && sessions.has(sid)) {
                        console.error(`[HTTP] Session closed: ${sid}`);
                        const entry = sessions.get(sid);
                        entry?.ctx.anvilManager.stopAll().catch(() => { });
                        sessions.delete(sid);
                    }
                };
                const server = createServer(ctx);
                await server.connect(transport);
                await transport.handleRequest(req, res, req.body);
                return;
            }
            // Invalid request
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session ID provided" },
                id: null,
            });
        }
        catch (error) {
            console.error("[HTTP] Error handling POST /mcp:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: { code: -32603, message: "Internal server error" },
                    id: null,
                });
            }
        }
    });
    // GET /mcp — SSE stream for server-initiated messages
    app.get("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        if (!sessionId || !sessions.has(sessionId)) {
            res.status(400).send("Invalid or missing session ID");
            return;
        }
        const entry = sessions.get(sessionId);
        await entry.transport.handleRequest(req, res);
    });
    // DELETE /mcp — Close session, cleanup Anvil processes
    app.delete("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        if (!sessionId || !sessions.has(sessionId)) {
            res.status(400).send("Invalid or missing session ID");
            return;
        }
        try {
            const entry = sessions.get(sessionId);
            await entry.ctx.anvilManager.stopAll();
            await entry.transport.handleRequest(req, res);
        }
        catch (error) {
            console.error("[HTTP] Error handling DELETE /mcp:", error);
            if (!res.headersSent) {
                res.status(500).send("Error processing session termination");
            }
        }
    });
    // Graceful shutdown
    const shutdown = async () => {
        console.error("[HTTP] Shutting down...");
        for (const [sid, entry] of sessions) {
            try {
                await entry.ctx.anvilManager.stopAll();
                await entry.transport.close();
            }
            catch (e) {
                console.error(`[HTTP] Error closing session ${sid}:`, e);
            }
        }
        sessions.clear();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
    app.listen(port, () => {
        console.error(`MPC-SE2 MCP Server (HTTP) listening on port ${port}`);
        console.error(`Health check: http://localhost:${port}/health`);
    });
}
//# sourceMappingURL=http-server.js.map