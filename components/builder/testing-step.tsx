"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  SkipForward,
  Terminal,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { runTests, isTestRunnerConfigured } from "@/lib/test-runner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type TestingStatus = "idle" | "connecting" | "running" | "done" | "booting";

export function TestingStep() {
  const {
    generatedCode,
    testResult,
    setTestResult,
    testOutput,
    setTestOutput,
    appendTestOutput,
    setStep,
  } = useBuilderStore();

  const [status, setStatus] = useState<TestingStatus>("idle");
  const [acknowledgedSkip, setAcknowledgedSkip] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>(
    {}
  );
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [testOutput]);

  const handleRunTests = async () => {
    if (!generatedCode?.contracts.length || !generatedCode?.tests?.length) {
      return;
    }

    setStatus("connecting");
    setTestOutput("");
    setTestResult(null);

    try {
      const result = await runTests(
        generatedCode.contracts,
        generatedCode.tests,
        (data) => {
          appendTestOutput(data);
          // Update status based on output
          if (data.includes("Running tests")) {
            setStatus("running");
          }
        }
      );

      setTestResult(result);
      setStatus("done");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Test execution failed";
      appendTestOutput(`\nError: ${errorMessage}\n`);
      setTestResult({
        success: false,
        totalTests: 0,
        passed: 0,
        failed: 0,
        output: testOutput,
        tests: [],
      });
      setStatus("done");
    }
  };

  const handleSkipTests = () => {
    if (acknowledgedSkip) {
      // Skip to checks (then frontend, then deploy)
      setStep("checks");
    }
  };

  const handleContinue = () => {
    // After tests pass, go to security checks
    setStep("checks");
  };

  const getStatusMessage = () => {
    switch (status) {
      case "connecting":
        return "Connecting to test service...";
      case "running":
        return "Running tests...";
      case "done":
        return testResult?.success ? "Tests passed!" : "Tests completed";
      default:
        return "Ready to run tests";
    }
  };

  const isRunning = status === "connecting" || status === "running";
  const testRunnerConfigured = isTestRunnerConfigured();
  const canDeploy = testResult?.success || acknowledgedSkip;

  const handleGenerateTests = async () => {
    if (!generatedCode?.contracts?.length) return;

    setStatus("booting");
    setTestOutput("Generating tests for your contracts...\n");

    try {
      const response = await fetch("/api/generate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
        }),
      });

      const data = await response.json();

      if (data.success && data.tests?.length) {
        // Update the store with generated tests
        const { setGeneratedCode } = useBuilderStore.getState();
        setGeneratedCode({
          ...generatedCode,
          tests: data.tests,
        });
        appendTestOutput("Tests generated successfully!\n");
        setStatus("idle");
      } else {
        appendTestOutput(`Failed to generate tests: ${data.error || "Unknown error"}\n`);
        setStatus("idle");
      }
    } catch (error) {
      appendTestOutput(`Error: ${error instanceof Error ? error.message : "Failed to generate tests"}\n`);
      setStatus("idle");
    }
  };

  if (!generatedCode?.tests?.length) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Testing</h1>
          <p className="text-muted-foreground">
            No tests were generated for this contract.
          </p>
        </div>
        
        {/* Generate Tests Option */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Generate Tests
            </CardTitle>
            <CardDescription>
              Generate unit tests for your smart contract using AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {testOutput && (
              <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-sm max-h-40 overflow-auto whitespace-pre-wrap">
                {testOutput}
              </div>
            )}
            <Button 
              onClick={handleGenerateTests}
              disabled={status !== "idle" || !generatedCode?.contracts?.length}
              className="gap-2"
            >
              {status === "booting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {status === "booting" ? "Generating..." : "Generate Tests"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                You can proceed to deployment without tests.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("plan")}>
                  Back to Plan
                </Button>
                <Button onClick={() => setStep("checks")}>
                  Continue to Checks
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Smart Contract Testing</h1>
        <p className="text-muted-foreground">
          Run Foundry tests to verify your contracts before proceeding
        </p>
      </div>

      {/* Warning if test runner not configured */}
      {!testRunnerConfigured && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Test Runner Not Configured</AlertTitle>
          <AlertDescription>
            The remote test runner service is not configured. Set{" "}
            <code className="bg-muted px-1 rounded">NEXT_PUBLIC_TEST_RUNNER_URL</code>{" "}
            in your environment variables. You can skip tests and deploy, then test locally.
          </AlertDescription>
        </Alert>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Test Runner
          </CardTitle>
          <CardDescription>{getStatusMessage()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Terminal Output */}
          <div
            ref={terminalRef}
            className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-sm h-80 overflow-auto whitespace-pre-wrap"
          >
            {testOutput || (
              <span className="text-zinc-500">
                Click &quot;Run Tests&quot; to start testing your contracts...
              </span>
            )}
            {isRunning && <span className="animate-pulse">|</span>}
          </div>

          {/* Run/Status Controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRunTests}
              disabled={isRunning || !testRunnerConfigured}
              className="gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning
                ? status === "connecting"
                  ? "Connecting..."
                  : "Running..."
                : testResult
                  ? "Run Again"
                  : "Run Tests"}
            </Button>

            {/* Progress indicator */}
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className={`w-2 h-2 rounded-full ${status === "connecting" ? "bg-primary animate-pulse" : "bg-green-500"}`}
                />
                Connect
                <span className="text-muted-foreground/50">→</span>
                <span
                  className={`w-2 h-2 rounded-full ${status === "running" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
                />
                Test
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Results Summary */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{testResult.totalTests}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-600">
                  {testResult.passed}
                </div>
                <div className="text-sm text-green-600/80">Passed</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-600">
                  {testResult.failed}
                </div>
                <div className="text-sm text-red-600/80">Failed</div>
              </div>
            </div>

            {/* Individual Test Results */}
            {testResult.tests.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Test Details</h4>
                <div className="space-y-1">
                  {testResult.tests.map((test, i) => (
                    <Collapsible
                      key={i}
                      open={expandedTests[test.name]}
                      onOpenChange={(open) =>
                        setExpandedTests((prev) => ({
                          ...prev,
                          [test.name]: open,
                        }))
                      }
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded hover:bg-muted text-left">
                        {test.status === "passed" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-sm flex-1 truncate">
                          {test.name}
                        </span>
                        {test.error && (
                          <>
                            {expandedTests[test.name] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </>
                        )}
                        {test.gasUsed && (
                          <Badge variant="outline" className="text-xs">
                            {test.gasUsed} gas
                          </Badge>
                        )}
                      </CollapsibleTrigger>
                      {test.error && (
                        <CollapsibleContent>
                          <div className="ml-6 p-2 text-sm bg-red-500/10 text-red-600 rounded">
                            {test.error}
                          </div>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Skip Tests Option */}
      {!testResult?.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SkipForward className="h-5 w-5" />
              Skip Tests
            </CardTitle>
            <CardDescription>
              You can skip testing and proceed to checks, but this is not
              recommended.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={acknowledgedSkip}
                onChange={(e) => setAcknowledgedSkip(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">
                I understand the risks of deploying untested code and want to
                proceed anyway
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Failed Tests Warning */}
      {testResult && !testResult.success && testResult.failed > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Tests Failed</AlertTitle>
          <AlertDescription>
            {testResult.failed} test(s) failed. It is strongly recommended to
            fix these issues before deploying. You can go back to edit your code
            or skip tests at your own risk.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">
                {canDeploy
                  ? testResult?.success
                    ? "All tests passed!"
                    : "Proceeding without passing tests"
                  : "Run tests to continue"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {canDeploy
                  ? "You can proceed to security checks"
                  : "Tests must pass or be acknowledged to continue"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("plan")}>
                ← Back to Plan
              </Button>
              {acknowledgedSkip && !testResult?.success ? (
                <Button variant="destructive" onClick={handleSkipTests}>
                  Skip Tests & Continue
                </Button>
              ) : (
                <Button onClick={handleContinue} disabled={!canDeploy}>
                  Continue to Checks →
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
