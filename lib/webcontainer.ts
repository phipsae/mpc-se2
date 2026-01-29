import { WebContainer } from "@webcontainer/api";
import type { TestResult, TestResultItem } from "./store";

let webcontainerInstance: WebContainer | null = null;
let isBooting = false;
let bootPromise: Promise<WebContainer> | null = null;

// Minimal dependencies that work in WebContainers (no native addons)
const PACKAGE_JSON = {
  name: "contract-tests",
  scripts: {
    test: "hardhat test --network hardhat",
    compile: "hardhat compile",
  },
  devDependencies: {
    // Core Hardhat - works in WebContainers
    hardhat: "^2.19.0",
    // Ethers and testing (no native deps)
    "@nomicfoundation/hardhat-ethers": "^3.0.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.0",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.0",
    ethers: "^6.10.0",
    chai: "^4.3.7",
    // OpenZeppelin
    "@openzeppelin/contracts": "^5.0.0",
    // TypeScript support
    typescript: "^5.3.0",
    "ts-node": "^10.9.0",
    "@types/chai": "^4.3.0",
    "@types/mocha": "^10.0.0",
  },
};

// Hardhat config without toolbox (avoids native addon issues)
const HARDHAT_CONFIG = `import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // Disable metadata hash to simplify compilation
      metadata: {
        bytecodeHash: "none",
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
  },
  // Disable paths that might trigger native module loading
  paths: {
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
`;

const TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    module: "commonjs",
    strict: true,
    esModuleInterop: true,
    outDir: "dist",
    declaration: true,
    resolveJsonModule: true,
  },
  include: ["./test/**/*.ts", "./hardhat.config.ts"],
  files: ["./hardhat.config.ts"],
};

export async function bootWebContainer(
  onOutput?: (data: string) => void
): Promise<WebContainer> {
  // Return existing instance if available
  if (webcontainerInstance) {
    onOutput?.("Using existing WebContainer instance...\n");
    return webcontainerInstance;
  }

  // If already booting, wait for that promise
  if (bootPromise) {
    onOutput?.("Waiting for WebContainer to boot...\n");
    return bootPromise;
  }

  onOutput?.("Booting WebContainer...\n");

  // Create a new boot promise
  bootPromise = (async () => {
    try {
      isBooting = true;
      webcontainerInstance = await WebContainer.boot();
      onOutput?.("WebContainer booted successfully!\n");
      return webcontainerInstance;
    } catch (error) {
      // Reset state on error
      webcontainerInstance = null;
      bootPromise = null;
      throw error;
    } finally {
      isBooting = false;
    }
  })();

  return bootPromise;
}

export interface ContractFile {
  name: string;
  content: string;
}

export interface TestFile {
  name: string;
  content: string;
}

export async function runTests(
  contracts: ContractFile[],
  tests: TestFile[],
  onOutput: (data: string) => void
): Promise<TestResult> {
  const container = await bootWebContainer(onOutput);

  onOutput("\n--- Mounting files ---\n");

  // Build the file structure
  const contractFiles: Record<string, { file: { contents: string } }> = {};
  for (const contract of contracts) {
    contractFiles[contract.name] = {
      file: { contents: contract.content },
    };
  }

  const testFiles: Record<string, { file: { contents: string } }> = {};
  for (const test of tests) {
    testFiles[test.name] = {
      file: { contents: test.content },
    };
  }

  const files = {
    "package.json": {
      file: { contents: JSON.stringify(PACKAGE_JSON, null, 2) },
    },
    "hardhat.config.ts": {
      file: { contents: HARDHAT_CONFIG },
    },
    "tsconfig.json": {
      file: { contents: JSON.stringify(TSCONFIG, null, 2) },
    },
    contracts: {
      directory: contractFiles,
    },
    test: {
      directory: testFiles,
    },
  };

  await container.mount(files);
  onOutput("Files mounted.\n");

  // Install dependencies
  onOutput("\n--- Installing dependencies (this may take a moment) ---\n");

  // Set environment variables to disable native modules and telemetry
  const env = {
    HARDHAT_DISABLE_TELEMETRY_PROMPT: "true",
    DO_NOT_RECOMPILE_ON_ENOENT: "true",
  };

  const installProcess = await container.spawn("npm", ["install"], { env });

  const installOutput = installProcess.output.getReader();
  let installDone = false;

  while (!installDone) {
    const { value, done } = await installOutput.read();
    if (done) {
      installDone = true;
    } else if (value) {
      onOutput(value);
    }
  }

  const installExitCode = await installProcess.exit;
  if (installExitCode !== 0) {
    onOutput(`\nError: npm install failed with exit code ${installExitCode}\n`);
    return {
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      output: "npm install failed",
      tests: [],
    };
  }

  onOutput("\nDependencies installed.\n");

  // Run tests
  onOutput("\n--- Running tests ---\n\n");

  const testProcess = await container.spawn("npx", [
    "hardhat",
    "test",
    "--network",
    "hardhat",
  ], { env });

  let testOutput = "";
  const testOutputReader = testProcess.output.getReader();
  let testDone = false;

  while (!testDone) {
    const { value, done } = await testOutputReader.read();
    if (done) {
      testDone = true;
    } else if (value) {
      testOutput += value;
      onOutput(value);
    }
  }

  const testExitCode = await testProcess.exit;
  onOutput(`\n--- Tests finished with exit code ${testExitCode} ---\n`);

  // Parse test results from output
  const result = parseTestOutput(testOutput, testExitCode === 0);
  return result;
}

function parseTestOutput(output: string, success: boolean): TestResult {
  const tests: TestResultItem[] = [];
  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  // Parse individual test results
  // Mocha format: ✔ or ✓ for pass, ✖ or 1) for fail
  const passRegex = /[✔✓]\s+(.+?)(?:\s+\((\d+)ms\))?$/gm;
  const failRegex = /(?:✖|^\s*\d+\))\s+(.+?)$/gm;

  let match;
  while ((match = passRegex.exec(output)) !== null) {
    tests.push({
      name: match[1].trim(),
      status: "passed",
    });
    passed++;
    totalTests++;
  }

  while ((match = failRegex.exec(output)) !== null) {
    const name = match[1].trim();
    // Try to find the error message
    const errorMatch = output.match(
      new RegExp(`${escapeRegex(name)}[\\s\\S]*?AssertionError:([^\\n]+)`)
    );
    tests.push({
      name,
      status: "failed",
      error: errorMatch ? errorMatch[1].trim() : undefined,
    });
    failed++;
    totalTests++;
  }

  // Parse summary line if available (e.g., "2 passing (1s)")
  const summaryMatch = output.match(/(\d+)\s+passing/);
  const failSummaryMatch = output.match(/(\d+)\s+failing/);

  if (summaryMatch) {
    passed = Math.max(passed, parseInt(summaryMatch[1], 10));
    totalTests = Math.max(totalTests, passed);
  }
  if (failSummaryMatch) {
    failed = Math.max(failed, parseInt(failSummaryMatch[1], 10));
    totalTests = Math.max(totalTests, passed + failed);
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function teardownWebContainer(): Promise<void> {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
    bootPromise = null;
  }
}

export function isWebContainerReady(): boolean {
  return webcontainerInstance !== null;
}
