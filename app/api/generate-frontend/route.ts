import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache for SE2 docs
let se2DocsCache: string | null = null;

async function getSE2Docs(): Promise<string> {
  if (se2DocsCache) return se2DocsCache;
  
  try {
    const response = await fetch("https://docs.scaffoldeth.io/llms-full.txt");
    if (response.ok) {
      se2DocsCache = await response.text();
      return se2DocsCache;
    }
  } catch (error) {
    console.error("Failed to fetch SE2 docs:", error);
  }
  return "";
}

const GENERATE_FRONTEND_PROMPT = `You are an expert React developer specializing in Scaffold-ETH 2 projects.

Your task is to generate production-ready React frontend pages that interact with the provided smart contracts.

## REACT/FRONTEND REQUIREMENTS:
You MUST use Scaffold-ETH 2 patterns. Here's the documentation:

{SE2_DOCS}

KEY SE2 PATTERNS TO USE:
- useScaffoldReadContract for reading contract data
- useScaffoldWriteContract for transactions
- <Address /> component for displaying addresses
- <Balance /> component for displaying ETH balances
- <EtherInput /> for ETH amount inputs
- Use TailwindCSS and daisyUI for styling

## IMPORTANT NOTES:
- The contracts have already been tested and verified
- Generate pages that provide a complete user interface for all contract functionality
- Include proper loading states and error handling
- Make the UI intuitive and user-friendly
- Use proper TypeScript types

## OUTPUT FORMAT:
You MUST output your response in this EXACT format using code fence markers:

---PAGE: app/pagename/page.tsx---
\`\`\`tsx
// Full React component code here
\`\`\`

You can include multiple pages. Each must be preceded by the marker line.
DO NOT generate any Solidity contracts or tests - only React pages.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured. Please add it to your .env file." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { contracts, plan, prompt } = body;

    if (!contracts || !plan) {
      return NextResponse.json(
        { error: "Contracts and plan are required" },
        { status: 400 }
      );
    }

    // Get SE2 docs
    const se2Docs = await getSE2Docs();
    const systemPrompt = GENERATE_FRONTEND_PROMPT.replace("{SE2_DOCS}", se2Docs);

    // Create a summary of contract functions for the frontend
    const contractsSummary = contracts.map((c: { name: string; content: string }) => {
      return `### ${c.name}\n\`\`\`solidity\n${c.content}\n\`\`\``;
    }).join("\n\n");

    const userMessage = `Create React frontend pages for a dApp with the following contracts:

${contractsSummary}

## Project Plan:
Contract Name: ${plan.contractName}
Description: ${plan.description}
Features: ${plan.features.join(", ")}
Pages needed: ${plan.pages.map((p: { path: string; description: string }) => `${p.path} - ${p.description}`).join("; ")}

Original user request: ${prompt}

The contracts have been tested and verified. Generate complete React pages that provide a user-friendly interface for all contract functionality.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const responseText = textContent.text;

    // Parse pages from ---PAGE: path--- markers
    const pages: { path: string; content: string }[] = [];
    const pageMatches = responseText.matchAll(/---PAGE:\s*([^\n-]+)---\s*```(?:tsx?|jsx?)?\s*([\s\S]*?)```/gi);
    for (const match of pageMatches) {
      pages.push({
        path: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Fallback: try to find any tsx/jsx code blocks
    if (pages.length === 0) {
      const tsxBlocks = responseText.matchAll(/```(?:tsx?|jsx?)\s*([\s\S]*?)```/gi);
      let i = 0;
      for (const match of tsxBlocks) {
        pages.push({
          path: `app/dapp${i > 0 ? i + 1 : ""}/page.tsx`,
          content: match[1].trim(),
        });
        i++;
      }
    }

    if (pages.length === 0) {
      throw new Error("Could not extract any pages from Claude's response");
    }

    return NextResponse.json({ success: true, pages });
  } catch (error) {
    console.error("Generate frontend error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Frontend generation failed" },
      { status: 500 }
    );
  }
}
