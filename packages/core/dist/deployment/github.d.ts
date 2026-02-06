import type { GitHubRepoResult, FileToCommit } from "../types.js";
export declare function createRepoAndPushFiles(accessToken: string, repoName: string, description: string, files: FileToCommit[], retryCount?: number): Promise<GitHubRepoResult>;
export declare function updateRepoFiles(accessToken: string, repoUrl: string, files: FileToCommit[], commitMessage?: string): Promise<GitHubRepoResult>;
export declare function generateRepoName(contractName: string): string;
//# sourceMappingURL=github.d.ts.map