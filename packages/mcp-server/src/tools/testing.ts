import {
  AnvilManager,
  runForgeTests,
  deployToAnvil,
} from "@mpc-se2/core";
import type { SessionContext } from "../server.js";

export function createStartAnvilTool(ctx: SessionContext) {
  return {
    handler: async (args: {
      projectId: string;
      port?: number;
      forkUrl?: string;
    }) => {
      const result = await ctx.anvilManager.start(args.projectId, {
        port: args.port,
        forkUrl: args.forkUrl,
      });

      ctx.projectStore.updateProject(args.projectId, {
        anvilRpcUrl: result.rpcUrl,
        anvilPort: result.port,
      });

      return result;
    },
  };
}

export function createStopAnvilTool(ctx: SessionContext) {
  return {
    handler: async (args: { projectId: string }) => {
      await ctx.anvilManager.stop(args.projectId);
      ctx.projectStore.updateProject(args.projectId, {
        anvilRpcUrl: undefined,
        anvilPort: undefined,
      });
      return { success: true, message: `Anvil stopped for project ${args.projectId}` };
    },
  };
}

export const runTestsTool = {
  handler: async (args: {
    contracts: { name: string; content: string }[];
    tests: { name: string; content: string }[];
  }) => {
    return await runForgeTests(args.contracts, args.tests);
  },
};

export function createDeployLocalTool(ctx: SessionContext) {
  return {
    handler: async (args: {
      projectId: string;
      rpcUrl: string;
      privateKey?: string;
    }) => {
      const project = ctx.projectStore.getProject(args.projectId);
      if (!project?.projectPath) {
        throw new Error(
          "Project not assembled. Call assemble_project first."
        );
      }

      const privateKey =
        args.privateKey ||
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

      return await deployToAnvil(project.projectPath, args.rpcUrl, privateKey);
    },
  };
}
