import Anthropic from "@anthropic-ai/sdk";
let client = null;
export function getAnthropicClient() {
    if (!client) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error("ANTHROPIC_API_KEY is not configured");
        }
        client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return client;
}
export const MODEL = "claude-sonnet-4-20250514";
//# sourceMappingURL=client.js.map