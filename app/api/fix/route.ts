import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FIX_SYSTEM_PROMPT = `You are an expert Solidity developer specializing in debugging and fixing smart contract compilation errors.

Your task is to fix Solidity compilation errors while preserving the original intent and functionality of the contract.

## REQUIREMENTS:
- Fix ONLY the compilation errors - do not change unrelated code
- Preserve all existing functionality
- Maintain the same contract name and structure
- Use Solidity ^0.8.20 or later
- Keep all OpenZeppelin imports intact
- Ensure all functions that are called are properly defined
- Check that function visibility modifiers are correct

## OUTPUT FORMAT:
You MUST output your response in this EXACT format using code fence markers:

---CONTRACT: ContractName.sol---
\`\`\`solidity
// Full fixed contract code here
\`\`\`

Include ALL contracts, even if only one had errors. Each must be preceded by the marker line.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts, errors } = body;

    if (!contracts || !contracts.length || !errors || !errors.length) {
      return NextResponse.json(
        { error: "Contracts and errors are required" },
        { status: 400 }
      );
    }

    // Build the contract code section
    const contractsText = contracts
      .map((c: { name: string; content: string }) => `--- ${c.name} ---\n${c.content}`)
      .join("\n\n");

    const userMessage = `Fix the following Solidity compilation errors.

## COMPILATION ERRORS:
${errors.join("\n\n")}

## CURRENT CONTRACT CODE:
${contractsText}

Analyze the errors carefully and fix them. Return the complete fixed contract(s) using the exact output format specified.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      system: FIX_SYSTEM_PROMPT,
    });

    // Extract text content
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const responseText = textContent.text;

    // Parse contracts from ---CONTRACT: Name.sol--- markers
    const fixedContracts: { name: string; content: string }[] = [];
    const contractMatches = responseText.matchAll(
      /---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi
    );
    for (const match of contractMatches) {
      fixedContracts.push({
        name: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Fallback: try to find any solidity code blocks
    if (fixedContracts.length === 0) {
      const solidityBlocks = responseText.matchAll(/```solidity\s*([\s\S]*?)```/gi);
      let i = 0;
      for (const match of solidityBlocks) {
        // Try to match with original contract names
        const originalName = contracts[i]?.name || `Contract${i > 0 ? i + 1 : ""}.sol`;
        fixedContracts.push({
          name: originalName,
          content: match[1].trim(),
        });
        i++;
      }
    }

    if (fixedContracts.length === 0) {
      throw new Error("Could not extract fixed code from Claude's response");
    }

    return NextResponse.json({ success: true, contracts: fixedContracts });
  } catch (error) {
    console.error("Fix error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Fix failed",
      },
      { status: 500 }
    );
  }
}
