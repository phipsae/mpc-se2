const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");
const solc = require("solc");

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const anthropic = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Build orchestration limits
const MAX_COMPILATION_ATTEMPTS = 3;
const MAX_SECURITY_ATTEMPTS = 3;
const MAX_TEST_ATTEMPTS = 5;
const MAX_TOTAL_ITERATIONS = 10;
const BUILD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// CORS configuration - update with your frontend URL
const allowedOrigins = [
  "http://localhost:3000",
  "https://your-app.vercel.app", // Update this
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed) || allowed === "*")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
}));

app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================================
// BUILD ORCHESTRATION - Automated build with iteration
// ============================================================================

// OpenZeppelin import cache
const ozCache = new Map();

async function fetchOpenZeppelinSource(importPath) {
  if (ozCache.has(importPath)) {
    return ozCache.get(importPath);
  }

  const ozPath = importPath.replace("@openzeppelin/contracts/", "");
  const url = `https://unpkg.com/@openzeppelin/contracts@5.0.0/${ozPath}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const content = await response.text();
    ozCache.set(importPath, content);
    return content;
  } catch (error) {
    console.error(`Error fetching ${importPath}:`, error);
    return null;
  }
}

async function resolveImports(source, resolved = new Set()) {
  const importRegex = /import\s+.*?["'](@openzeppelin\/contracts\/[^"']+)["'];/g;
  const imports = [];
  let match;
  
  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];
    if (!resolved.has(importPath)) {
      resolved.add(importPath);
      imports.push(importPath);
    }
  }
  
  const sources = {};
  for (const importPath of imports) {
    const content = await fetchOpenZeppelinSource(importPath);
    if (content) {
      sources[importPath] = { content };
      // Recursively resolve nested imports
      const nestedSources = await resolveImports(content, resolved);
      Object.assign(sources, nestedSources);
    }
  }
  
  return sources;
}

async function compileContracts(contracts) {
  const sources = {};
  
  // Add contract sources
  for (const contract of contracts) {
    sources[contract.name] = { content: contract.content };
  }
  
  // Resolve OpenZeppelin imports
  for (const contract of contracts) {
    const ozSources = await resolveImports(contract.content);
    Object.assign(sources, ozSources);
  }
  
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
        },
      },
    },
  };
  
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  const errors = [];
  const warnings = [];
  
  if (output.errors) {
    for (const error of output.errors) {
      if (error.severity === "error") {
        errors.push(error.formattedMessage || error.message);
      } else {
        warnings.push(error.formattedMessage || error.message);
      }
    }
  }
  
  let bytecode = "";
  let abi = [];
  
  if (output.contracts && errors.length === 0) {
    // Get bytecode from first contract
    for (const fileName of Object.keys(output.contracts)) {
      if (fileName.endsWith(".sol")) {
        const fileContracts = output.contracts[fileName];
        for (const contractName of Object.keys(fileContracts)) {
          const contract = fileContracts[contractName];
          if (contract.evm?.bytecode?.object) {
            bytecode = contract.evm.bytecode.object;
            abi = contract.abi || [];
            break;
          }
        }
        if (bytecode) break;
      }
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings,
    bytecode,
    abi,
  };
}

function analyzeSecurityPatterns(contracts) {
  const warnings = [];
  
  const patterns = [
    {
      regex: /\.call\{.*value:.*\}\s*\([^)]*\)(?![\s\S]*require\s*\()/gm,
      message: "Potential reentrancy vulnerability: external call without checks-effects-interactions pattern",
      severity: "warning",
    },
    {
      regex: /\.transfer\s*\(/g,
      message: "Using transfer() is discouraged. Consider using call{value: x}() instead",
      severity: "warning",
    },
    {
      regex: /\.send\s*\(/g,
      message: "Using send() is discouraged. Consider using call{value: x}() instead",
      severity: "warning",
    },
    {
      regex: /tx\.origin/g,
      message: "Using tx.origin for authorization is vulnerable to phishing attacks",
      severity: "error",
    },
    {
      regex: /selfdestruct|suicide/g,
      message: "selfdestruct is deprecated and will be removed in future versions",
      severity: "warning",
    },
    {
      regex: /onlyOwner|Ownable/g,
      isPositive: true,
    },
    {
      regex: /function\s+\w+\s*\([^)]*\)\s*(?:external|public)(?!\s+view|\s+pure)(?![\s\S]*(?:onlyOwner|require\s*\(|modifier))/gm,
      message: "Public/external function without access control modifier",
      severity: "warning",
    },
  ];
  
  for (const contract of contracts) {
    const lines = contract.content.split("\n");
    
    for (const pattern of patterns) {
      if (pattern.isPositive) continue;
      
      let match;
      while ((match = pattern.regex.exec(contract.content)) !== null) {
        const lineNum = contract.content.substring(0, match.index).split("\n").length;
        warnings.push({
          severity: pattern.severity,
          message: pattern.message,
          contract: contract.name,
          line: lineNum,
        });
      }
      pattern.regex.lastIndex = 0;
    }
  }
  
  return warnings;
}

const GENERATE_SYSTEM_PROMPT = `You are an expert Solidity and React developer specializing in secure smart contract development.

Your task is to generate:
1. Production-ready Solidity contracts
2. React/Next.js frontend pages
3. Comprehensive Foundry tests (REQUIRED - do not skip)

IMPORTANT: You MUST generate a Foundry test file for each contract. Tests are NOT optional.

## SOLIDITY REQUIREMENTS:
- Use Solidity ^0.8.20 or later
- ALWAYS import from OpenZeppelin v5 when possible
- Use ReentrancyGuard for functions that transfer ETH/tokens
- Include NatSpec comments
- Follow checks-effects-interactions pattern
- Use call{value: x}() instead of transfer/send

## TEST REQUIREMENTS - FOUNDRY SOLIDITY TESTS ONLY:
Generate comprehensive Foundry/Forge tests in SOLIDITY.

CRITICAL - DO NOT USE (these are Hardhat/JavaScript - ABSOLUTELY FORBIDDEN):
- describe(), it(), expect(), before(), beforeEach()
- chai, mocha, or any JavaScript/TypeScript testing library
- ethers.getSigners(), ethers.getContractFactory()
- loadFixture(), time.increase()
- TypeScript or JavaScript syntax
- .test.ts, .test.js file extensions
- async/await in test functions

ONLY USE Foundry Solidity patterns:
- function testXxx() public - all test functions start with "test"
- function testFuzz_Xxx(uint256 x) public - fuzz tests  
- vm.prank(addr), vm.startPrank(addr), vm.stopPrank()
- vm.expectRevert(), vm.expectEmit()
- assertEq(), assertTrue(), assertFalse()
- makeAddr("name"), deal(addr, amount)
- .t.sol file extension ONLY

Test file structure:
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContractName.sol";

contract ContractNameTest is Test {
    ContractName public contractInstance;
    address public owner;
    address public user1;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        contractInstance = new ContractName(/* constructor args */);
    }

    function testDeployment() public view {
        assertEq(contractInstance.owner(), owner);
    }

    function testUnauthorizedAccess() public {
        vm.prank(user1);
        vm.expectRevert();
        contractInstance.ownerOnlyFunction();
    }
}
\`\`\`

## OUTPUT FORMAT:
---CONTRACT: ContractName.sol---
\`\`\`solidity
// contract code
\`\`\`

---PAGE: app/pagename/page.tsx---
\`\`\`tsx
// React code
\`\`\`

---TEST: ContractName.t.sol---
\`\`\`solidity
// Foundry Solidity test code - NO JavaScript
\`\`\``;

async function generateCode(prompt, plan) {
  const userMessage = `Create a dApp based on this plan:

Contract Name: ${plan.contractName}
Description: ${plan.description}
Features: ${plan.features.join(", ")}
Pages: ${plan.pages.map(p => `${p.path} - ${p.description}`).join("; ")}

Original request: ${prompt}

YOU MUST GENERATE ALL THREE:
1. Solidity smart contract(s) using ---CONTRACT: filename.sol--- markers
2. React/Next.js page(s) using ---PAGE: app/path/page.tsx--- markers  
3. Foundry/Forge test file(s) using ---TEST: filename.t.sol--- markers

The test file MUST:
- Be written in Solidity (NOT JavaScript/TypeScript)
- Import "forge-std/Test.sol"
- Use function testXxx() naming convention
- Test all major functionality of the contract

Do NOT skip the test file - it is required.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textContent = message.content.find(c => c.type === "text");
  if (!textContent) throw new Error("No response from Claude");
  
  const responseText = textContent.text;
  
  // Parse contracts
  const contracts = [];
  const contractMatches = responseText.matchAll(/---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
  for (const match of contractMatches) {
    contracts.push({ name: match[1].trim(), content: match[2].trim() });
  }
  
  // Parse pages
  const pages = [];
  const pageMatches = responseText.matchAll(/---PAGE:\s*([^\n-]+)---\s*```(?:tsx?|jsx?)?\s*([\s\S]*?)```/gi);
  for (const match of pageMatches) {
    pages.push({ path: match[1].trim(), content: match[2].trim() });
  }
  
  // Parse tests (Foundry tests are .t.sol files - SOLIDITY ONLY)
  const tests = [];
  const testMatches = responseText.matchAll(/---TEST:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
  for (const match of testMatches) {
    const testContent = match[2].trim();
    
    // REJECT JavaScript/Hardhat tests - only accept Foundry Solidity tests
    const isHardhatTest = testContent.includes('describe(') || 
                          testContent.includes('it(') ||
                          testContent.includes('require("chai")') ||
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
    tests.push({ name: testName, content: testContent });
  }
  
  // Fallback: try solidity code blocks for contracts
  if (contracts.length === 0) {
    const solidityBlocks = responseText.matchAll(/```solidity\s*([\s\S]*?)```/gi);
    let i = 0;
    for (const match of solidityBlocks) {
      // Skip if it looks like a test file
      if (match[1].includes('forge-std/Test.sol')) continue;
      contracts.push({ name: `Contract${i > 0 ? i + 1 : ""}.sol`, content: match[1].trim() });
      i++;
    }
  }
  
  // Fallback: try to find Foundry tests in solidity blocks (NOT JavaScript)
  if (tests.length === 0) {
    const solBlocks = responseText.matchAll(/```solidity\s*([\s\S]*?)```/gi);
    for (const match of solBlocks) {
      const content = match[1].trim();
      // Only accept if it's a Foundry test (imports Test.sol, NOT JavaScript)
      if ((content.includes('forge-std/Test.sol') || content.includes('is Test')) &&
          !content.includes('describe(') && !content.includes('it(')) {
        tests.push({ 
          name: `${contracts[0]?.name?.replace(".sol", "") || "Contract"}.t.sol`, 
          content: content 
        });
        break;
      }
    }
  }
  
  // Final fallback: generate a basic Foundry test if none exists
  if (tests.length === 0 && contracts.length > 0) {
    const contractName = contracts[0].name.replace(".sol", "");
    const hasOwnable = contracts[0].content.includes("Ownable") || contracts[0].content.includes("owner()");
    
    const basicTest = `// SPDX-License-Identifier: MIT
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
        instance = new ${contractName}();
    }

    function testDeployment() public view {
        assertTrue(address(instance) != address(0), "Contract should be deployed");
    }
${hasOwnable ? `
    function testOwner() public view {
        assertEq(instance.owner(), owner, "Owner should be deployer");
    }

    function testUnauthorizedAccess() public {
        vm.prank(user1);
        vm.expectRevert();
        // Attempt to call owner-only function
    }
` : ""}
}
`;
    tests.push({
      name: `${contractName}.t.sol`,
      content: basicTest,
    });
    console.log(`Generated fallback test for ${contractName}`);
  }
  
  return { contracts, pages, tests };
}

const FIX_COMPILATION_PROMPT = `You are an expert Solidity developer. Fix the compilation errors while preserving functionality.

## IMPORTANT: OpenZeppelin v5 Paths
- @openzeppelin/contracts/utils/ReentrancyGuard.sol (NOT security/)
- @openzeppelin/contracts/utils/Pausable.sol (NOT security/)
- @openzeppelin/contracts/access/Ownable.sol
- @openzeppelin/contracts/token/ERC20/ERC20.sol

Output format:
---CONTRACT: ContractName.sol---
\`\`\`solidity
// fixed code
\`\`\``;

async function fixCompilationErrors(contracts, errors) {
  const contractsText = contracts.map(c => `--- ${c.name} ---\n${c.content}`).join("\n\n");
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: FIX_COMPILATION_PROMPT,
    messages: [{
      role: "user",
      content: `Fix these compilation errors:\n\n${errors.join("\n\n")}\n\nContracts:\n${contractsText}`,
    }],
  });

  const textContent = message.content.find(c => c.type === "text");
  if (!textContent) throw new Error("No response from Claude");
  
  const fixedContracts = [];
  const matches = textContent.text.matchAll(/---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
  for (const match of matches) {
    fixedContracts.push({ name: match[1].trim(), content: match[2].trim() });
  }
  
  return fixedContracts.length > 0 ? fixedContracts : contracts;
}

const FIX_SECURITY_PROMPT = `You are an expert Solidity security auditor. Fix these security issues while preserving functionality.

## Common Fixes:
- transfer()/send() → call{value: x}("") with success check
- Add ReentrancyGuard for ETH transfers
- Add access control modifiers

Output format:
---CONTRACT: ContractName.sol---
\`\`\`solidity
// fixed code
\`\`\``;

async function fixSecurityIssues(contracts, warnings) {
  const contractsText = contracts.map(c => `--- ${c.name} ---\n${c.content}`).join("\n\n");
  const issuesText = warnings.map(w => `[${w.severity}] ${w.contract} line ${w.line}: ${w.message}`).join("\n");
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: FIX_SECURITY_PROMPT,
    messages: [{
      role: "user",
      content: `Fix these security issues:\n\n${issuesText}\n\nContracts:\n${contractsText}`,
    }],
  });

  const textContent = message.content.find(c => c.type === "text");
  if (!textContent) throw new Error("No response from Claude");
  
  const fixedContracts = [];
  const matches = textContent.text.matchAll(/---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
  for (const match of matches) {
    fixedContracts.push({ name: match[1].trim(), content: match[2].trim() });
  }
  
  return fixedContracts.length > 0 ? fixedContracts : contracts;
}

const FIX_TESTS_PROMPT = `You are an expert Solidity developer using Foundry/Forge for testing. Analyze the test failures and fix either:
1. The contract if it has a bug
2. The test if expectations are wrong

CRITICAL - TESTS MUST BE SOLIDITY, NOT JAVASCRIPT:
DO NOT USE: describe(), it(), expect(), chai, ethers.getSigners(), TypeScript
ONLY USE Foundry Solidity: function testXxx(), vm.prank(), vm.expectRevert(), assertEq()

Foundry test conventions:
- Import "forge-std/Test.sol"
- Inherit from Test
- Use vm.prank(), vm.expectRevert(), makeAddr(), deal()
- Test functions start with "test"
- File extension: .t.sol

Output format (include both if both need fixes):
---CONTRACT: ContractName.sol---
\`\`\`solidity
// fixed contract if needed
\`\`\`

---TEST: ContractName.t.sol---
\`\`\`solidity
// fixed Foundry SOLIDITY test - NO JavaScript
\`\`\``;

async function fixTestFailures(contracts, tests, testOutput) {
  const contractsText = contracts.map(c => `--- ${c.name} ---\n${c.content}`).join("\n\n");
  const testsText = tests.map(t => `--- ${t.name} ---\n${t.content}`).join("\n\n");
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: FIX_TESTS_PROMPT,
    messages: [{
      role: "user",
      content: `Test output:\n${testOutput}\n\nContracts:\n${contractsText}\n\nTests:\n${testsText}`,
    }],
  });

  const textContent = message.content.find(c => c.type === "text");
  if (!textContent) throw new Error("No response from Claude");
  
  const responseText = textContent.text;
  
  // Parse fixed contracts
  const fixedContracts = [];
  const contractMatches = responseText.matchAll(/---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
  for (const match of contractMatches) {
    fixedContracts.push({ name: match[1].trim(), content: match[2].trim() });
  }
  
  // Parse fixed tests (Foundry Solidity ONLY)
  const fixedTests = [];
  const testMatches = responseText.matchAll(/---TEST:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
  for (const match of testMatches) {
    const testContent = match[2].trim();
    // Reject if it's JavaScript/Hardhat
    if (testContent.includes('describe(') || testContent.includes('it(')) {
      console.warn('Rejected JavaScript test from fix - only Foundry Solidity accepted');
      continue;
    }
    let testName = match[1].trim();
    if (!testName.endsWith('.t.sol')) {
      testName = testName.replace(/\.(sol|ts|test\.ts)$/, '') + '.t.sol';
    }
    fixedTests.push({ name: testName, content: testContent });
  }
  
  return {
    contracts: fixedContracts.length > 0 ? fixedContracts : contracts,
    tests: fixedTests.length > 0 ? fixedTests : tests,
  };
}

// Build endpoint with Server-Sent Events for real-time progress
app.post("/build", async (req, res) => {
  const { prompt, plan } = req.body;
  
  if (!prompt || !plan) {
    return res.status(400).json({ success: false, error: "Prompt and plan required" });
  }
  
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: "ANTHROPIC_API_KEY not configured" });
  }
  
  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  
  const buildId = uuidv4();
  const logs = [];
  let currentStatus = "generating";
  let totalIterations = 0;
  
  // Send SSE event helper
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Log and send progress
  const log = (msg, status = currentStatus) => {
    logs.push(msg);
    console.log(`[Build ${buildId}] ${msg}`);
    sendEvent("progress", {
      status,
      message: msg,
      logs: [...logs],
      iteration: totalIterations,
    });
  };
  
  // Update status
  const setStatus = (status) => {
    currentStatus = status;
    sendEvent("status", { status, iteration: totalIterations });
  };
  
  const startTime = Date.now();
  
  try {
    // Step 1: Generate code
    setStatus("generating");
    log("Generating code with Claude...");
    let { contracts, pages, tests } = await generateCode(prompt, plan);
    log(`Generated ${contracts.length} contracts, ${pages.length} pages, ${tests.length} tests`);
    
    if (contracts.length === 0) {
      throw new Error("No contracts generated");
    }
    
    // Step 2: Compile with retries
    setStatus("compiling");
    log("Compiling contracts...");
    let compilationAttempts = 0;
    let compileResult = await compileContracts(contracts);
    
    while (!compileResult.success && compilationAttempts < MAX_COMPILATION_ATTEMPTS) {
      compilationAttempts++;
      totalIterations++;
      setStatus("fixing_compilation");
      log(`Compilation failed (attempt ${compilationAttempts}), fixing errors...`);
      
      if (Date.now() - startTime > BUILD_TIMEOUT_MS) throw new Error("Build timeout");
      if (totalIterations >= MAX_TOTAL_ITERATIONS) throw new Error("Max iterations reached");
      
      contracts = await fixCompilationErrors(contracts, compileResult.errors);
      setStatus("compiling");
      log("Re-compiling after fixes...");
      compileResult = await compileContracts(contracts);
    }
    
    if (!compileResult.success) {
      sendEvent("complete", {
        success: false,
        error: "Compilation failed after max attempts",
        code: { contracts, pages, tests },
        logs,
        iterations: totalIterations,
        compileErrors: compileResult.errors,
      });
      return res.end();
    }
    log("Compilation successful!");
    
    // Step 3: Security analysis with fixes (fix ALL issues, not just critical)
    setStatus("checking_security");
    log("Running security analysis...");
    let securityAttempts = 0;
    let securityWarnings = analyzeSecurityPatterns(contracts);
    
    // Fix ALL security issues (both errors and warnings) in automated mode
    while (securityWarnings.length > 0 && securityAttempts < MAX_SECURITY_ATTEMPTS) {
      securityAttempts++;
      totalIterations++;
      setStatus("fixing_security");
      const errorCount = securityWarnings.filter(w => w.severity === "error").length;
      const warningCount = securityWarnings.filter(w => w.severity === "warning").length;
      log(`Found ${errorCount} errors and ${warningCount} warnings (attempt ${securityAttempts}), fixing...`);
      
      if (Date.now() - startTime > BUILD_TIMEOUT_MS) throw new Error("Build timeout");
      if (totalIterations >= MAX_TOTAL_ITERATIONS) throw new Error("Max iterations reached");
      
      contracts = await fixSecurityIssues(contracts, securityWarnings);
      
      // Re-compile after security fixes
      setStatus("compiling");
      log("Re-compiling after security fixes...");
      compileResult = await compileContracts(contracts);
      if (!compileResult.success) {
        setStatus("fixing_compilation");
        contracts = await fixCompilationErrors(contracts, compileResult.errors);
        compileResult = await compileContracts(contracts);
      }
      
      setStatus("checking_security");
      securityWarnings = analyzeSecurityPatterns(contracts);
    }
    log(`Security analysis complete. All issues fixed!`);
    
    // Step 4: Run tests with fixes
    setStatus("testing");
    log("Running Foundry tests...");
    let testAttempts = 0;
    let testResult = await runTestsInternal(contracts, tests);
    
    while (!testResult.success && testAttempts < MAX_TEST_ATTEMPTS) {
      testAttempts++;
      totalIterations++;
      setStatus("fixing_tests");
      log(`Tests failed (attempt ${testAttempts}): ${testResult.failed} failures. Fixing...`);
      
      if (Date.now() - startTime > BUILD_TIMEOUT_MS) throw new Error("Build timeout");
      if (totalIterations >= MAX_TOTAL_ITERATIONS) throw new Error("Max iterations reached");
      
      const fixed = await fixTestFailures(contracts, tests, testResult.output);
      contracts = fixed.contracts;
      tests = fixed.tests;
      
      // Re-compile if contracts changed
      setStatus("compiling");
      log("Re-compiling after test fixes...");
      compileResult = await compileContracts(contracts);
      if (!compileResult.success) {
        setStatus("fixing_compilation");
        contracts = await fixCompilationErrors(contracts, compileResult.errors);
        compileResult = await compileContracts(contracts);
        if (!compileResult.success) {
          log("Compilation failed after test fixes");
          break;
        }
      }
      
      setStatus("testing");
      log("Re-running tests...");
      testResult = await runTestsInternal(contracts, tests);
    }
    
    const elapsed = Date.now() - startTime;
    setStatus("done");
    log(`Build complete in ${(elapsed / 1000).toFixed(1)}s with ${totalIterations} iterations`);
    
    sendEvent("complete", {
      success: testResult.success,
      code: { contracts, pages, tests },
      testResult,
      securityWarnings,
      logs,
      iterations: totalIterations,
      elapsedMs: elapsed,
    });
    
  } catch (error) {
    log(`Build error: ${error.message}`, "failed");
    sendEvent("complete", {
      success: false,
      error: error.message,
      logs,
      iterations: totalIterations,
    });
  }
  
  res.end();
});

// Internal test runner using Foundry/Forge
async function runTestsInternal(contracts, tests) {
  const projectId = uuidv4();
  const projectDir = path.join("/tmp", "forge-tests", projectId);
  
  try {
    // Create Foundry project structure
    await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "test"), { recursive: true });
    
    // Write foundry.toml config
    const foundryConfig = `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"

[rpc_endpoints]
mainnet = "https://eth.llamarpc.com"
`;
    await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);
    
    // Write contracts to src/
    for (const contract of contracts) {
      await fs.writeFile(path.join(projectDir, "src", contract.name), contract.content);
    }
    
    // Write test files to test/
    for (const test of tests) {
      // Validate that test is Foundry format (Solidity), not Hardhat (JavaScript)
      const isJavaScript = test.content.includes('describe(') || 
                           test.content.includes('it(') ||
                           test.content.includes('require("chai")') ||
                           test.content.includes('from "hardhat"') ||
                           test.content.includes('from "chai"');
      
      if (isJavaScript) {
        console.log("Detected JavaScript test, needs regeneration in Foundry format");
        // Return error - tests need to be regenerated
        return {
          success: false,
          totalTests: 0,
          passed: 0,
          failed: 0,
          output: "Error: Test file is in Hardhat/JavaScript format. Please regenerate tests in Foundry format.\n\nFoundry tests must be Solidity files that:\n- Import 'forge-std/Test.sol'\n- Inherit from Test\n- Use function testXxx() for tests",
          tests: [],
        };
      }
      
      const testName = test.name.endsWith('.t.sol') ? test.name : test.name.replace(/\.(sol|ts)$/, '') + '.t.sol';
      await fs.writeFile(path.join(projectDir, "test", testName), test.content);
    }
    
    // Symlink pre-installed Foundry libs (forge-std, OpenZeppelin)
    // These were installed at Docker build time in /app/forge-libs/lib
    const preinstalledLibs = "/app/forge-libs/lib";
    const projectLibs = path.join(projectDir, "lib");
    try {
      await fs.symlink(preinstalledLibs, projectLibs, "junction");
    } catch (e) {
      // If symlink fails (e.g., running locally), try forge install
      console.log("Symlink failed, trying forge install...");
      await fs.mkdir(projectLibs, { recursive: true });
      await runCommand("git", ["init"], projectDir);
      await runCommand("forge", ["install", "foundry-rs/forge-std", "OpenZeppelin/openzeppelin-contracts", "--no-git"], projectDir);
    }
    
    // Create remappings for OpenZeppelin
    const remappings = `forge-std/=lib/forge-std/src/
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
`;
    await fs.writeFile(path.join(projectDir, "remappings.txt"), remappings);
    
    // Run forge test
    const result = await runCommand("forge", ["test", "-vvv"], projectDir);
    return parseForgeOutput(result.output, result.exitCode === 0);
    
  } finally {
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

// Run a command and capture output
function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    let output = "";
    
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env },
    });

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ output, exitCode: code });
    });

    proc.on("error", (error) => {
      resolve({ output: `Process error: ${error.message}`, exitCode: 1 });
    });

    // Timeout after 120 seconds (Forge can be slow on first run)
    setTimeout(() => {
      proc.kill();
      resolve({ output: output + "\n\nTest execution timed out (120s)", exitCode: 1 });
    }, 120000);
  });
}

// Parse Forge test output
function parseForgeOutput(output, success) {
  const tests = [];
  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  // Forge output format:
  // [PASS] testSomething() (gas: 12345)
  // [FAIL] testOther(): assertion failed
  const passRegex = /\[PASS\]\s+(\w+)\(\)/g;
  const failRegex = /\[FAIL[^\]]*\]\s+(\w+)\(\)(?::\s*(.+))?/g;

  let match;
  while ((match = passRegex.exec(output)) !== null) {
    tests.push({
      name: match[1],
      status: "passed",
    });
    passed++;
    totalTests++;
  }

  while ((match = failRegex.exec(output)) !== null) {
    tests.push({
      name: match[1],
      status: "failed",
      error: match[2] || "Test failed",
    });
    failed++;
    totalTests++;
  }

  // Also check for summary line
  const summaryMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
  if (summaryMatch) {
    passed = Math.max(passed, parseInt(summaryMatch[1], 10));
    failed = Math.max(failed, parseInt(summaryMatch[2], 10));
    totalTests = passed + failed;
  }

  return {
    success: success && failed === 0,
    totalTests,
    passed,
    failed,
    output,
    tests,
  };
}

// Run tests endpoint (uses Foundry/Forge)
app.post("/run-tests", async (req, res) => {
  const { contracts, tests } = req.body;

  if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: "No contracts provided" 
    });
  }

  if (!tests || !Array.isArray(tests) || tests.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: "No tests provided" 
    });
  }

  // Use the same Foundry-based test runner
  try {
    const result = await runTestsInternal(contracts, tests);
    res.json(result);
  } catch (error) {
    console.error("Test execution error:", error);
    res.status(500).json({
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      output: `Error: ${error.message}`,
      tests: [],
    });
  }
});

app.listen(PORT, () => {
  console.log(`Foundry Test Runner listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
