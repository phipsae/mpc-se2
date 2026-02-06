import { type ProjectPlan } from "@mpc-se2/core";
export declare const generateContractsTool: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
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
            projectId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        prompt: string;
        plan: ProjectPlan;
        projectId?: string;
    }) => Promise<import("@mpc-se2/core").GenerateContractsResult>;
};
export declare const generateFrontendTool: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            contracts: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        name: {
                            type: string;
                        };
                        content: {
                            type: string;
                        };
                    };
                    required: string[];
                };
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
            prompt: {
                type: string;
                description: string;
            };
            projectId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (args: {
        contracts: {
            name: string;
            content: string;
        }[];
        plan: ProjectPlan;
        prompt: string;
        projectId?: string;
    }) => Promise<{
        pages: {
            path: string;
            content: string;
        }[];
    }>;
};
export declare const generateTestsTool: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            contracts: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        name: {
                            type: string;
                        };
                        content: {
                            type: string;
                        };
                    };
                    required: string[];
                };
            };
        };
        required: string[];
    };
    handler: (args: {
        contracts: {
            name: string;
            content: string;
        }[];
    }) => Promise<{
        tests: {
            name: string;
            content: string;
        }[];
    }>;
};
//# sourceMappingURL=generate.d.ts.map