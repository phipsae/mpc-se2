import { analyzePrompt } from "@mpc-se2/core";
import { updateProject } from "../state/project-store.js";
export const analyzePromptTool = {
    name: "analyze_prompt",
    description: "Analyze a natural language prompt describing a dApp. Returns either a structured plan or clarifying questions. Use this as the first step.",
    inputSchema: {
        type: "object",
        properties: {
            prompt: {
                type: "string",
                description: "Natural language description of the dApp to build",
            },
            answers: {
                type: "object",
                description: "Answers to previously asked clarification questions",
                additionalProperties: true,
            },
            projectId: {
                type: "string",
                description: "Optional project ID to track state",
            },
        },
        required: ["prompt"],
    },
    handler: async (args) => {
        const isFollowUp = !!args.answers && Object.keys(args.answers).length > 0;
        const result = await analyzePrompt(args.prompt, args.answers, isFollowUp);
        if (args.projectId) {
            updateProject(args.projectId, {
                prompt: args.prompt,
                plan: result.plan,
            });
        }
        return result;
    },
};
//# sourceMappingURL=analyze.js.map