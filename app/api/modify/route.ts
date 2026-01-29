import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODIFY_CONTRACT_PROMPT = `You are an expert Solidity developer helping users modify their smart contracts based on natural language requests.

Your task is to understand the user's modification request and update the contract code accordingly while preserving all existing functionality that wasn't explicitly asked to change.

## REQUIREMENTS:
- Implement the requested changes accurately
- Preserve all existing functionality that wasn't asked to change
- Maintain code quality, security best practices, and proper documentation
- Use Solidity ^0.8.20 or later
- Keep the same contract name unless asked to change it

## IMPORTANT: OpenZeppelin v5 Import Paths
We use OpenZeppelin v5.0.0. Use these correct import paths:

- @openzeppelin/contracts/token/ERC20/ERC20.sol
- @openzeppelin/contracts/token/ERC20/IERC20.sol
- @openzeppelin/contracts/token/ERC721/ERC721.sol
- @openzeppelin/contracts/token/ERC1155/ERC1155.sol
- @openzeppelin/contracts/access/Ownable.sol
- @openzeppelin/contracts/access/AccessControl.sol
- @openzeppelin/contracts/utils/ReentrancyGuard.sol (NOT security/ReentrancyGuard.sol)
- @openzeppelin/contracts/utils/Pausable.sol (NOT security/Pausable.sol)
- @openzeppelin/contracts/utils/math/Math.sol

## OUTPUT FORMAT:
You MUST output your response in this EXACT format using code fence markers:

---CONTRACT: ContractName.sol---
\`\`\`solidity
// Full modified contract code here
\`\`\`

Include ALL contracts. Each must be preceded by the marker line.`;

const MODIFY_PAGE_PROMPT = `You are an expert React/TypeScript developer helping users modify their dApp frontend code based on natural language requests.

Your task is to understand the user's modification request and update the frontend code accordingly.

## REQUIREMENTS:
- Implement the requested changes accurately
- Preserve all existing functionality that wasn't asked to change
- Use TypeScript with proper typing
- Follow React best practices
- The project uses:
  - Next.js 14+ with App Router
  - Wagmi v2 for blockchain interactions
  - TailwindCSS for styling
  - shadcn/ui components

## OUTPUT FORMAT:
You MUST output your response in this EXACT format:

---PAGE: path/to/page.tsx---
\`\`\`typescript
// Full modified page code here
\`\`\`

Include ALL pages that need modification. Each must be preceded by the marker line.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts, pages, prompt } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { status: "error", error: "Modification prompt is required" },
        { status: 400 }
      );
    }

    if ((!contracts || contracts.length === 0) && (!pages || pages.length === 0)) {
      return NextResponse.json(
        { status: "error", error: "At least contracts or pages must be provided" },
        { status: 400 }
      );
    }

    const fixedCode: {
      contracts?: { name: string; content: string }[];
      pages?: { path: string; content: string }[];
    } = {};

    // Modify contracts if provided
    if (contracts && contracts.length > 0) {
      const contractsText = contracts
        .map((c: { name: string; content: string }) => `--- ${c.name} ---\n${c.content}`)
        .join("\n\n");

      const contractMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `Modify the following Solidity contract(s) based on this request:

## MODIFICATION REQUEST:
${prompt}

## CURRENT CONTRACT CODE:
${contractsText}

Apply the requested modifications and return the complete modified contract(s) using the exact output format specified.`,
          },
        ],
        system: MODIFY_CONTRACT_PROMPT,
      });

      const contractTextContent = contractMessage.content.find((c) => c.type === "text");
      if (contractTextContent && contractTextContent.type === "text") {
        const responseText = contractTextContent.text;

        // Parse contracts from ---CONTRACT: Name.sol--- markers
        const modifiedContracts: { name: string; content: string }[] = [];
        const contractMatches = responseText.matchAll(
          /---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi
        );
        for (const match of contractMatches) {
          modifiedContracts.push({
            name: match[1].trim(),
            content: match[2].trim(),
          });
        }

        // Fallback: try to find any solidity code blocks
        if (modifiedContracts.length === 0) {
          const solidityBlocks = responseText.matchAll(/```solidity\s*([\s\S]*?)```/gi);
          let i = 0;
          for (const match of solidityBlocks) {
            const originalName = contracts[i]?.name || `Contract${i > 0 ? i + 1 : ""}.sol`;
            modifiedContracts.push({
              name: originalName,
              content: match[1].trim(),
            });
            i++;
          }
        }

        if (modifiedContracts.length > 0) {
          fixedCode.contracts = modifiedContracts;
        }
      }
    }

    // Modify pages if provided and prompt seems to be about frontend
    const frontendKeywords = ["page", "ui", "frontend", "button", "component", "display", "show", "style", "css", "design", "layout"];
    const isFrontendRequest = frontendKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword)
    );

    if (pages && pages.length > 0 && isFrontendRequest) {
      const pagesText = pages
        .map((p: { path: string; content: string }) => `--- ${p.path} ---\n${p.content}`)
        .join("\n\n");

      const pageMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `Modify the following React/TypeScript page(s) based on this request:

## MODIFICATION REQUEST:
${prompt}

## CURRENT PAGE CODE:
${pagesText}

Apply the requested modifications and return the complete modified page(s) using the exact output format specified.`,
          },
        ],
        system: MODIFY_PAGE_PROMPT,
      });

      const pageTextContent = pageMessage.content.find((c) => c.type === "text");
      if (pageTextContent && pageTextContent.type === "text") {
        const responseText = pageTextContent.text;

        // Parse pages from ---PAGE: path.tsx--- markers
        const modifiedPages: { path: string; content: string }[] = [];
        const pageMatches = responseText.matchAll(
          /---PAGE:\s*([^\n-]+)---\s*```(?:typescript|tsx)?\s*([\s\S]*?)```/gi
        );
        for (const match of pageMatches) {
          modifiedPages.push({
            path: match[1].trim(),
            content: match[2].trim(),
          });
        }

        // Fallback: try to find any typescript code blocks
        if (modifiedPages.length === 0) {
          const tsBlocks = responseText.matchAll(/```(?:typescript|tsx)\s*([\s\S]*?)```/gi);
          let i = 0;
          for (const match of tsBlocks) {
            const originalPath = pages[i]?.path || `page${i > 0 ? i + 1 : ""}.tsx`;
            modifiedPages.push({
              path: originalPath,
              content: match[1].trim(),
            });
            i++;
          }
        }

        if (modifiedPages.length > 0) {
          fixedCode.pages = modifiedPages;
        }
      }
    }

    // If no modifications were made, return an error
    if (!fixedCode.contracts && !fixedCode.pages) {
      return NextResponse.json({
        status: "error",
        error: "Could not apply modifications. Please try rephrasing your request.",
      });
    }

    return NextResponse.json({
      status: "success",
      fixedCode,
    });
  } catch (error) {
    console.error("Modify error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Modification failed",
      },
      { status: 500 }
    );
  }
}
