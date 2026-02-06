export interface VercelDeploymentResult {
  success: boolean;
  deploymentUrl?: string;
  projectId?: string;
  error?: string;
}

interface VercelProject {
  id: string;
  name: string;
}

interface VercelDeployment {
  id: string;
  url: string;
  readyState: string;
}

/**
 * Creates a Vercel project from a GitHub repository and triggers deployment
 */
export async function createVercelDeployment(
  accessToken: string,
  githubRepoUrl: string,
  projectName: string
): Promise<VercelDeploymentResult> {
  try {
    // Extract owner and repo from GitHub URL
    const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error("Invalid GitHub repository URL");
    }
    const [, owner, repo] = match;
    const repoFullName = `${owner}/${repo.replace(/\.git$/, "")}`;

    // First, check if project already exists
    const existingProjectResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectName}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (existingProjectResponse.ok) {
      // Project exists - trigger a new deployment
      const existingProject = await existingProjectResponse.json();
      console.log("Project already exists, triggering new deployment...");

      // Fetch project details to get repoId
      const projectDetailsResponse = await fetch(
        `https://api.vercel.com/v9/projects/${existingProject.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (projectDetailsResponse.ok) {
        const projectDetails = await projectDetailsResponse.json();
        const repoId = projectDetails.link?.repoId;
        
        if (repoId) {
          console.log("Triggering deployment with repoId:", repoId);
          
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
              gitSource: {
                type: "github",
                repoId: repoId,
                ref: "main",
              },
            }),
          });

          if (deployResponse.ok) {
            const deployment = await deployResponse.json();
            console.log("Deployment triggered:", deployment.id);
            
            try {
              const deploymentUrl = await waitForDeployment(
                accessToken,
                deployment.uid || deployment.id,
                180000
              );
              
              return {
                success: true,
                deploymentUrl,
                projectId: existingProject.id,
              };
            } catch (waitError) {
              console.error("Error waiting for deployment:", waitError);
              return {
                success: true,
                deploymentUrl: `https://${projectName}.vercel.app`,
                projectId: existingProject.id,
              };
            }
          } else {
            const deployError = await deployResponse.json();
            const errorMessage = deployError.error?.message || JSON.stringify(deployError);
            console.error("Failed to trigger deployment:", errorMessage);
            
            return {
              success: false,
              error: `Failed to trigger deployment: ${errorMessage}`,
              projectId: existingProject.id,
            };
          }
        } else {
          console.error("Project not linked to GitHub (no repoId found)");
          return {
            success: false,
            error: "Project is not linked to a GitHub repository. Please check your Vercel project settings.",
            projectId: existingProject.id,
          };
        }
      }

      // Fallback - couldn't fetch project details
      console.error("Could not fetch project details");
      return {
        success: false,
        error: "Could not fetch project details from Vercel",
        projectId: existingProject.id,
      };
    }

    // Project doesn't exist - create it with retries
    let lastError: string = "";
    
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt + 1} - waiting for GitHub repo to sync...`);
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
          gitRepository: {
            type: "github",
            repo: repoFullName,
          },
          rootDirectory: "packages/nextjs",
          buildCommand: "yarn build",
          installCommand: "yarn install",
          // Environment variables for the dApp
          environmentVariables: [
            {
              key: "NEXT_PUBLIC_ALCHEMY_API_KEY",
              value: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
              target: ["production", "preview", "development"],
              type: "plain",
            },
            {
              key: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", 
              value: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
              target: ["production", "preview", "development"],
              type: "plain",
            },
          ].filter(env => env.value), // Only include vars that have values
        }),
      });

      if (projectResponse.ok) {
        const project: VercelProject = await projectResponse.json();
        console.log("Vercel project created:", project.name);

        // Wait a moment for GitHub link to be established
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Fetch project details to get the linked repoId
        const projectDetailsResponse = await fetch(
          `https://api.vercel.com/v9/projects/${project.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        let repoId: number | null = null;
        if (projectDetailsResponse.ok) {
          const projectDetails = await projectDetailsResponse.json();
          repoId = projectDetails.link?.repoId;
          console.log("Got linked repoId:", repoId);
        }

        // Check for auto-deployment first
        let latestDeployment = null;
        const deploymentsResponse = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (deploymentsResponse.ok) {
          const deploymentsData = await deploymentsResponse.json();
          latestDeployment = deploymentsData.deployments?.[0];
        }

        // If no auto-deployment and we have repoId, trigger manually
        if (!latestDeployment && repoId) {
          console.log("No auto-deployment detected, triggering with repoId...");
          
          const deployResponse = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: projectName,
              project: project.id,
              target: "production",
              gitSource: {
                type: "github",
                repoId: repoId,
                ref: "main",
              },
            }),
          });

          if (deployResponse.ok) {
            latestDeployment = await deployResponse.json();
            console.log("Manual deployment triggered:", latestDeployment.id);
          } else {
            const deployError = await deployResponse.json();
            console.error("Failed to trigger deployment:", deployError);
          }
        }

        if (latestDeployment) {
          try {
            const deploymentUrl = await waitForDeployment(
              accessToken,
              latestDeployment.uid || latestDeployment.id,
              180000 // 3 minutes timeout
            );

            return {
              success: true,
              deploymentUrl,
              projectId: project.id,
            };
          } catch (waitError) {
            console.error("Error waiting for deployment:", waitError);
            const errorMsg = waitError instanceof Error ? waitError.message : "Unknown error";
            
            // If deployment errored or was canceled, report the failure
            if (errorMsg.includes("error") || errorMsg.includes("canceled")) {
              return {
                success: false,
                error: `Vercel build failed: ${errorMsg}. Check vercel.com/dashboard for build logs.`,
                projectId: project.id,
              };
            }
            
            // If it's just taking too long, return the URL with a warning
            return {
              success: true,
              deploymentUrl: `https://${project.name}.vercel.app`,
              projectId: project.id,
            };
          }
        }

        // Project was created but no deployment could be triggered
        // Return success with URL - Vercel will deploy on next push
        console.log("Project created, deployment pending. Push to GitHub to trigger.");
        return {
          success: true,
          deploymentUrl: `https://${project.name}.vercel.app`,
          projectId: project.id,
        };
      }

      const errorData = await projectResponse.json();
      lastError = errorData.error?.message || "Failed to create Vercel project";
      console.error(`Vercel project creation failed (attempt ${attempt + 1}):`, lastError);
      
      // If it's "already exists", it was just created - fetch it
      if (lastError.toLowerCase().includes("already exists")) {
        const fetchExisting = await fetch(
          `https://api.vercel.com/v9/projects/${projectName}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (fetchExisting.ok) {
          const existingProject = await fetchExisting.json();
          return {
            success: true,
            deploymentUrl: `https://${projectName}.vercel.app`,
            projectId: existingProject.id,
          };
        }
      }
      
      // Check for GitHub integration issues
      if (lastError.toLowerCase().includes("github") || 
          lastError.toLowerCase().includes("integration") ||
          lastError.toLowerCase().includes("installation")) {
        throw new Error(
          "Vercel cannot access your GitHub repository. Please ensure you have connected Vercel to GitHub: " +
          "Go to vercel.com → Settings → Integrations → GitHub and grant access to your repositories."
        );
      }
      
      // If it's not a "repo not found" error, don't retry
      if (!lastError.toLowerCase().includes("repository") && 
          !lastError.toLowerCase().includes("not found")) {
        break;
      }
    }

    throw new Error(lastError || "Failed to create Vercel project after retries");
  } catch (error) {
    console.error("Vercel API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deploy to Vercel",
    };
  }
}

/**
 * Waits for a deployment to be ready
 */
async function waitForDeployment(
  accessToken: string,
  deploymentId: string,
  timeout: number
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to check deployment status");
    }

    const deployment = await response.json();

    if (deployment.readyState === "READY") {
      return `https://${deployment.url}`;
    }

    if (deployment.readyState === "ERROR" || deployment.readyState === "CANCELED") {
      throw new Error(`Deployment ${deployment.readyState.toLowerCase()}`);
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Return the URL even if not ready yet (user can check status)
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const deployment = await response.json();
  return `https://${deployment.url}`;
}

/**
 * Generates a Vercel-compatible project name
 */
export function generateProjectName(baseName: string): string {
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
