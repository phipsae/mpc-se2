import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FIX_COMPILATION_PROMPT = `You are an expert Solidity developer specializing in debugging and fixing smart contract compilation errors.

Your task is to fix Solidity compilation errors while preserving the original intent and functionality of the contract.

## REQUIREMENTS:
- Fix ONLY the compilation errors - do not change unrelated code
- Preserve all existing functionality
- Maintain the same contract name and structure
- Use Solidity ^0.8.20 or later
- Ensure all functions that are called are properly defined
- Check that function visibility modifiers are correct

## IMPORTANT: OpenZeppelin v5 Import Paths
We use OpenZeppelin v5.0.0. Many import paths changed from v4 to v5:

WRONG (v4 paths - DO NOT USE):
- @openzeppelin/contracts/security/ReentrancyGuard.sol
- @openzeppelin/contracts/security/Pausable.sol
- @openzeppelin/contracts/security/PullPayment.sol

CORRECT (v5 paths - USE THESE):
- @openzeppelin/contracts/utils/ReentrancyGuard.sol
- @openzeppelin/contracts/utils/Pausable.sol
- @openzeppelin/contracts/utils/PullPayment.sol

Other common v5 paths:
- @openzeppelin/contracts/token/ERC20/ERC20.sol
- @openzeppelin/contracts/token/ERC721/ERC721.sol
- @openzeppelin/contracts/token/ERC1155/ERC1155.sol
- @openzeppelin/contracts/access/Ownable.sol
- @openzeppelin/contracts/access/AccessControl.sol
- @openzeppelin/contracts/utils/math/Math.sol (SafeMath is deprecated in 0.8+)

## Common Fixes:
1. "Source not found" errors - Usually wrong import path, especially OZ v4 vs v5
2. "Undeclared identifier" - Missing imports or typos
3. "Type not found" - Wrong import or missing inheritance
4. "Function not found" - Check if function exists in parent contract for the OZ version

## OUTPUT FORMAT:
You MUST output your response in this EXACT format using code fence markers:

---CONTRACT: ContractName.sol---
\`\`\`solidity
// Full fixed contract code here
\`\`\`

Include ALL contracts, even if only one had errors. Each must be preceded by the marker line.`;

const FIX_SECURITY_PROMPT = `You are an expert Solidity security auditor specializing in fixing security vulnerabilities in smart contracts.

Your task is to fix security issues while preserving the original intent and functionality of the contract.

## REQUIREMENTS:
- Fix the security issues listed
- Preserve all existing functionality
- Maintain the same contract name and structure
- Keep the code clean and well-documented
- Add appropriate comments explaining the security fixes

## Common Security Fixes:

### 1. transfer() / send() → call()
BEFORE (vulnerable):
\`\`\`solidity
payable(recipient).transfer(amount);
// or
payable(recipient).send(amount);
\`\`\`

AFTER (safe):
\`\`\`solidity
(bool success, ) = payable(recipient).call{value: amount}("");
require(success, "Transfer failed");
\`\`\`

### 2. Reentrancy Protection
- Use OpenZeppelin's ReentrancyGuard: import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"
- Add \`nonReentrant\` modifier to functions that transfer ETH or tokens
- Follow checks-effects-interactions pattern

### 3. Integer Overflow/Underflow
- Solidity 0.8+ has built-in overflow checks
- For unchecked blocks, be careful with arithmetic

### 4. Access Control
- Use Ownable or AccessControl for privileged functions
- Always validate msg.sender for sensitive operations

### 5. Front-running Protection
- Use commit-reveal schemes for sensitive operations
- Consider using private mempools for critical transactions

## OUTPUT FORMAT:
You MUST output your response in this EXACT format using code fence markers:

---CONTRACT: ContractName.sol---
\`\`\`solidity
// Full fixed contract code here
\`\`\`

Include ALL contracts, even if only one had issues. Each must be preceded by the marker line.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts, errors, fixType = "compilation" } = body;

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

    const isSecurityFix = fixType === "security";
    const systemPrompt = isSecurityFix ? FIX_SECURITY_PROMPT : FIX_COMPILATION_PROMPT;

    const userMessage = isSecurityFix
      ? `Fix the following security issues in the Solidity contract.

## SECURITY ISSUES:
${errors.join("\n\n")}

## CURRENT CONTRACT CODE:
${contractsText}

Analyze the security issues carefully and fix them. Return the complete fixed contract(s) using the exact output format specified.`
      : `Fix the following Solidity compilation errors.

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
      system: systemPrompt,
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
