import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AnvilManager } from "@mpc-se2/core";
import { ProjectStore } from "./state/project-store.js";

// Import tool factories
import { compileContractsTool, checkSecurityTool } from "./tools/compile.js";
import { createAssembleProjectTool } from "./tools/assemble.js";
import {
  createStartAnvilTool,
  createStopAnvilTool,
  runTestsTool,
  createDeployLocalTool,
} from "./tools/testing.js";
import { createPushGithubTool } from "./tools/deploy.js";

export interface SessionContext {
  sessionId: string;
  projectStore: ProjectStore;
  anvilManager: AnvilManager;
}

export function createServer(ctx: SessionContext): McpServer {
  const server = new McpServer({
    name: "mpc-se2",
    version: "0.2.0",
  });

  // Create context-bound tool instances
  const assembleProjectTool = createAssembleProjectTool(ctx);
  const startAnvilTool = createStartAnvilTool(ctx);
  const stopAnvilTool = createStopAnvilTool(ctx);
  const deployLocalTool = createDeployLocalTool(ctx);
  const pushGithubTool = createPushGithubTool(ctx);

  // Register 8 infrastructure tools

  // 1. compile_contracts
  server.tool(
    "compile_contracts",
    "Compile Solidity contracts using solc with automatic OpenZeppelin v5 import resolution from unpkg CDN. Returns ABI, bytecode, errors, and warnings.",
    {
      contracts: z.array(z.object({ name: z.string(), content: z.string() })),
    },
    async (args) => {
      try {
        const result = await compileContractsTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 2. check_security
  server.tool(
    "check_security",
    "Run security pattern analysis (reentrancy, unchecked calls, tx.origin, etc.) and gas estimation on Solidity contracts.",
    {
      contracts: z.array(z.object({ name: z.string(), content: z.string() })),
      bytecode: z.string().optional().describe("Compiled bytecode for gas estimation"),
    },
    async (args) => {
      try {
        const result = await checkSecurityTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 3. run_tests
  server.tool(
    "run_tests",
    "Run Foundry/Forge tests. Creates a temporary Foundry project, installs OpenZeppelin, and runs `forge test -vvv`. Returns per-test pass/fail results.",
    {
      contracts: z.array(z.object({ name: z.string(), content: z.string() })),
      tests: z.array(z.object({ name: z.string(), content: z.string() })),
    },
    async (args) => {
      try {
        const result = await runTestsTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 4. assemble_project
  server.tool(
    "assemble_project",
    "Build a complete Scaffold-ETH 2 project directory from contracts, tests, and pages. Copies the SE2 template and injects generated code. Returns project path on disk.",
    {
      projectId: z.string().describe("Unique project ID"),
      contracts: z.array(z.object({ name: z.string(), content: z.string() })),
      pages: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
      tests: z.array(z.object({ name: z.string(), content: z.string() })).optional(),
    },
    async (args) => {
      try {
        const result = await assembleProjectTool.handler(args as Parameters<typeof assembleProjectTool.handler>[0]);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 5. start_anvil
  server.tool(
    "start_anvil",
    "Start a local Anvil testnet. Returns RPC URL and funded test accounts with private keys.",
    {
      projectId: z.string().describe("Project ID"),
      port: z.number().optional().describe("Port number"),
      forkUrl: z.string().optional().describe("RPC URL to fork from (e.g., mainnet)"),
    },
    async (args) => {
      try {
        const result = await startAnvilTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 6. stop_anvil
  server.tool(
    "stop_anvil",
    "Stop a running Anvil testnet instance.",
    {
      projectId: z.string().describe("Project ID"),
    },
    async (args) => {
      try {
        const result = await stopAnvilTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 7. deploy_local
  server.tool(
    "deploy_local",
    "Deploy contracts to any EVM network (local Anvil or remote like Sepolia/Base/Optimism) using forge script. Requires assemble_project first.",
    {
      projectId: z.string().describe("Project ID"),
      rpcUrl: z.string().describe("RPC URL (e.g., http://127.0.0.1:8545 for Anvil, or Sepolia/Base RPC)"),
      privateKey: z.string().optional().describe("Deployer private key (defaults to Anvil account 0)"),
    },
    async (args) => {
      try {
        const result = await deployLocalTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  // 8. push_github
  server.tool(
    "push_github",
    "Push an assembled project to a new GitHub repository.",
    {
      projectId: z.string().describe("Project ID"),
      githubToken: z.string().describe("GitHub personal access token"),
      repoName: z.string().optional().describe("Repository name"),
      description: z.string().optional().describe("Repo description"),
    },
    async (args) => {
      try {
        const result = await pushGithubTool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }], isError: true };
      }
    }
  );

  return server;
}
