import { type ProjectPlan } from "@mpc-se2/core";
export declare const buildDappTool: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            projectId: {
                type: string;
                description: string;
            };
            prompt: {
                type: string;
                description: string;
            };
            plan: {
                type: string;
                description: string;
                properties: {
                    contractName: {
                        type: string;
                    };
                    description: {
                        type: string;
                    };
                    features: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                    pages: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                path: {
                                    type: string;
                                };
                                description: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
                required: string[];
            };
            existingCode: {
                type: string;
                description: string;
                properties: {
                    contracts: {
                        type: string;
                    };
                    pages: {
                        type: string;
                    };
                    tests: {
                        type: string;
                    };
                };
            };
            maxIterations: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        projectId: string;
        prompt: string;
        plan: ProjectPlan;
        existingCode?: {
            contracts: {
                name: string;
                content: string;
            }[];
            pages: {
                path: string;
                content: string;
            }[];
            tests: {
                name: string;
                content: string;
            }[];
        };
        maxIterations?: number;
    }) => Promise<import("@mpc-se2/core").BuildResult>;
};
//# sourceMappingURL=build.d.ts.map