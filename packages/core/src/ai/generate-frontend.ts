import { getAnthropicClient, MODEL } from "./client.js";
import { GENERATE_FRONTEND_PROMPT } from "./prompts.js";
import { extractTextContent, parsePages } from "./parsers.js";
import { getSE2Docs } from "./se2-docs.js";
import type { ProjectPlan } from "../types.js";

export async function generateFrontend(
  contracts: { name: string; content: string }[],
  plan: ProjectPlan,
  prompt: string
): Promise<{ path: string; content: string }[]> {
  const client = getAnthropicClient();

  const se2Docs = await getSE2Docs();
  const systemPrompt = GENERATE_FRONTEND_PROMPT.replace("{SE2_DOCS}", se2Docs);

  const contractsSummary = contracts
    .map((c) => `### ${c.name}\n\`\`\`solidity\n${c.content}\n\`\`\``)
    .join("\n\n");

  const userMessage = `Create React frontend pages for a dApp with the following contracts:

${contractsSummary}

## Project Plan:
Contract Name: ${plan.contractName}
Description: ${plan.description}
Features: ${plan.features.join(", ")}
Pages needed: ${plan.pages.map((p) => `${p.path} - ${p.description}`).join("; ")}

Original user request: ${prompt}

The contracts have been tested and verified. Generate complete React pages that provide a user-friendly interface for all contract functionality.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const responseText = extractTextContent(message);
  const pages = parsePages(responseText);

  if (pages.length === 0) {
    throw new Error("Could not extract any pages from Claude's response");
  }

  return pages;
}
