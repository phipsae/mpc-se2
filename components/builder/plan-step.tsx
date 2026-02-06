"use client";

import { useState } from "react";
import { useBuilderStore } from "@/lib/store";
import { buildDApp, isBuildServiceConfigured } from "@/lib/test-runner";
import { BuildProgressOverlay } from "@/components/builder/build-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Rocket } from "lucide-react";

export function PlanStep() {
  const {
    prompt,
    plan,
    setStep,
    setGeneratedCode,
    setTestResult,
    setCheckResult,
    autoMode,
    setAutoMode,
    buildProgress,
    setBuildProgress,
  } = useBuilderStore();

  const [buildError, setBuildError] = useState<string | null>(null);

  const handleBuildAndTest = async () => {
    if (!plan) return;

    setBuildError(null);
    setAutoMode(true);
    setBuildProgress({
      status: "generating",
      iteration: 0,
      maxIterations: 10,
      message: "Starting automated build...",
      logs: ["Starting automated build..."],
    });

    try {
      const result = await buildDApp(prompt, plan, (progress) => {
        setBuildProgress(progress);
      });

      if (result.success && result.code) {
        // Store the generated and tested code
        setGeneratedCode(result.code);
        
        // Store test results if available
        if (result.testResult) {
          setTestResult(result.testResult);
        }

        // Store security warnings as part of check result
        if (result.securityWarnings) {
          // We'll run full checks in the checks step, but store warnings
          setCheckResult({
            compilation: { success: true, errors: [], warnings: [] },
            security: { 
              warnings: result.securityWarnings.map(w => ({
                severity: w.severity as "warning" | "error",
                message: w.message,
                line: w.line,
              }))
            },
            gas: { estimated: "~", costEth: "~", costUsd: "~" },
            size: { bytes: 0, kb: "~", withinLimit: true },
          });
        }

        // Small delay to show success message
        setTimeout(() => {
          setAutoMode(false);
          setBuildProgress(null);
          setStep("checks");
        }, 1500);
      } else {
        // Build failed after all retries
        setBuildError(result.error || "Build failed after maximum attempts");
        setAutoMode(false);
        setBuildProgress(null);
      }
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Build failed");
      setAutoMode(false);
      setBuildProgress(null);
    }
  };

  const handleCancel = () => {
    setAutoMode(false);
    setBuildProgress(null);
  };

  const buildServiceConfigured = isBuildServiceConfigured();

  if (!plan) {
    return (
      <div className="text-center">
        <p>No plan available. Please go back and try again.</p>
        <Button onClick={() => setStep("prompt")} className="mt-4">
          Start Over
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Build Progress Overlay */}
      {autoMode && buildProgress && (
        <BuildProgressOverlay 
          onCancel={handleCancel}
          onComplete={() => {
            setAutoMode(false);
            setBuildProgress(null);
            setStep("checks");
          }}
        />
      )}

      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Here&apos;s the Plan</h1>
          <p className="text-muted-foreground">
            Review what we&apos;ll build before generating the code
          </p>
        </div>

        {/* Build Service Warning */}
        {!buildServiceConfigured && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Build Service Not Configured</AlertTitle>
            <AlertDescription>
              The automated build service is not configured. Set{" "}
              <code className="bg-muted px-1 rounded">NEXT_PUBLIC_TEST_RUNNER_URL</code>{" "}
              in your environment to enable automated testing.
            </AlertDescription>
          </Alert>
        )}

        {/* Build Error */}
        {buildError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Build Failed</AlertTitle>
            <AlertDescription>{buildError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              Smart Contract: {plan.contractName}.sol
            </CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <div className="flex flex-wrap gap-2">
                {plan.features.map((feature, i) => (
                  <Badge key={i} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🖥️</span>
              Planned Frontend Pages
            </CardTitle>
            <CardDescription>
              These will be generated after contracts pass testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.pages.map((page, i) => (
                <div key={i} className="flex items-start gap-3">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {page.path}
                  </code>
                  <span className="text-muted-foreground text-sm">
                    {page.description}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Ready to build?</h4>
                <p className="text-sm text-muted-foreground">
                  This will generate contracts, deploy to Foundry, and run tests automatically
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("prompt")}>
                  ← Edit Requirements
                </Button>
                <Button 
                  onClick={handleBuildAndTest}
                  disabled={!buildServiceConfigured}
                  className="gap-2"
                >
                  <Rocket className="h-4 w-4" />
                  Build & Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
