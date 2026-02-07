import {
  assembleProject,
  getAllFiles,
  type GeneratedCode,
  type DeploymentInfo,
} from "@mpc-se2/core";
import type { SessionContext } from "../server.js";

export function createAssembleProjectTool(ctx: SessionContext) {
  return {
    handler: async (args: {
      projectId: string;
      contracts: { name: string; content: string }[];
      pages?: { path: string; content: string }[];
      tests?: { name: string; content: string }[];
      deployment?: DeploymentInfo;
    }) => {
      const generatedCode: GeneratedCode = {
        contracts: args.contracts,
        pages: args.pages || [],
        tests: args.tests || [],
      };

      // Scope temp paths by session to isolate multi-user projects
      const scopedId = `${ctx.sessionId}-${args.projectId}`;

      const projectPath = await assembleProject(
        scopedId,
        generatedCode,
        args.deployment
      );

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

export function createExportProjectTool(ctx: SessionContext) {
  return {
    handler: async (args: { projectId: string }) => {
      const project = ctx.projectStore.getProject(args.projectId);
      if (!project?.projectPath) {
        throw new Error(
          `Project "${args.projectId}" not found or not assembled. Call assemble_project first.`
        );
      }

      const allFiles = await getAllFiles(project.projectPath);

      return {
        projectId: args.projectId,
        fileCount: allFiles.length,
        files: allFiles.map((f) => ({
          path: f.relativePath,
          content: f.content,
        })),
      };
    },
  };
}
