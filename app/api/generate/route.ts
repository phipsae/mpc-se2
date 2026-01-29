import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function generateFallbackTest(contractName: string, contractCode: string): string {
  // Extract constructor parameters from the contract code
  const constructorMatch = contractCode.match(/constructor\s*\(([^)]*)\)/);
  const hasConstructorParams = constructorMatch && constructorMatch[1].trim().length > 0;

  // Check if it has Ownable
  const hasOwnable = contractCode.includes("Ownable") || contractCode.includes("owner()");

  // Generate basic Foundry test structure
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";

contract ${contractName}Test is Test {
    ${contractName} public instance;
    address public owner;
    address public user1;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        instance = new ${contractName}(${hasConstructorParams ? "/* add constructor args */" : ""});
    }

    function testDeployment() public view {
        assertTrue(address(instance) != address(0));
    }
${hasOwnable ? `
    function testOwner() public view {
        assertEq(instance.owner(), owner);
    }

    function testUnauthorizedAccess() public {
        vm.prank(user1);
        vm.expectRevert();
        // Call an owner-only function here
    }
` : ""}
}
`;
}

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

const GENERATE_SYSTEM_PROMPT = `You are an expert Solidity and React developer specializing in Scaffold-ETH 2 projects.

Your task is to generate production-ready code based on the user's requirements.

## SOLIDITY REQUIREMENTS:
- Use Solidity ^0.8.20 or later
- ALWAYS import from OpenZeppelin when possible (ERC20, ERC721, ERC1155, Ownable, ReentrancyGuard, etc.)
- Include NatSpec comments for all public functions
- Follow security best practices
- Add appropriate access control

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

## TEST REQUIREMENTS:
You MUST also generate comprehensive Foundry/Forge unit tests for each contract:
- Test all public functions
- Test access control (onlyOwner, etc.)
- Test edge cases and error conditions
- Test events are emitted correctly
- Use fuzz testing where appropriate

Foundry test file structure:
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContractName.sol";

contract ContractNameTest is Test {
    ContractName public instance;
    address public owner;
    address public user1;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        instance = new ContractName(/* constructor args */);
    }

    function testDeployment() public view {
        assertEq(instance.owner(), owner);
    }

    function testUnauthorizedAccess() public {
        vm.prank(user1);
        vm.expectRevert();
        instance.ownerOnlyFunction();
    }
}
\`\`\`

Foundry conventions:
- Import "forge-std/Test.sol" and inherit from Test
- Use vm.prank(addr) to impersonate, vm.expectRevert() for reverts
- Use makeAddr("name") for addresses, deal(addr, amount) for ETH
- Test functions must start with "test"

## OUTPUT FORMAT:
You MUST output your response in this EXACT format using code fence markers:

---CONTRACT: ContractName.sol---
\`\`\`solidity
// Full contract code here
\`\`\`

---PAGE: app/pagename/page.tsx---
\`\`\`tsx
// Full React component code here
\`\`\`

---TEST: ContractName.t.sol---
\`\`\`solidity
// Full Foundry test code here
\`\`\`

You can include multiple contracts, pages, and test files. Each must be preceded by the marker line.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured. Please add it to your .env file." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { prompt, answers, plan } = body;

    if (!prompt || !plan) {
      return NextResponse.json(
        { error: "Prompt and plan are required" },
        { status: 400 }
      );
    }

    // Get SE2 docs
    const se2Docs = await getSE2Docs();
    const systemPrompt = GENERATE_SYSTEM_PROMPT.replace("{SE2_DOCS}", se2Docs);

    const userMessage = `Create a dApp based on this plan:

Contract Name: ${plan.contractName}
Description: ${plan.description}
Features: ${plan.features.join(", ")}
Pages needed: ${plan.pages.map((p: { path: string; description: string }) => `${p.path} - ${p.description}`).join("; ")}

Original user request: ${prompt}

${answers ? `Additional details from user:\n${JSON.stringify(answers, null, 2)}` : ""}

Generate the complete Solidity contract(s) and React page(s).`;

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
    const contracts: { name: string; content: string }[] = [];
    const contractMatches = responseText.matchAll(/---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
    for (const match of contractMatches) {
      contracts.push({
        name: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Parse pages from ---PAGE: path--- markers
    const pages: { path: string; content: string }[] = [];
    const pageMatches = responseText.matchAll(/---PAGE:\s*([^\n-]+)---\s*```(?:tsx?|jsx?)?\s*([\s\S]*?)```/gi);
    for (const match of pageMatches) {
      pages.push({
        path: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Parse tests from ---TEST: name.t.sol--- markers (Foundry tests)
    const tests: { name: string; content: string }[] = [];
    const testMatches = responseText.matchAll(/---TEST:\s*([^\n-]+)---\s*```(?:solidity|typescript|ts)?\s*([\s\S]*?)```/gi);
    for (const match of testMatches) {
      let testName = match[1].trim();
      // Ensure .t.sol extension for Foundry tests
      if (!testName.endsWith('.t.sol')) {
        testName = testName.replace(/\.(sol|ts|test\.ts)$/, '') + '.t.sol';
      }
      tests.push({
        name: testName,
        content: match[2].trim(),
      });
    }

    // Fallback: try to find any solidity code blocks
    if (contracts.length === 0) {
      const solidityBlocks = responseText.matchAll(/```solidity\s*([\s\S]*?)```/gi);
      let i = 0;
      for (const match of solidityBlocks) {
        contracts.push({
          name: `Contract${i > 0 ? i + 1 : ""}.sol`,
          content: match[1].trim(),
        });
        i++;
      }
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

    if (contracts.length === 0 && pages.length === 0) {
      throw new Error("Could not extract any code from Claude's response");
    }

    // Generate fallback tests if none were generated (Foundry format)
    const finalTests = tests.length > 0 ? tests : contracts.map((contract) => ({
      name: `${contract.name.replace(".sol", "")}.t.sol`,
      content: generateFallbackTest(contract.name.replace(".sol", ""), contract.content),
    }));

    const code = { contracts, pages, tests: finalTests };

    return NextResponse.json({ success: true, code });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
