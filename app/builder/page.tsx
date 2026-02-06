"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBuilderStore, BuilderStep } from "@/lib/store";
import { PromptStep } from "@/components/builder/prompt-step";
import { ClarificationStep } from "@/components/builder/clarification-step";
import { PlanStep } from "@/components/builder/plan-step";
import { PreviewStep } from "@/components/builder/preview-step";
import { ChecksStep } from "@/components/builder/checks-step";
import { FrontendStep } from "@/components/builder/frontend-step";
import { DeployStep } from "@/components/builder/deploy-step";
import { ResultsStep } from "@/components/builder/results-step";
import { Progress } from "@/components/ui/progress";

// Visible steps shown in progress bar (testing is automated, not shown)
const STEPS = [
  { id: "prompt", label: "Prompt", number: 1 },
  { id: "clarification", label: "Clarify", number: 2 },
  { id: "plan", label: "Build & Test", number: 3 },  // Automated build happens here
  { id: "checks", label: "Checks", number: 4 },
  { id: "frontend", label: "Frontend", number: 5 },
  { id: "preview", label: "Preview", number: 6 },
  { id: "deploy", label: "Deploy", number: 7 },
  { id: "github", label: "GitHub", number: 8 },
  { id: "vercel", label: "Vercel", number: 9 },
  { id: "results", label: "Done", number: 10 },
];

// Steps that trigger auto-save (save progress after meaningful work)
const AUTO_SAVE_STEPS: BuilderStep[] = [
  "clarification",
  "plan",
  "checks",
  "frontend",
  "preview",
  "deploy",
  "github",
  "vercel",
];

export default function BuilderPage() {
  const router = useRouter();
  const { step, prompt, isLoading, loadingMessage, saveDraft, isEditMode } = useBuilderStore();
  const previousStep = useRef<BuilderStep | null>(null);

  // Auto-save draft when moving to significant steps
  useEffect(() => {
    // Don't auto-save if no prompt yet or in edit mode (editing deployed project)
    if (!prompt || isEditMode) return;

    // Only save when step changes to a save-worthy step
    if (
      AUTO_SAVE_STEPS.includes(step) &&
      previousStep.current !== step
    ) {
      saveDraft();
    }

    previousStep.current = step;
  }, [step, prompt, saveDraft, isEditMode]);

  // Map internal steps to their visible counterpart
  const visibleStep = step === "generate" || step === "testing" ? "plan" : step;
  const currentStepIndex = Math.max(0, STEPS.findIndex((s) => s.id === visibleStep));
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const renderStep = () => {
    switch (step) {
      case "prompt":
        return <PromptStep />;
      case "clarification":
        return <ClarificationStep />;
      case "plan":
      case "generate":
      case "testing":
        // Plan step handles automated build & test
        // Generate and testing are now internal states
        return <PlanStep />;
      case "checks":
        return <ChecksStep />;
      case "frontend":
        return <FrontendStep />;
      case "preview":
        return <PreviewStep />;
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
