import { assembleProject, getAllFiles, } from "@mpc-se2/core";
export function createAssembleProjectTool(ctx) {
    return {
        handler: async (args) => {
            const generatedCode = {
                contracts: args.contracts,
                pages: args.pages || [],
                tests: args.tests || [],
            };
            // Scope temp paths by session to isolate multi-user projects
            const scopedId = `${ctx.sessionId}-${args.projectId}`;
            const projectPath = await assembleProject(scopedId, generatedCode, args.deployment);
            ctx.projectStore.updateProject(args.projectId, { projectPath });
            // Get file listing
            const files = await getAllFiles(projectPath);
            return {
                projectPath,
                fileCount: files.length,
                files: files.map((f) => f.relativePath),
            };
        },
    };
}
//# sourceMappingURL=assemble.js.map