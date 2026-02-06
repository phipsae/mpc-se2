// ============================================================================
// GitHub operations - extracted from lib/github.ts
// ============================================================================

import { Octokit } from "@octokit/rest";
import type { GitHubRepoResult, FileToCommit } from "../types.js";

interface OctokitError extends Error {
  status?: number;
  response?: { headers?: Record<string, string> };
}

function isOctokitError(error: unknown): error is OctokitError {
  return (
    error instanceof Error &&
    typeof (error as OctokitError).status === "number"
  );
}

export async function createRepoAndPushFiles(
  accessToken: string,
  repoName: string,
  description: string,
  files: FileToCommit[],
  retryCount = 0
): Promise<GitHubRepoResult> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    let user;
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      user = data;
    } catch (authError) {
      if (isOctokitError(authError)) {
        if (authError.status === 401) {
          return { success: false, error: "GitHub authentication failed.", errorCode: "AUTH_FAILED" };
        }
        if (authError.status === 403) {
          return { success: false, error: "GitHub access denied.", errorCode: "ACCESS_DENIED" };
        }
      }
      throw authError;
    }

    let repo;
    const finalRepoName = repoName;

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
        if (createError.status === 422 && retryCount < 3) {
          const newRepoName = `${repoName}-${Math.random().toString(36).substring(2, 6)}`;
          return createRepoAndPushFiles(accessToken, newRepoName, description, files, retryCount + 1);
        }
        if (createError.status === 422) {
          return { success: false, error: `Repository name "${repoName}" is not available.`, errorCode: "NAME_TAKEN" };
        }
        if (createError.status === 403) {
          return { success: false, error: "GitHub access denied.", errorCode: "ACCESS_DENIED" };
        }
      }
      throw createError;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const createdRepoName = repo.name;

    const { data: ref } = await octokit.rest.git.getRef({
      owner: user.login,
      repo: createdRepoName,
      ref: "heads/main",
    });

    const latestCommitSha = ref.object.sha;

    const { data: latestCommit } = await octokit.rest.git.getCommit({
      owner: user.login,
      repo: createdRepoName,
      commit_sha: latestCommitSha,
    });

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

    const { data: newTree } = await octokit.rest.git.createTree({
      owner: user.login,
      repo: createdRepoName,
      base_tree: latestCommit.tree.sha,
      tree: blobs,
    });

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: user.login,
      repo: createdRepoName,
      message: "Initial commit from AI dApp Builder",
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.rest.git.updateRef({
      owner: user.login,
      repo: createdRepoName,
      ref: "heads/main",
      sha: newCommit.sha,
    });

    return { success: true, repoUrl: repo.html_url, repoName: repo.name };
  } catch (error) {
    if (isOctokitError(error)) {
      return {
        success: false,
        error: `GitHub error (${error.status}): ${error.message}`,
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

export async function updateRepoFiles(
  accessToken: string,
  repoUrl: string,
  files: FileToCommit[],
  commitMessage = "Update from AI dApp Builder"
): Promise<GitHubRepoResult> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) {
      return { success: false, error: "Invalid GitHub repository URL", errorCode: "INVALID_URL" };
    }
    const [, owner, repoName] = match;

    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo: repoName,
      ref: "heads/main",
    });
    const latestCommitSha = ref.object.sha;

    const { data: latestCommit } = await octokit.rest.git.getCommit({
      owner,
      repo: repoName,
      commit_sha: latestCommitSha,
    });

    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner,
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

    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo: repoName,
      base_tree: latestCommit.tree.sha,
      tree: blobs,
    });

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo: repoName,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.rest.git.updateRef({
      owner,
      repo: repoName,
      ref: "heads/main",
      sha: newCommit.sha,
    });

    return { success: true, repoUrl, repoName };
  } catch (error) {
    if (isOctokitError(error)) {
      return {
        success: false,
        error: `GitHub error (${error.status}): ${error.message}`,
        errorCode: "GITHUB_ERROR",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update repository",
      errorCode: "UNKNOWN",
    };
  }
}

export function generateRepoName(contractName: string): string {
  const baseName = contractName
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/[^a-z0-9-]/g, "-");

  const timestamp = Date.now().toString(36);
  return `${baseName}-dapp-${timestamp}`;
}
