// ============================================================================
// Vercel deployment - extracted from lib/vercel.ts
// ============================================================================

import type { VercelDeploymentResult } from "../types.js";

// Helper to safely parse JSON responses from Vercel API
async function jsonBody(res: Response): Promise<Record<string, any>> {
  return (await res.json()) as Record<string, any>;
}

export async function createVercelDeployment(
  accessToken: string,
  githubRepoUrl: string,
  projectName: string
): Promise<VercelDeploymentResult> {
  try {
    const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");
    const [, owner, repo] = match;
    const repoFullName = `${owner}/${repo.replace(/\.git$/, "")}`;

    // Check if project already exists
    const existingProjectResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectName}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (existingProjectResponse.ok) {
      const existingProject = await jsonBody(existingProjectResponse);
      const projectDetailsResponse = await fetch(
        `https://api.vercel.com/v9/projects/${existingProject.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (projectDetailsResponse.ok) {
        const projectDetails = await jsonBody(projectDetailsResponse);
        const repoId = projectDetails.link?.repoId;

        if (repoId) {
          const deployResponse = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: projectName,
              project: existingProject.id,
              target: "production",
              gitSource: { type: "github", repoId, ref: "main" },
            }),
          });

          if (deployResponse.ok) {
            const deployment = await jsonBody(deployResponse);
            try {
              const deploymentUrl = await waitForDeployment(
                accessToken,
                deployment.uid || deployment.id,
                180000
              );
              return { success: true, deploymentUrl, projectId: existingProject.id };
            } catch {
              return {
                success: true,
                deploymentUrl: `https://${projectName}.vercel.app`,
                projectId: existingProject.id,
              };
            }
          }
        }
      }

      return {
        success: false,
        error: "Could not trigger deployment on existing project",
        projectId: existingProject.id,
      };
    }

    // Create new project
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const projectResponse = await fetch("https://api.vercel.com/v9/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          framework: "nextjs",
          gitRepository: { type: "github", repo: repoFullName },
          rootDirectory: "packages/nextjs",
          buildCommand: "yarn build",
          installCommand: "yarn install",
        }),
      });

      if (projectResponse.ok) {
        const project = await jsonBody(projectResponse);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check for auto-deployment
        const deploymentsResponse = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=1`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        let latestDeployment: Record<string, any> | null = null;
        if (deploymentsResponse.ok) {
          const deploymentsData = await jsonBody(deploymentsResponse);
          latestDeployment = deploymentsData.deployments?.[0] ?? null;
        }

        if (latestDeployment) {
          try {
            const deploymentUrl = await waitForDeployment(
              accessToken,
              latestDeployment.uid || latestDeployment.id,
              180000
            );
            return { success: true, deploymentUrl, projectId: project.id };
          } catch {
            return {
              success: true,
              deploymentUrl: `https://${project.name}.vercel.app`,
              projectId: project.id,
            };
          }
        }

        return {
          success: true,
          deploymentUrl: `https://${project.name}.vercel.app`,
          projectId: project.id,
        };
      }

      const errorData = await jsonBody(projectResponse);
      lastError = errorData.error?.message || "Failed to create Vercel project";

      if (!lastError.toLowerCase().includes("repository") && !lastError.toLowerCase().includes("not found")) {
        break;
      }
    }

    throw new Error(lastError || "Failed to create Vercel project after retries");
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deploy to Vercel",
    };
  }
}

async function waitForDeployment(
  accessToken: string,
  deploymentId: string,
  timeout: number
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) throw new Error("Failed to check deployment status");

    const deployment = await jsonBody(response);

    if (deployment.readyState === "READY") {
      return `https://${deployment.url}`;
    }

    if (deployment.readyState === "ERROR" || deployment.readyState === "CANCELED") {
      throw new Error(`Deployment ${deployment.readyState.toLowerCase()}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const deployment = await jsonBody(response);
  return `https://${deployment.url}`;
}

export function generateProjectName(baseName: string): string {
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
