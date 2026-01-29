import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GENERATE_TESTS_PROMPT = `You are an expert Solidity developer specializing in writing comprehensive smart contract tests.

Your task is to generate thorough unit tests for the provided Solidity contract(s) using Hardhat, Chai, and ethers.js v6.

## TEST REQUIREMENTS:
- Test all public and external functions
- Test access control (onlyOwner, roles, etc.)
- Test edge cases and error conditions (reverts)
- Test events are emitted correctly
- Test state changes
- Include deployment tests
- Use loadFixture pattern for gas efficiency

## TEST FILE STRUCTURE:
\`\`\`typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("ContractName", function () {
  async function deployFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("ContractName");
    const contract = await Contract.deploy(/* constructor args */);
    return { contract, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getAddress()).to.be.properAddress;
    });
  });

  describe("FunctionName", function () {
    it("Should do X when Y", async function () {
      // Test implementation
    });

    it("Should revert when Z", async function () {
      // Test error conditions
    });
  });
});
\`\`\`

## IMPORTANT NOTES FOR ETHERS V6:
- Use \`await contract.getAddress()\` instead of \`contract.address\`
- Use \`ethers.parseEther("1.0")\` instead of \`ethers.utils.parseEther\`
- Use \`ethers.formatEther()\` instead of \`ethers.utils.formatEther\`
- BigInt is native, no need for BigNumber

## OUTPUT FORMAT:
You MUST output your response in this EXACT format:

---TEST: ContractName.test.ts---
\`\`\`typescript
// Full test code here
\`\`\`

Generate a test file for EACH contract provided.`;

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

    // Parse tests from ---TEST: name.test.ts--- markers
    const tests: { name: string; content: string }[] = [];
    const testMatches = responseText.matchAll(
      /---TEST:\s*([^\n-]+)---\s*```(?:typescript|ts)?\s*([\s\S]*?)```/gi
    );
    for (const match of testMatches) {
      tests.push({
        name: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Fallback: try to find any typescript code blocks
    if (tests.length === 0) {
      const tsBlocks = responseText.matchAll(/```(?:typescript|ts)\s*([\s\S]*?)```/gi);
      let i = 0;
      for (const match of tsBlocks) {
        const originalName = contracts[i]?.name?.replace(".sol", "") || `Contract${i}`;
        tests.push({
          name: `${originalName}.test.ts`,
          content: match[1].trim(),
        });
        i++;
      }
    }

    // Generate basic fallback tests if Claude didn't produce any
    if (tests.length === 0) {
      for (const contract of contracts) {
        const contractName = contract.name.replace(".sol", "");
        tests.push({
          name: `${contractName}.test.ts`,
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

  return `import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("${contractName}", function () {
  async function deployFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("${contractName}");
    const contract = await Contract.deploy(${hasConstructorParams ? "/* add constructor args */" : ""});
    return { contract, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getAddress()).to.be.properAddress;
    });
${hasOwnable ? `
    it("Should set the right owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });
` : ""}
  });
});
`;
}
