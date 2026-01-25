"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBuilderStore } from "@/lib/store";
import { PromptStep } from "@/components/builder/prompt-step";
import { ClarificationStep } from "@/components/builder/clarification-step";
import { PlanStep } from "@/components/builder/plan-step";
import { PreviewStep } from "@/components/builder/preview-step";
import { ChecksStep } from "@/components/builder/checks-step";
import { DeployStep } from "@/components/builder/deploy-step";
import { ResultsStep } from "@/components/builder/results-step";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  { id: "prompt", label: "Prompt", number: 1 },
  { id: "clarification", label: "Clarify", number: 2 },
  { id: "plan", label: "Plan", number: 3 },
  { id: "generate", label: "Generate", number: 4 },
  { id: "preview", label: "Preview", number: 4 },
  { id: "checks", label: "Checks", number: 5 },
  { id: "deploy", label: "Deploy", number: 6 },
  { id: "github", label: "GitHub", number: 7 },
  { id: "vercel", label: "Vercel", number: 8 },
  { id: "results", label: "Done", number: 9 },
];

export default function BuilderPage() {
  const router = useRouter();
  const { step, prompt, isLoading, loadingMessage } = useBuilderStore();

  // Redirect if no prompt
  useEffect(() => {
    if (!prompt && step === "prompt") {
      // Allow staying on prompt step to enter new prompt
    }
  }, [prompt, step, router]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const renderStep = () => {
    switch (step) {
      case "prompt":
        return <PromptStep />;
      case "clarification":
        return <ClarificationStep />;
      case "plan":
        return <PlanStep />;
      case "generate":
      case "preview":
        return <PreviewStep />;
      case "checks":
        return <ChecksStep />;
      case "deploy":
      case "github":
      case "vercel":
        return <DeployStep />;
      case "results":
        return <ResultsStep />;
      default:
        return <PromptStep />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-2xl">🏗️</span>
              <span className="font-bold text-xl">AI dApp Builder</span>
            </button>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {currentStepIndex + 1} of {STEPS.length}:{" "}
              {STEPS[currentStepIndex]?.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-lg font-medium">{loadingMessage || "Loading..."}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {renderStep()}
      </main>
    </div>
  );
}
