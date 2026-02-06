import { getAnthropicClient, MODEL } from "./client.js";
import { GENERATE_CONTRACTS_ONLY_PROMPT } from "./prompts.js";
import { extractTextContent, parseContracts, parseTests } from "./parsers.js";
import type { ProjectPlan } from "../types.js";

export interface GenerateContractsResult {
  contracts: { name: string; content: string }[];
  tests: { name: string; content: string }[];
}

function generateFallbackTest(contractName: string, contractCode: string): string {
  const constructorMatch = contractCode.match(/constructor\s*\(([^)]*)\)/);
  const hasConstructorParams = constructorMatch && constructorMatch[1].trim().length > 0;
  const hasOwnable = contractCode.includes("Ownable") || contractCode.includes("owner()");

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

export async function generateContracts(
  prompt: string,
  plan: ProjectPlan,
  answers?: Record<string, string | number | boolean>
): Promise<GenerateContractsResult> {
  const client = getAnthropicClient();

  const userMessage = `Create smart contracts and Foundry tests based on this plan:

Contract Name: ${plan.contractName}
Description: ${plan.description}
Features: ${plan.features.join(", ")}

Original user request: ${prompt}

${answers ? `Additional details from user:\n${JSON.stringify(answers, null, 2)}` : ""}

Generate the complete Solidity contract(s) and comprehensive Foundry tests. DO NOT generate any React/frontend code.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: userMessage }],
    system: GENERATE_CONTRACTS_ONLY_PROMPT,
  });

  const responseText = extractTextContent(message);
  const contracts = parseContracts(responseText);
  let tests = parseTests(responseText);

  if (contracts.length === 0) {
    throw new Error("Could not extract any contracts from Claude's response");
  }

  // Generate fallback tests if none were produced
  if (tests.length === 0) {
    tests = contracts.map((contract) => ({
      name: `${contract.name.replace(".sol", "")}.t.sol`,
      content: generateFallbackTest(contract.name.replace(".sol", ""), contract.content),
    }));
  }

  return { contracts, tests };
}
