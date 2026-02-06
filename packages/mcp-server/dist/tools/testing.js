import { runForgeTests, deployToAnvil, } from "@mpc-se2/core";
export function createStartAnvilTool(ctx) {
    return {
        handler: async (args) => {
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
export function createStopAnvilTool(ctx) {
    return {
        handler: async (args) => {
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
    handler: async (args) => {
        return await runForgeTests(args.contracts, args.tests);
    },
};
export function createDeployLocalTool(ctx) {
    return {
        handler: async (args) => {
            const project = ctx.projectStore.getProject(args.projectId);
            if (!project?.projectPath) {
                throw new Error("Project not assembled. Call assemble_project first.");
            }
            const privateKey = args.privateKey ||
                "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
            return await deployToAnvil(project.projectPath, args.rpcUrl, privateKey);
        },
    };
}
//# sourceMappingURL=testing.js.map