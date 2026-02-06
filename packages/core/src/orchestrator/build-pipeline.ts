// ============================================================================
// Build pipeline orchestrator - extracted from test-runner/server.js /build
// ============================================================================

import { compileContracts } from "../compiler/solc-compiler.js";
import { analyzeSecurityPatterns } from "../security/analyzer.js";
import { runForgeTests } from "../testing/forge-runner.js";
import { fixCompilation, fixSecurity, fixTestFailures } from "../ai/fix.js";
import { generateContracts } from "../ai/generate-contracts.js";
import { generateTests } from "../ai/generate-tests.js";
import type {
  ProjectPlan,
  GeneratedCode,
  BuildResult,
  SecurityWarning,
  TestResult,
} from "../types.js";

const MAX_COMPILATION_ATTEMPTS = 3;
const MAX_SECURITY_ATTEMPTS = 3;
const MAX_TEST_ATTEMPTS = 5;
const MAX_TOTAL_ITERATIONS = 10;
const BUILD_TIMEOUT_MS = 5 * 60 * 1000;

export interface BuildOptions {
  prompt: string;
  plan: ProjectPlan;
  existingCode?: GeneratedCode;
  maxIterations?: number;
  onProgress?: (status: string, message: string, iteration: number) => void;
}

export async function buildDApp(opts: BuildOptions): Promise<BuildResult> {
  const {
    prompt,
    plan,
    existingCode,
    maxIterations = MAX_TOTAL_ITERATIONS,
    onProgress,
  } = opts;

  const logs: string[] = [];
  let totalIterations = 0;
  const startTime = Date.now();

  const log = (msg: string, status?: string) => {
    logs.push(msg);
    onProgress?.(status || "working", msg, totalIterations);
  };

  try {
    // Step 1: Generate or use existing code
    let contracts: { name: string; content: string }[];
    let pages: { path: string; content: string }[];
    let tests: { name: string; content: string }[];

    if (existingCode?.contracts && existingCode.contracts.length > 0) {
      log("Validating existing code...", "validating");
      contracts = existingCode.contracts;
      pages = existingCode.pages || [];
      tests = existingCode.tests || [];

      if (tests.length === 0) {
        log("No tests provided, generating tests...", "generating");
        tests = await generateTests(contracts);
        log(`Generated ${tests.length} tests`);
      }
    } else {
      log("Generating code with Claude...", "generating");
      const generated = await generateContracts(prompt, plan);
      contracts = generated.contracts;
      pages = [];
      tests = generated.tests;
      log(
        `Generated ${contracts.length} contracts, ${tests.length} tests`
      );
    }

    if (contracts.length === 0) {
      throw new Error("No contracts to validate");
    }

    // Step 2: Compile with retries
    log("Compiling contracts...", "compiling");
    let compilationAttempts = 0;
    let compileResult = await compileContracts(contracts);

    while (
      !compileResult.success &&
      compilationAttempts < MAX_COMPILATION_ATTEMPTS
    ) {
      compilationAttempts++;
      totalIterations++;

      if (totalIterations >= maxIterations)
        throw new Error("Max iterations reached");
      if (Date.now() - startTime > BUILD_TIMEOUT_MS)
        throw new Error("Build timeout");

      log(
        `Compilation failed (attempt ${compilationAttempts}), fixing errors...`,
        "fixing_compilation"
      );
      contracts = await fixCompilation(contracts, compileResult.errors);
      log("Re-compiling after fixes...", "compiling");
      compileResult = await compileContracts(contracts);
    }

    if (!compileResult.success) {
      return {
        success: false,
        code: { contracts, pages, tests },
        logs,
        iterations: totalIterations,
        compileErrors: compileResult.errors,
        error: "Compilation failed after max attempts",
      };
    }
    log("Compilation successful!");

    // Step 3: Security analysis with fixes
    log("Running security analysis...", "checking_security");
    let securityAttempts = 0;
    let securityWarnings: SecurityWarning[] =
      analyzeSecurityPatterns(contracts);

    while (
      securityWarnings.length > 0 &&
      securityAttempts < MAX_SECURITY_ATTEMPTS
    ) {
      securityAttempts++;
      totalIterations++;

      if (totalIterations >= maxIterations)
        throw new Error("Max iterations reached");
      if (Date.now() - startTime > BUILD_TIMEOUT_MS)
        throw new Error("Build timeout");

      log(
        `Found ${securityWarnings.length} security issues (attempt ${securityAttempts}), fixing...`,
        "fixing_security"
      );
      contracts = await fixSecurity(contracts, securityWarnings);

      // Re-compile after security fixes
      log("Re-compiling after security fixes...", "compiling");
      compileResult = await compileContracts(contracts);
      if (!compileResult.success) {
        contracts = await fixCompilation(contracts, compileResult.errors);
        compileResult = await compileContracts(contracts);
      }

      securityWarnings = analyzeSecurityPatterns(contracts);
    }
    log("Security analysis complete!");

    // Step 4: Run tests with fixes
    log("Running Foundry tests...", "testing");
    let testAttempts = 0;
    let testResult: TestResult = await runForgeTests(contracts, tests);

    while (!testResult.success && testAttempts < MAX_TEST_ATTEMPTS) {
      testAttempts++;
      totalIterations++;

      if (totalIterations >= maxIterations)
        throw new Error("Max iterations reached");
      if (Date.now() - startTime > BUILD_TIMEOUT_MS)
        throw new Error("Build timeout");

      log(
        `Tests failed (attempt ${testAttempts}): ${testResult.failed} failures. Fixing...`,
        "fixing_tests"
      );
      const fixed = await fixTestFailures(contracts, tests, testResult.output);
      contracts = fixed.contracts;
      tests = fixed.tests;

      // Re-compile if contracts changed
      log("Re-compiling after test fixes...", "compiling");
      compileResult = await compileContracts(contracts);
      if (!compileResult.success) {
        contracts = await fixCompilation(contracts, compileResult.errors);
        compileResult = await compileContracts(contracts);
        if (!compileResult.success) {
          log("Compilation failed after test fixes");
          break;
        }
      }

      log("Re-running tests...", "testing");
      testResult = await runForgeTests(contracts, tests);
    }

    const elapsed = Date.now() - startTime;
    log(
      `Build complete in ${(elapsed / 1000).toFixed(1)}s with ${totalIterations} iterations`,
      "done"
    );

    return {
      success: testResult.success,
      code: { contracts, pages, tests },
      testResult,
      securityWarnings,
      logs,
      iterations: totalIterations,
      elapsedMs: elapsed,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown build error";
    log(`Build error: ${errorMsg}`, "failed");
    return {
      success: false,
      error: errorMsg,
      logs,
      iterations: totalIterations,
    };
  }
}
