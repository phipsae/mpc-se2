"use client";

import { useState } from "react";
import { useBuilderStore } from "@/lib/store";
import { buildDApp, isBuildServiceConfigured } from "@/lib/test-runner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Rocket, Zap, Info } from "lucide-react";
import { BuildProgressOverlay } from "./build-progress";

export function PromptStep() {
  const {
    prompt,
    setPrompt,
    setStep,
    setQuestions,
    setPlan,
    setIsLoading,
    setLoadingMessage,
    autoMode,
    setAutoMode,
    setBuildProgress,
    setGeneratedCode,
    setTestResult,
    setCheckResult,
    setProjectName,
  } = useBuilderStore();
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [error, setError] = useState<string | null>(null);
  const buildServiceAvailable = isBuildServiceConfigured();

  const handleAutoBuild = async () => {
    if (!localPrompt.trim()) return;

    setPrompt(localPrompt);
    setError(null);

    // First, analyze to get the plan
    setIsLoading(true);
    setLoadingMessage("Analyzing your request...");

    try {
      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: localPrompt }),
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeData.error) {
        setError(analyzeData.error);
        setIsLoading(false);
        return;
      }

      if (analyzeData.status === "needs_clarification") {
        // For auto mode, we still need clarification
        setQuestions(analyzeData.questions);
        setStep("clarification");
        setIsLoading(false);
        return;
      }

      if (analyzeData.status !== "ready" || !analyzeData.plan) {
        setError("Could not generate a plan. Please try rephrasing your request.");
        setIsLoading(false);
        return;
      }

      const plan = analyzeData.plan;
      setPlan(plan);
      // Set project name from AI suggestion
      if (plan.suggestedProjectName) {
        setProjectName(plan.suggestedProjectName);
      }
      setIsLoading(false);

      // Now start the automated build
      setBuildProgress({
        status: "generating",
        iteration: 0,
        maxIterations: 10,
        message: "Starting automated build...",
        logs: [],
      });

      const result = await buildDApp(localPrompt, plan, (progress) => {
        setBuildProgress(progress);
      });

      if (result.success && result.code) {
        setGeneratedCode(result.code);
        if (result.testResult) {
          setTestResult(result.testResult);
        }
        // Set check result from security warnings
        if (result.securityWarnings) {
          setCheckResult({
            compilation: { success: true, errors: [], warnings: [] },
            security: {
              warnings: result.securityWarnings.map((w) => ({
                severity: w.severity as "warning" | "error",
                message: w.message,
                line: w.line,
              })),
            },
            gas: { estimated: "~", costEth: "~", costUsd: "~" },
            size: { bytes: 0, kb: "~", withinLimit: true },
          });
        }
      } else {
        setError(result.error || "Build failed. Check the logs for details.");
      }
    } catch (err) {
      console.error("Auto build error:", err);
      setError("Failed to complete automated build. Please try again.");
      setBuildProgress(null);
    }
  };

  const handleBuildComplete = () => {
    setBuildProgress(null);
    setAutoMode(false);
    setStep("results");
  };

  const handleBuildCancel = () => {
    setBuildProgress(null);
    // Keep autoMode as is so user can try again
  };

  const handleAnalyze = async () => {
    if (!localPrompt.trim()) return;

    // If auto mode is enabled, use the automated build flow
    if (autoMode) {
      await handleAutoBuild();
      return;
    }

    setPrompt(localPrompt);
    setIsLoading(true);
    setLoadingMessage("Analyzing your request...");
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: localPrompt }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.status === "needs_clarification") {
        setQuestions(data.questions);
        setStep("clarification");
      } else if (data.status === "ready") {
        setPlan(data.plan);
        // Set project name from AI suggestion
        if (data.plan.suggestedProjectName) {
          setProjectName(data.plan.suggestedProjectName);
        }
        setStep("plan");
      } else {
        // Handle unexpected response
        console.error("Unexpected response:", data);
        setError("Received an unexpected response from the AI. Please try again.");
      }
    } catch (error) {
      console.error("Error analyzing prompt:", error);
      setError("Failed to analyze your request. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <>
      {/* Build Progress Overlay */}
      <BuildProgressOverlay
        onCancel={handleBuildCancel}
        onComplete={handleBuildComplete}
      />

      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">What do you want to build?</h1>
          <p className="text-muted-foreground">
            Describe your dApp in detail. The more specific, the better.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your dApp Description</CardTitle>
            <CardDescription>
              Include details about functionality, token economics, access control,
              and any specific features you need.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example: Create an NFT collection called 'Cool Cats' with a max supply of 10,000. Each NFT costs 0.05 ETH to mint. Only the owner can withdraw the collected ETH. Include a public mint page and an admin dashboard."
              className="min-h-[200px] resize-none"
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
            />

            {/* Auto Build Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="auto-mode" className="text-sm font-medium cursor-pointer">
                    Automatic Build Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Generate, compile, test, and fix automatically until working
                  </p>
                </div>
              </div>
              <Switch
                id="auto-mode"
                checked={autoMode}
                onCheckedChange={setAutoMode}
                disabled={!buildServiceAvailable}
              />
            </div>

            {autoMode && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Automatic Build Enabled</AlertTitle>
                <AlertDescription>
                  The system will generate code, run security tests, and automatically
                  fix any issues until all tests pass. This may take a few minutes.
                </AlertDescription>
              </Alert>
            )}

            {!buildServiceAvailable && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Auto build requires the test runner service. Set{" "}
                  <code className="bg-muted px-1 rounded">NEXT_PUBLIC_TEST_RUNNER_URL</code>{" "}
                  to enable.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={handleAnalyze}
                disabled={!localPrompt.trim()}
                className="gap-2"
              >
                {autoMode ? (
                  <>
                    <Rocket className="h-4 w-4" />
                    Build Automatically
                  </>
                ) : (
                  "Analyze Request →"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tips for better results</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Specify the type of contract (ERC-20, ERC-721, ERC-1155, custom)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Include numbers (supply limits, prices, percentages)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Describe access control (who can do what)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Mention any special features (royalties, whitelist, vesting)</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
