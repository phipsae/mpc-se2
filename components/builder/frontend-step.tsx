"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Code, Sparkles } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type GenerateStatus = "idle" | "generating" | "success" | "failed";

export function FrontendStep() {
  const {
    generatedCode,
    setGeneratedCode,
    plan,
    prompt,
    setStep,
  } = useBuilderStore();

  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Auto-start generation when component mounts if no pages exist
  useEffect(() => {
    if (generatedCode && generatedCode.pages.length === 0 && status === "idle") {
      handleGenerate();
    }
  }, []);

  const handleGenerate = async () => {
    if (!generatedCode || !plan) return;

    setStatus("generating");
    setError(null);
    setProgress(0);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 90));
    }, 500);

    try {
      const response = await fetch("/api/generate-frontend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
          plan,
          prompt,
        }),
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate frontend");
      }

      // Update generatedCode with new pages
      setGeneratedCode({
        ...generatedCode,
        pages: data.pages,
      });

      setProgress(100);
      setStatus("success");

      // Auto-advance to preview after a brief delay
      setTimeout(() => {
        setStep("preview");
      }, 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Failed to generate frontend");
    }
  };

  // If pages already exist, show them and allow proceeding
  if (generatedCode && generatedCode.pages.length > 0 && status === "idle") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Frontend Ready</h1>
          <p className="text-muted-foreground">
            Your frontend has already been generated
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Generated Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {generatedCode.pages.map((page, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{page.path}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Ready to preview</h4>
                <p className="text-sm text-muted-foreground">
                  Review and edit your frontend code before deployment
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerate}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button onClick={() => setStep("preview")}>
                  Preview Code →
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
        <h1 className="text-3xl font-bold mb-2">Generating Frontend</h1>
        <p className="text-muted-foreground">
          Creating React pages for your tested contracts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "generating" && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {status === "success" && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {status === "failed" && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            {status === "idle" && (
              <Code className="h-5 w-5 text-muted-foreground" />
            )}
            Frontend Generation
          </CardTitle>
          <CardDescription>
            {status === "generating" && "AI is creating your frontend..."}
            {status === "success" && "Frontend generated successfully!"}
            {status === "failed" && "Frontend generation failed"}
            {status === "idle" && "Ready to generate frontend"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {status === "generating" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Generating...</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Creating React components with Scaffold-ETH 2 patterns...
              </p>
            </div>
          )}

          {/* Success State */}
          {status === "success" && generatedCode && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Generated {generatedCode.pages.length} page(s)</span>
              </div>
              <ul className="space-y-2">
                {generatedCode.pages.map((page, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{page.path}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Redirecting to preview...
              </p>
            </div>
          )}

          {/* Error State */}
          {status === "failed" && error && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button onClick={handleGenerate} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Idle State */}
          {status === "idle" && (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Your contracts have been tested and verified. Now let&apos;s create the frontend.
              </p>
              <Button onClick={handleGenerate} size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Frontend
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Summary */}
      {generatedCode && (
        <Card>
          <CardHeader>
            <CardTitle>Contracts Being Used</CardTitle>
            <CardDescription>
              Frontend will be generated to interact with these contracts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {generatedCode.contracts.map((contract, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-mono">{contract.name}</span>
                  <span className="text-muted-foreground">- Tested & Verified</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">
                {status === "success" ? "Frontend ready!" : "Generate frontend"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {status === "success" 
                  ? "Proceed to preview and edit your code"
                  : "Create React pages for your dApp"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("checks")}>
                ← Back to Checks
              </Button>
              {status === "success" && (
                <Button onClick={() => setStep("preview")}>
                  Preview Code →
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
