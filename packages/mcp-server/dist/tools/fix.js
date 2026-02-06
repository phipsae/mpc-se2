import { fixCompilation, fixSecurity, modifyCode, } from "@mpc-se2/core";
export const fixErrorsTool = {
    name: "fix_errors",
    description: "Use AI to fix compilation errors, security issues, or test failures in Solidity contracts. Specify fixType as 'compilation', 'security', or 'tests'.",
    inputSchema: {
        type: "object",
        properties: {
            contracts: {
                type: "array",
                description: "Current contract code",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        content: { type: "string" },
                    },
                    required: ["name", "content"],
                },
            },
            errors: {
                type: "array",
                description: "Error messages to fix (for compilation/security)",
                items: { type: "string" },
            },
            securityWarnings: {
                type: "array",
                description: "Security warnings (for security fixType)",
                items: {
                    type: "object",
                    properties: {
                        severity: { type: "string" },
                        message: { type: "string" },
                        contract: { type: "string" },
                        line: { type: "number" },
                    },
                },
            },
            fixType: {
                type: "string",
                enum: ["compilation", "security"],
                description: "Type of fix to apply",
            },
        },
        required: ["contracts", "fixType"],
    },
    handler: async (args) => {
        if (args.fixType === "compilation") {
            if (!args.errors || args.errors.length === 0) {
                throw new Error("errors array required for compilation fix");
            }
            const fixed = await fixCompilation(args.contracts, args.errors);
            return { contracts: fixed };
        }
        if (args.fixType === "security") {
            if (!args.securityWarnings || args.securityWarnings.length === 0) {
                // Convert string errors to SecurityWarning format
                const warnings = (args.errors || []).map((e) => ({
                    severity: "warning",
                    message: e,
                }));
                const fixed = await fixSecurity(args.contracts, warnings);
                return { contracts: fixed };
            }
            const fixed = await fixSecurity(args.contracts, args.securityWarnings);
            return { contracts: fixed };
        }
        throw new Error(`Unknown fixType: ${args.fixType}`);
    },
};
export const modifyCodeTool = {
    name: "modify_code",
    description: "Use natural language to modify existing Solidity contracts or React frontend code. Describe the changes you want.",
    inputSchema: {
        type: "object",
        properties: {
            prompt: {
                type: "string",
                description: "Natural language description of the modifications",
            },
            contracts: {
                type: "array",
                description: "Contracts to modify (optional)",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        content: { type: "string" },
                    },
                    required: ["name", "content"],
                },
            },
            pages: {
                type: "array",
                description: "Frontend pages to modify (optional)",
                items: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        content: { type: "string" },
                    },
                    required: ["path", "content"],
                },
            },
        },
        required: ["prompt"],
    },
    handler: async (args) => {
        return await modifyCode(args.prompt, args.contracts, args.pages);
    },
};
//# sourceMappingURL=fix.js.map