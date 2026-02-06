import { getAnthropicClient, MODEL } from "./client.js";
import { MODIFY_CONTRACT_PROMPT, MODIFY_PAGE_PROMPT } from "./prompts.js";
import { extractTextContent, parseContracts, parsePages } from "./parsers.js";

export interface ModifyResult {
  contracts?: { name: string; content: string }[];
  pages?: { path: string; content: string }[];
}

export async function modifyCode(
  prompt: string,
  contracts?: { name: string; content: string }[],
  pages?: { path: string; content: string }[]
): Promise<ModifyResult> {
  const client = getAnthropicClient();
  const result: ModifyResult = {};

  // Modify contracts if provided
  if (contracts && contracts.length > 0) {
    const contractsText = contracts
      .map((c) => `--- ${c.name} ---\n${c.content}`)
      .join("\n\n");

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Modify the following Solidity contract(s) based on this request:\n\n## MODIFICATION REQUEST:\n${prompt}\n\n## CURRENT CONTRACT CODE:\n${contractsText}\n\nApply the requested modifications and return the complete modified contract(s) using the exact output format specified.`,
        },
      ],
      system: MODIFY_CONTRACT_PROMPT,
    });

    const responseText = extractTextContent(message);
    const modifiedContracts = parseContracts(responseText);
    if (modifiedContracts.length > 0) {
      result.contracts = modifiedContracts;
    }
  }

  // Modify pages if provided
  if (pages && pages.length > 0) {
    const pagesText = pages
      .map((p) => `--- ${p.path} ---\n${p.content}`)
      .join("\n\n");

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Modify the following React/TypeScript page(s) based on this request:\n\n## MODIFICATION REQUEST:\n${prompt}\n\n## CURRENT PAGE CODE:\n${pagesText}\n\nApply the requested modifications and return the complete modified page(s) using the exact output format specified.`,
        },
      ],
      system: MODIFY_PAGE_PROMPT,
    });

    const responseText = extractTextContent(message);
    const modifiedPages = parsePages(responseText);
    if (modifiedPages.length > 0) {
      result.pages = modifiedPages;
    }
  }

  if (!result.contracts && !result.pages) {
    throw new Error("Could not apply modifications");
  }

  return result;
}
