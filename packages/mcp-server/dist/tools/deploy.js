import { createRepoAndPushFiles, generateRepoName, getAllFiles, } from "@mpc-se2/core";
export function createPushGithubTool(ctx) {
    return {
        handler: async (args) => {
            const project = ctx.projectStore.getProject(args.projectId);
            if (!project?.projectPath) {
                throw new Error("Project not assembled. Call assemble_project first.");
            }
            // Get all files from the assembled project
            const allFiles = await getAllFiles(project.projectPath);
            const files = allFiles.map((f) => ({
                path: f.relativePath,
                content: f.content,
            }));
            const repoName = args.repoName ||
                generateRepoName(`dapp-${args.projectId.slice(0, 8)}`);
            const description = args.description || "dApp built with AI dApp Builder";
            const result = await createRepoAndPushFiles(args.githubToken, repoName, description, files);
            return result;
        },
    };
}
//# sourceMappingURL=deploy.js.map