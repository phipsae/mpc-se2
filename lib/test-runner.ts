import type { TestResult, ProjectPlan, GeneratedCode, BuildResult, BuildProgress } from "./store";

interface ContractFile {
  name: string;
  content: string;
}

interface TestFile {
  name: string;
  content: string;
}

const TEST_RUNNER_URL = process.env.NEXT_PUBLIC_TEST_RUNNER_URL;

// ============================================================================
// Auto Build - Full orchestration via Railway service
// ============================================================================

export async function buildDApp(
  prompt: string,
  plan: ProjectPlan,
  onProgress: (progress: BuildProgress) => void
): Promise<BuildResult> {
  if (!TEST_RUNNER_URL) {
    return {
      success: false,
      error: "Test runner service not configured",
      logs: ["Error: NEXT_PUBLIC_TEST_RUNNER_URL not set"],
      iterations: 0,
    };
  }

  // Initialize progress
  onProgress({
    status: "generating",
    iteration: 0,
    maxIterations: 10,
    message: "Connecting to build service...",
    logs: ["Starting automated build..."],
  });

  try {
    // Check service health first
    const healthCheck = await fetch(`${TEST_RUNNER_URL}/health`, {
      method: "GET",
    });

    if (!healthCheck.ok) {
      throw new Error("Build service is not available");
    }

    onProgress({
      status: "generating",
      iteration: 0,
      maxIterations: 10,
      message: "Generating code with AI...",
      logs: ["Connected to build service", "Generating contracts and tests..."],
    });

    // Call the build endpoint
    const response = await fetch(`${TEST_RUNNER_URL}/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, plan }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    // Update progress based on result
    if (result.success) {
      onProgress({
        status: "done",
        iteration: result.iterations || 0,
        maxIterations: 10,
        message: "Build completed successfully!",
        logs: result.logs || [],
      });
    } else {
      onProgress({
        status: "failed",
        iteration: result.iterations || 0,
        maxIterations: 10,
        message: result.error || "Build failed",
        logs: result.logs || [],
      });
    }

    return {
      success: result.success,
      code: result.code as GeneratedCode | undefined,
      testResult: result.testResult as TestResult | undefined,
      securityWarnings: result.securityWarnings,
      logs: result.logs || [],
      iterations: result.iterations || 0,
      elapsedMs: result.elapsedMs,
      error: result.error,
      compileErrors: result.compileErrors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    onProgress({
      status: "failed",
      iteration: 0,
      maxIterations: 10,
      message: `Build failed: ${errorMessage}`,
      logs: [`Error: ${errorMessage}`],
    });

    return {
      success: false,
      error: errorMessage,
      logs: [`Error: ${errorMessage}`],
      iterations: 0,
    };
  }
}

export function isBuildServiceConfigured(): boolean {
  return !!TEST_RUNNER_URL;
}

// ============================================================================
// Test Running - Individual test execution
// ============================================================================

export async function runTests(
  contracts: ContractFile[],
  tests: TestFile[],
  onOutput: (data: string) => void
): Promise<TestResult> {
  if (!TEST_RUNNER_URL) {
    onOutput("Error: Test runner service not configured.\n");
    onOutput("Please set NEXT_PUBLIC_TEST_RUNNER_URL in your environment.\n");
    return {
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      output: "Test runner not configured",
      tests: [],
    };
  }

  onOutput("=== Remote Test Runner ===\n\n");
  onOutput(`Connecting to test service...\n`);

  try {
    // Check service health first
    const healthCheck = await fetch(`${TEST_RUNNER_URL}/health`, {
      method: "GET",
    });

    if (!healthCheck.ok) {
      throw new Error("Test runner service is not available");
    }

    onOutput("Connected!\n\n");
    onOutput("Uploading contracts and tests...\n");
    onOutput(`  - ${contracts.length} contract(s)\n`);
    onOutput(`  - ${tests.length} test file(s)\n\n`);
    onOutput("Running tests (this may take a moment)...\n\n");

    const response = await fetch(`${TEST_RUNNER_URL}/run-tests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contracts, tests }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result: TestResult = await response.json();

    // Output the test results
    onOutput(result.output);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    onOutput(`\nError: ${errorMessage}\n`);
    
    return {
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      output: `Error: ${errorMessage}`,
      tests: [],
    };
  }
}

export function isTestRunnerConfigured(): boolean {
  return !!TEST_RUNNER_URL;
}
