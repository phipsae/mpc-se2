export declare const compileContractsTool: {
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
                            description: string;
                        };
                        content: {
                            type: string;
                            description: string;
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
    }) => Promise<import("@mpc-se2/core").CompileResult>;
};
export declare const checkSecurityTool: {
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
            bytecode: {
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
        bytecode?: string;
    }) => Promise<{
        security: {
            warnings: import("@mpc-se2/core").SecurityWarning[];
        };
        gas: {
            estimated: string;
            costEth: string;
            costUsd: string;
        };
        size: {
            bytes: number;
            kb: string;
            withinLimit: boolean;
        };
    }>;
};
//# sourceMappingURL=compile.d.ts.map