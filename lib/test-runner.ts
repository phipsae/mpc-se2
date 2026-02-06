import type { TestResult, ProjectPlan, GeneratedCode, BuildResult, BuildProgress, BuildProgressStatus } from "./store";

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
      message: "Connected! Starting build...",
      logs: ["Connected to build service", "Starting build process..."],
    });

    // Use fetch with streaming for SSE
    const response = await fetch(`${TEST_RUNNER_URL}/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, plan }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: BuildResult | null = null;
    let currentLogs: string[] = ["Connected to build service"];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (eventType === "progress") {
              currentLogs = data.logs || currentLogs;
              onProgress({
                status: data.status as BuildProgressStatus,
                iteration: data.iteration || 0,
                maxIterations: 10,
                message: data.message || "",
                logs: currentLogs,
              });
            } else if (eventType === "status") {
              onProgress({
                status: data.status as BuildProgressStatus,
                iteration: data.iteration || 0,
                maxIterations: 10,
                message: `Status: ${data.status}`,
                logs: currentLogs,
              });
            } else if (eventType === "complete") {
              finalResult = {
                success: data.success,
                code: data.code as GeneratedCode | undefined,
                testResult: data.testResult as TestResult | undefined,
                securityWarnings: data.securityWarnings,
                logs: data.logs || currentLogs,
                iterations: data.iterations || 0,
                elapsedMs: data.elapsedMs,
                error: data.error,
                compileErrors: data.compileErrors,
              };
              
              onProgress({
                status: data.success ? "done" : "failed",
                iteration: data.iterations || 0,
                maxIterations: 10,
                message: data.success ? "Build completed successfully!" : (data.error || "Build failed"),
                logs: data.logs || currentLogs,
              });
            }
          } catch (e) {
            console.warn("Failed to parse SSE data:", e);
          }
          eventType = "";
        }
      }
    }

    if (finalResult) {
      return finalResult;
    }

    throw new Error("Build completed without result");
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
// Validate Code - Run existing code through compile/security/test loop
// ============================================================================

export async function validateCode(
  code: GeneratedCode,
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
    status: "compiling",
    iteration: 0,
    maxIterations: 10,
    message: "Connecting to validation service...",
    logs: ["Starting code validation..."],
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
      status: "compiling",
      iteration: 0,
      maxIterations: 10,
      message: "Connected! Validating code...",
      logs: ["Connected to build service", "Starting validation..."],
    });

    // Send existing code for validation (skip generation)
    const response = await fetch(`${TEST_RUNNER_URL}/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        existingCode: {
          contracts: code.contracts,
          pages: code.pages,
          tests: code.tests || [],
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }

    // Read SSE stream (same logic as buildDApp)
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: BuildResult | null = null;
    let currentLogs: string[] = ["Connected to build service"];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (eventType === "progress") {
              currentLogs = data.logs || currentLogs;
              onProgress({
                status: data.status as BuildProgressStatus,
                iteration: data.iteration || 0,
                maxIterations: 10,
                message: data.message || "",
                logs: currentLogs,
              });
            } else if (eventType === "status") {
              onProgress({
                status: data.status as BuildProgressStatus,
                iteration: data.iteration || 0,
                maxIterations: 10,
                message: `Status: ${data.status}`,
                logs: currentLogs,
              });
            } else if (eventType === "complete") {
              finalResult = {
                success: data.success,
                code: data.code as GeneratedCode | undefined,
                testResult: data.testResult as TestResult | undefined,
                securityWarnings: data.securityWarnings,
                logs: data.logs || currentLogs,
                iterations: data.iterations || 0,
                elapsedMs: data.elapsedMs,
                error: data.error,
                compileErrors: data.compileErrors,
              };
              
              onProgress({
                status: data.success ? "done" : "failed",
                iteration: data.iterations || 0,
                maxIterations: 10,
                message: data.success ? "Validation completed successfully!" : (data.error || "Validation failed"),
                logs: data.logs || currentLogs,
              });
            }
          } catch (e) {
            console.warn("Failed to parse SSE data:", e);
          }
          eventType = "";
        }
      }
    }

    if (finalResult) {
      return finalResult;
    }

    throw new Error("Validation completed without result");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    onProgress({
      status: "failed",
      iteration: 0,
      maxIterations: 10,
      message: `Validation failed: ${errorMessage}`,
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
