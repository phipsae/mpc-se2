import type { SessionContext } from "../server.js";
export declare function createPushGithubTool(ctx: SessionContext): {
    handler: (args: {
        projectId: string;
        githubToken: string;
        repoName?: string;
        description?: string;
    }) => Promise<import("@mpc-se2/core").GitHubRepoResult>;
};
//# sourceMappingURL=deploy.d.ts.map