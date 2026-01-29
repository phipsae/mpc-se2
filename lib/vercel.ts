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
      // Project exists - check for deployments or trigger one
      const existingProject = await existingProjectResponse.json();
      console.log("Project already exists, checking deployments...");

      // Check for existing deployments
      const deploymentsResponse = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${existingProject.id}&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (deploymentsResponse.ok) {
        const deploymentsData = await deploymentsResponse.json();
        const latestDeployment = deploymentsData.deployments?.[0];

        if (latestDeployment && latestDeployment.readyState === "READY") {
          const deploymentUrl = latestDeployment.url 
            ? `https://${latestDeployment.url}`
            : `https://${projectName}.vercel.app`;
          
          return {
            success: true,
            deploymentUrl,
            projectId: existingProject.id,
          };
        }
      }

      // No deployment or not ready - trigger a new deployment
      console.log("No ready deployment found, triggering new deployment...");
      
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
            repo: repoFullName,
            ref: "main",
          },
        }),
      });

      if (deployResponse.ok) {
        const deployment = await deployResponse.json();
        
        // Wait for deployment to be ready
        const deploymentUrl = await waitForDeployment(
          accessToken,
          deployment.id,
          120000
        );

        return {
          success: true,
          deploymentUrl,
          projectId: existingProject.id,
        };
      }

      // If deployment trigger failed, return project URL anyway
      const deployError = await deployResponse.json();
      console.error("Failed to trigger deployment:", deployError);
      
      return {
        success: true,
        deploymentUrl: `https://${projectName}.vercel.app`,
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
          buildCommand: "npm run build",
          installCommand: "npm install",
        }),
      });

      if (projectResponse.ok) {
        const project: VercelProject = await projectResponse.json();
        console.log("Vercel project created:", project.name);

        // Wait for GitHub to sync with Vercel
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Check if auto-deployment started
        let deploymentsResponse = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        let deploymentsData = deploymentsResponse.ok ? await deploymentsResponse.json() : { deployments: [] };
        let latestDeployment = deploymentsData.deployments?.[0];

        // If no auto-deployment, trigger one manually
        if (!latestDeployment) {
          console.log("No auto-deployment detected, triggering manually...");
          
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
                repo: repoFullName,
                ref: "main",
              },
            }),
          });

          if (deployResponse.ok) {
            latestDeployment = await deployResponse.json();
            console.log("Manual deployment triggered:", latestDeployment.id);
          } else {
            const deployError = await deployResponse.json();
            console.error("Failed to trigger manual deployment:", deployError);
            
            // Try alternative deployment method using source files
            console.log("Trying alternative deployment method...");
            const altDeployResponse = await fetch("https://api.vercel.com/v13/deployments", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: projectName,
                project: project.id,
                target: "production",
              }),
            });
            
            if (altDeployResponse.ok) {
              latestDeployment = await altDeployResponse.json();
              console.log("Alternative deployment triggered:", latestDeployment.id);
            } else {
              const altError = await altDeployResponse.json();
              console.error("Alternative deployment also failed:", altError);
            }
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
            // Return project URL even if deployment wait failed
            return {
              success: true,
              deploymentUrl: `https://${project.name}.vercel.app`,
              projectId: project.id,
            };
          }
        }

        // No deployment could be triggered - return project URL
        console.log("No deployment available, returning project URL");
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
