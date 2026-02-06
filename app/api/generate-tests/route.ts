import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GENERATE_TESTS_PROMPT = `You are an expert Solidity developer specializing in writing comprehensive Foundry/Forge tests.

Your task is to generate thorough unit tests for the provided Solidity contract(s) using Foundry/Forge.

CRITICAL - YOU MUST WRITE SOLIDITY TESTS, NOT JAVASCRIPT/TYPESCRIPT:

DO NOT USE (these are Hardhat/JavaScript patterns - ABSOLUTELY FORBIDDEN):
- describe(), it(), expect(), before(), beforeEach()
- chai, mocha, or any JavaScript/TypeScript testing library
- ethers.getSigners(), ethers.getContractFactory()
- loadFixture(), time.increase()
- TypeScript or JavaScript syntax
- .test.ts, .test.js, or .spec.ts file extensions
- async/await in test functions
- require("chai") or import from "chai"

ONLY USE Foundry Solidity patterns:
- function testXxx() public - all test functions start with "test"
- function testFuzz_Xxx(uint256 x) public - fuzz tests  
- vm.prank(addr), vm.startPrank(addr), vm.stopPrank()
- vm.expectRevert(), vm.expectEmit()
- assertEq(), assertTrue(), assertFalse(), assertGt(), assertLt()
- makeAddr("name"), deal(addr, amount), hoax(addr, amount)
- .t.sol file extension ONLY

## TEST REQUIREMENTS:
- Test all public and external functions
- Test access control (onlyOwner, roles, etc.)
- Test edge cases and error conditions (reverts)
- Test events are emitted correctly
- Test state changes
- Include deployment tests
- Use fuzz testing where appropriate

## FOUNDRY TEST FILE STRUCTURE:
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContractName.sol";

contract ContractNameTest is Test {
    ContractName public instance;
    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
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

    function testFuzz_SomeFunction(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1e18);
        // fuzz test
    }
}
\`\`\`

## OUTPUT FORMAT:
You MUST output your response in this EXACT format:

---TEST: ContractName.t.sol---
\`\`\`solidity
// Full Foundry Solidity test code here
\`\`\`

Generate a .t.sol test file for EACH contract provided. Tests MUST be in Solidity, NOT JavaScript.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts } = body;

    if (!contracts || contracts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No contracts provided" },
        { status: 400 }
      );
    }

    const contractsText = contracts
      .map((c: { name: string; content: string }) => `--- ${c.name} ---\n${c.content}`)
      .join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Generate comprehensive unit tests for the following Solidity contract(s):

${contractsText}

Create thorough tests that cover all functionality. Use the exact output format specified.`,
        },
      ],
      system: GENERATE_TESTS_PROMPT,
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const responseText = textContent.text;

    // Parse tests from ---TEST: name.t.sol--- markers (Foundry Solidity tests ONLY)
    const tests: { name: string; content: string }[] = [];
    const testMatches = responseText.matchAll(
      /---TEST:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi
    );
    for (const match of testMatches) {
      const testContent = match[2].trim();
      
      // REJECT JavaScript/Hardhat tests - only accept Foundry Solidity tests
      const isHardhatTest = testContent.includes('describe(') || 
                            testContent.includes('it(') ||
                            testContent.includes('require("chai")') ||
                            testContent.includes("require('chai')") ||
                            testContent.includes('from "hardhat"') ||
                            testContent.includes('ethers.getSigners');
      
      if (isHardhatTest) {
        console.warn('Rejected Hardhat/JavaScript test - only Foundry Solidity tests accepted');
        continue;
      }
      
      let testName = match[1].trim();
      // Ensure .t.sol extension for Foundry tests
      if (!testName.endsWith('.t.sol')) {
        testName = testName.replace(/\.(sol|ts|test\.ts)$/, '') + '.t.sol';
      }
      tests.push({
        name: testName,
        content: testContent,
      });
    }

    // Fallback: try to find any Solidity code blocks that look like Foundry tests
    if (tests.length === 0) {
      const solBlocks = responseText.matchAll(/```(?:solidity)\s*([\s\S]*?)```/gi);
      let i = 0;
      for (const match of solBlocks) {
        const content = match[1].trim();
        
        // REJECT if it's JavaScript/Hardhat
        const isHardhatTest = content.includes('describe(') || 
                              content.includes('it(') ||
                              content.includes('require("chai")');
        if (isHardhatTest) continue;
        
        // Only include if it looks like a Foundry test (imports Test.sol)
        if (content.includes('forge-std/Test.sol') || content.includes('is Test')) {
          const originalName = contracts[i]?.name?.replace(".sol", "") || `Contract${i}`;
          tests.push({
            name: `${originalName}.t.sol`,
            content: content,
          });
          i++;
        }
      }
    }

    // Generate basic fallback tests if Claude didn't produce any
    if (tests.length === 0) {
      for (const contract of contracts) {
        const contractName = contract.name.replace(".sol", "");
        tests.push({
          name: `${contractName}.t.sol`,
          content: generateBasicTest(contractName, contract.content),
        });
      }
    }

    return NextResponse.json({ success: true, tests });
  } catch (error) {
    console.error("Generate tests error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Test generation failed",
      },
      { status: 500 }
    );
  }
}

function generateBasicTest(contractName: string, contractCode: string): string {
  const hasOwnable = contractCode.includes("Ownable") || contractCode.includes("owner()");
  const constructorMatch = contractCode.match(/constructor\s*\(([^)]*)\)/);
  const hasConstructorParams = constructorMatch && constructorMatch[1].trim().length > 0;

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
