import { type SecurityWarning } from "@mpc-se2/core";
export declare const fixErrorsTool: {
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
            errors: {
                type: string;
                description: string;
                items: {
                    type: string;
                };
            };
            securityWarnings: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        severity: {
                            type: string;
                        };
                        message: {
                            type: string;
                        };
                        contract: {
                            type: string;
                        };
                        line: {
                            type: string;
                        };
                    };
                };
            };
            fixType: {
                type: string;
                enum: string[];
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
        errors?: string[];
        securityWarnings?: SecurityWarning[];
        fixType: "compilation" | "security";
    }) => Promise<{
        contracts: {
            name: string;
            content: string;
        }[];
    }>;
};
export declare const modifyCodeTool: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            prompt: {
                type: string;
                description: string;
            };
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
            pages: {
                type: string;
                description: string;
                items: {
                    type: string;
                    properties: {
                        path: {
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
        prompt: string;
        contracts?: {
            name: string;
            content: string;
        }[];
        pages?: {
            path: string;
            content: string;
        }[];
    }) => Promise<import("@mpc-se2/core").ModifyResult>;
};
//# sourceMappingURL=fix.d.ts.map