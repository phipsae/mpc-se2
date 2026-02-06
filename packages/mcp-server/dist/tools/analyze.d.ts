export declare const analyzePromptTool: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            prompt: {
                type: string;
                description: string;
            };
            answers: {
                type: string;
                description: string;
                additionalProperties: boolean;
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
        answers?: Record<string, string | number | boolean>;
        projectId?: string;
    }) => Promise<import("@mpc-se2/core").AnalyzeResult>;
};
//# sourceMappingURL=analyze.d.ts.map