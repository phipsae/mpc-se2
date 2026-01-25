import { Octokit } from "@octokit/rest";

export interface GitHubRepoResult {
  success: boolean;
  repoUrl?: string;
  repoName?: string;
  error?: string;
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
  files: FileToCommit[]
): Promise<GitHubRepoResult> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    // Get authenticated user
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // Create the repository
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description,
      private: false,
      auto_init: true, // Initialize with README
    });

    // Wait a moment for the repo to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the default branch's latest commit
    const { data: ref } = await octokit.rest.git.getRef({
      owner: user.login,
      repo: repoName,
      ref: "heads/main",
    });

    const latestCommitSha = ref.object.sha;

    // Get the tree of the latest commit
    const { data: latestCommit } = await octokit.rest.git.getCommit({
      owner: user.login,
      repo: repoName,
      commit_sha: latestCommitSha,
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner: user.login,
          repo: repoName,
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
      repo: repoName,
      base_tree: latestCommit.tree.sha,
      tree: blobs,
    });

    // Create a new commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: user.login,
      repo: repoName,
      message: "Initial commit from AI dApp Builder",
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // Update the reference to point to the new commit
    await octokit.rest.git.updateRef({
      owner: user.login,
      repo: repoName,
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repository",
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
