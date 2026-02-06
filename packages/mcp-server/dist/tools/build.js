import { buildDApp } from "@mpc-se2/core";
import { updateProject } from "../state/project-store.js";
export const buildDappTool = {
    name: "build_dapp",
    description: "Full automated pipeline: generate contracts -> compile -> fix errors -> security check -> fix -> run tests -> fix. This is the 'auto mode' that iteratively builds and fixes until everything passes (or max iterations). Returns final code, test results, and logs.",
    inputSchema: {
        type: "object",
        properties: {
            projectId: {
                type: "string",
                description: "Project identifier",
            },
            prompt: {
                type: "string",
                description: "User prompt describing the dApp",
            },
            plan: {
                type: "object",
                description: "Project plan from analyze_prompt",
                properties: {
                    contractName: { type: "string" },
                    description: { type: "string" },
                    features: { type: "array", items: { type: "string" } },
                    pages: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                description: { type: "string" },
                            },
                        },
                    },
                },
                required: ["contractName", "description", "features", "pages"],
            },
            existingCode: {
                type: "object",
                description: "Optional existing code to validate instead of generating new",
                properties: {
                    contracts: { type: "array" },
                    pages: { type: "array" },
                    tests: { type: "array" },
                },
            },
            maxIterations: {
                type: "number",
                description: "Maximum fix iterations (default 10)",
            },
        },
        required: ["projectId", "prompt", "plan"],
    },
    handler: async (args) => {
        const result = await buildDApp({
            prompt: args.prompt,
            plan: args.plan,
            existingCode: args.existingCode,
            maxIterations: args.maxIterations,
        });
        updateProject(args.projectId, {
            prompt: args.prompt,
            plan: args.plan,
            code: result.code,
            testResult: result.testResult,
        });
        return result;
    },
};
//# sourceMappingURL=build.js.map