import { generateContracts, generateFrontend, generateTests, } from "@mpc-se2/core";
import { updateProject } from "../state/project-store.js";
export const generateContractsTool = {
    name: "generate_contracts",
    description: "Generate Solidity smart contracts and Foundry tests from a project plan. Returns contract code and test code. Does NOT generate frontend.",
    inputSchema: {
        type: "object",
        properties: {
            prompt: {
                type: "string",
                description: "Original user prompt",
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
            projectId: {
                type: "string",
                description: "Optional project ID to track state",
            },
        },
        required: ["prompt", "plan"],
    },
    handler: async (args) => {
        const result = await generateContracts(args.prompt, args.plan);
        if (args.projectId) {
            updateProject(args.projectId, {
                code: { contracts: result.contracts, tests: result.tests, pages: [] },
            });
        }
        return result;
    },
};
export const generateFrontendTool = {
    name: "generate_frontend",
    description: "Generate SE2 React frontend pages for existing smart contracts. Call after contracts are compiled and tested.",
    inputSchema: {
        type: "object",
        properties: {
            contracts: {
                type: "array",
                description: "Smart contracts to build UI for",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        content: { type: "string" },
                    },
                    required: ["name", "content"],
                },
            },
            plan: {
                type: "object",
                description: "Project plan",
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
            prompt: {
                type: "string",
                description: "Original user prompt",
            },
            projectId: {
                type: "string",
                description: "Optional project ID",
            },
        },
        required: ["contracts", "plan", "prompt"],
    },
    handler: async (args) => {
        const pages = await generateFrontend(args.contracts, args.plan, args.prompt);
        if (args.projectId) {
            updateProject(args.projectId, {
                code: {
                    contracts: args.contracts,
                    pages,
                    tests: [],
                },
            });
        }
        return { pages };
    },
};
export const generateTestsTool = {
    name: "generate_tests",
    description: "Generate Foundry/Forge tests for existing Solidity contracts.",
    inputSchema: {
        type: "object",
        properties: {
            contracts: {
                type: "array",
                description: "Smart contracts to generate tests for",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        content: { type: "string" },
                    },
                    required: ["name", "content"],
                },
            },
        },
        required: ["contracts"],
    },
    handler: async (args) => {
        const tests = await generateTests(args.contracts);
        return { tests };
    },
};
//# sourceMappingURL=generate.js.map