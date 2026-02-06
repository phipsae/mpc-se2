import { getAnthropicClient, MODEL } from "./client.js";
import { ANALYZE_SYSTEM_PROMPT } from "./prompts.js";
import { extractTextContent, parseJsonResponse } from "./parsers.js";
export async function analyzePrompt(prompt, answers, isFollowUp) {
    const client = getAnthropicClient();
    let userMessage = prompt;
    if (isFollowUp && answers) {
        userMessage = `Original request: ${prompt}\n\nUser's answers to clarification questions:\n${JSON.stringify(answers, null, 2)}\n\nNow create a plan based on this information.`;
    }
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: userMessage }],
        system: ANALYZE_SYSTEM_PROMPT,
    });
    const responseText = extractTextContent(message);
    const jsonResponse = parseJsonResponse(responseText);
    if (!jsonResponse.status) {
        throw new Error("AI returned an invalid response format");
    }
    if (jsonResponse.status === "needs_clarification" && !jsonResponse.questions) {
        throw new Error("AI response missing clarification questions");
    }
    if (jsonResponse.status === "ready" && !jsonResponse.plan) {
        throw new Error("AI response missing project plan");
    }
    return jsonResponse;
}
//# sourceMappingURL=analyze.js.map