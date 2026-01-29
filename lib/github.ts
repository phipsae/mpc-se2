import { Octokit } from "@octokit/rest";

// Type guard for Octokit errors
interface OctokitError extends Error {
  status?: number;
  response?: {
    headers?: Record<string, string>;
  };
}

function isOctokitError(error: unknown): error is OctokitError {
  return error instanceof Error && typeof (error as OctokitError).status === "number";
}

export interface GitHubRepoResult {
  success: boolean;
  repoUrl?: string;
  repoName?: string;
  error?: string;
  errorCode?: string;
}

export interface FileToCommit {
  path: string;
  content: string;
}

/**
 * Creates a new GitHub repository and pushes files to it
 */
export async function createRepoAndPushFiles(
  accessToken: string,
  repoName: string,
  description: string,
  files: FileToCommit[],
  retryCount = 0
): Promise<GitHubRepoResult> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    // Get authenticated user
    let user;
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      user = data;
    } catch (authError) {
      if (isOctokitError(authError)) {
        if (authError.status === 401) {
          return {
            success: false,
            error: "GitHub authentication failed. Please reconnect your GitHub account.",
            errorCode: "AUTH_FAILED",
          };
        }
        if (authError.status === 403) {
          return {
            success: false,
            error: "GitHub access denied. Please ensure you granted the necessary permissions.",
            errorCode: "ACCESS_DENIED",
          };
        }
      }
      throw authError;
    }

    // Create the repository with retry logic for name conflicts
    let repo;
    let finalRepoName = repoName;
    
    try {
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: finalRepoName,
        description,
        private: false,
        auto_init: true,
      });
      repo = data;
    } catch (createError) {
      if (isOctokitError(createError)) {
        // Handle repo name already exists
        if (createError.status === 422 && retryCount < 3) {
          // Try with a different name
          const newRepoName = `${repoName}-${Math.random().toString(36).substring(2, 6)}`;
          console.log(`Repository ${repoName} exists, trying ${newRepoName}`);
          return createRepoAndPushFiles(accessToken, newRepoName, description, files, retryCount + 1);
        }
        
        if (createError.status === 422) {
          return {
            success: false,
            error: `Repository name "${repoName}" is not available. Please try a different name.`,
            errorCode: "NAME_TAKEN",
          };
        }
        
        if (createError.status === 403) {
          // Check if it's a rate limit
          const rateLimitRemaining = createError.response?.headers?.["x-ratelimit-remaining"];
          if (rateLimitRemaining === "0") {
            return {
              success: false,
              error: "GitHub API rate limit exceeded. Please wait a few minutes and try again.",
              errorCode: "RATE_LIMITED",
            };
          }
          return {
            success: false,
            error: "GitHub access denied. Your account may not have permission to create repositories.",
            errorCode: "ACCESS_DENIED",
          };
        }
        
        if (createError.status === 404) {
          return {
            success: false,
            error: "GitHub API not found. Please reconnect your GitHub account.",
            errorCode: "NOT_FOUND",
          };
        }
      }
      throw createError;
    }

    // Wait a moment for the repo to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Use the actual created repo name (might be different from original if retry happened)
    const createdRepoName = repo.name;

    // Get the default branch's latest commit
    const { data: ref } = await octokit.rest.git.getRef({
      owner: user.login,
      repo: createdRepoName,
      ref: "heads/main",
    });

    const latestCommitSha = ref.object.sha;

    // Get the tree of the latest commit
    const { data: latestCommit } = await octokit.rest.git.getCommit({
      owner: user.login,
      repo: createdRepoName,
      commit_sha: latestCommitSha,
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner: user.login,
          repo: createdRepoName,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        });
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      })
    );

    // Create a new tree with all the files
    const { data: newTree } = await octokit.rest.git.createTree({
      owner: user.login,
      repo: createdRepoName,
      base_tree: latestCommit.tree.sha,
      tree: blobs,
    });

    // Create a new commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: user.login,
      repo: createdRepoName,
      message: "Initial commit from AI dApp Builder",
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // Update the reference to point to the new commit
    await octokit.rest.git.updateRef({
      owner: user.login,
      repo: createdRepoName,
      ref: "heads/main",
      sha: newCommit.sha,
    });

    return {
      success: true,
      repoUrl: repo.html_url,
      repoName: repo.name,
    };
  } catch (error) {
    console.error("GitHub API error:", error);
    
    // Provide specific error messages based on the error type
    if (isOctokitError(error)) {
      const status = error.status;
      const message = error.message;
      
      if (status === 401) {
        return {
          success: false,
          error: "GitHub session expired. Please reconnect your GitHub account.",
          errorCode: "AUTH_EXPIRED",
        };
      }
      
      if (status === 403) {
        return {
          success: false,
          error: "GitHub permission denied. Please ensure you have the 'repo' scope enabled.",
          errorCode: "PERMISSION_DENIED",
        };
      }
      
      if (status === 404) {
        return {
          success: false,
          error: "GitHub repository not found. It may have been deleted or renamed.",
          errorCode: "REPO_NOT_FOUND",
        };
      }
      
      if (status === 422) {
        return {
          success: false,
          error: `GitHub validation error: ${message}`,
          errorCode: "VALIDATION_ERROR",
        };
      }
      
      if (status === 500 || status === 502 || status === 503) {
        return {
          success: false,
          error: "GitHub is experiencing issues. Please try again in a few minutes.",
          errorCode: "GITHUB_DOWN",
        };
      }
      
      return {
        success: false,
        error: `GitHub error (${status}): ${message}`,
        errorCode: "GITHUB_ERROR",
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repository",
      errorCode: "UNKNOWN",
    };
  }
}

/**
 * Generates a unique repository name based on the project
 */
export function generateRepoName(contractName: string): string {
  const baseName = contractName
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/[^a-z0-9-]/g, "-");
  
  const timestamp = Date.now().toString(36);
  return `${baseName}-dapp-${timestamp}`;
}
