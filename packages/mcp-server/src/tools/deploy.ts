import {
  createRepoAndPushFiles,
  generateRepoName,
  getAllFiles,
  type FileToCommit,
} from "@mpc-se2/core";
import type { SessionContext } from "../server.js";

export function createPushGithubTool(ctx: SessionContext) {
  return {
    handler: async (args: {
      projectId: string;
      githubToken: string;
      repoName?: string;
      description?: string;
    }) => {
      const project = ctx.projectStore.getProject(args.projectId);
      if (!project?.projectPath) {
        throw new Error("Project not assembled. Call assemble_project first.");
      }

      // Get all files from the assembled project
      const allFiles = await getAllFiles(project.projectPath);
      const files: FileToCommit[] = allFiles.map((f) => ({
        path: f.relativePath,
        content: f.content,
      }));

      const repoName =
        args.repoName ||
        generateRepoName(`dapp-${args.projectId.slice(0, 8)}`);

      const description =
        args.description || "dApp built with AI dApp Builder";

      const result = await createRepoAndPushFiles(
        args.githubToken,
        repoName,
        description,
        files
      );

      return result;
    },
  };
}
