import { getAnthropicClient, MODEL } from "./client.js";
import { GENERATE_TESTS_PROMPT } from "./prompts.js";
import { extractTextContent, parseTests } from "./parsers.js";
function generateBasicTest(contractName, contractCode) {
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
export async function generateTests(contracts) {
    const client = getAnthropicClient();
    const contractsText = contracts
        .map((c) => `--- ${c.name} ---\n${c.content}`)
        .join("\n\n");
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [
            {
                role: "user",
                content: `Generate comprehensive unit tests for the following Solidity contract(s):\n\n${contractsText}\n\nCreate thorough tests that cover all functionality. Use the exact output format specified.`,
            },
        ],
        system: GENERATE_TESTS_PROMPT,
    });
    const responseText = extractTextContent(message);
    let tests = parseTests(responseText);
    // Generate basic fallback tests if Claude didn't produce any
    if (tests.length === 0) {
        tests = contracts.map((contract) => {
            const contractName = contract.name.replace(".sol", "");
            return {
                name: `${contractName}.t.sol`,
                content: generateBasicTest(contractName, contract.content),
            };
        });
    }
    return tests;
}
//# sourceMappingURL=generate-tests.js.map