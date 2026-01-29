"use client";

import { useEffect, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Code,
  Shield,
  TestTube,
  Wrench,
  Rocket,
} from "lucide-react";
import { useBuilderStore, BuildProgressStatus } from "@/lib/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG: Record<
  BuildProgressStatus,
  { icon: React.ReactNode; label: string; color: string }
> = {
  idle: {
    icon: <Rocket className="h-5 w-5" />,
    label: "Ready",
    color: "text-muted-foreground",
  },
  generating: {
    icon: <Code className="h-5 w-5 animate-pulse" />,
    label: "Generating Code",
    color: "text-blue-500",
  },
  compiling: {
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
    label: "Compiling",
    color: "text-yellow-500",
  },
  fixing_compilation: {
    icon: <Wrench className="h-5 w-5 animate-pulse" />,
    label: "Fixing Compilation Errors",
    color: "text-orange-500",
  },
  checking_security: {
    icon: <Shield className="h-5 w-5 animate-pulse" />,
    label: "Security Analysis",
    color: "text-purple-500",
  },
  fixing_security: {
    icon: <Wrench className="h-5 w-5 animate-pulse" />,
    label: "Fixing Security Issues",
    color: "text-orange-500",
  },
  testing: {
    icon: <TestTube className="h-5 w-5 animate-pulse" />,
    label: "Running Tests",
    color: "text-cyan-500",
  },
  fixing_tests: {
    icon: <Wrench className="h-5 w-5 animate-pulse" />,
    label: "Fixing Test Failures",
    color: "text-orange-500",
  },
  done: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: "Build Complete",
    color: "text-green-500",
  },
  failed: {
    icon: <XCircle className="h-5 w-5" />,
    label: "Build Failed",
    color: "text-red-500",
  },
};

interface BuildProgressProps {
  onCancel?: () => void;
  onComplete?: () => void;
}

export function BuildProgressOverlay({ onCancel, onComplete }: BuildProgressProps) {
  const { buildProgress, autoMode } = useBuilderStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [buildProgress?.logs]);

  // Call onComplete when build is done
  useEffect(() => {
    if (buildProgress?.status === "done" && onComplete) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [buildProgress?.status, onComplete]);

  if (!autoMode || !buildProgress) {
    return null;
  }

  const config = STATUS_CONFIG[buildProgress.status];
  const isActive = !["done", "failed", "idle"].includes(buildProgress.status);
  const progressPercent = Math.min(
    ((buildProgress.iteration + 1) / buildProgress.maxIterations) * 100,
    100
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className={config.color}>{config.icon}</span>
            <span>Automated Build</span>
            {buildProgress.iteration > 0 && (
              <Badge variant="outline" className="ml-auto">
                Iteration {buildProgress.iteration}/{buildProgress.maxIterations}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{buildProgress.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {isActive && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{config.label}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Status Steps */}
          <div className="flex items-center justify-center gap-2 py-4">
            {["generating", "compiling", "checking_security", "testing"].map(
              (step, index) => {
                const stepConfig = STATUS_CONFIG[step as BuildProgressStatus];
                const currentIndex = [
                  "generating",
                  "compiling",
                  "fixing_compilation",
                  "checking_security",
                  "fixing_security",
                  "testing",
                  "fixing_tests",
                ].indexOf(buildProgress.status);
                const stepIndex = [
                  "generating",
                  "compiling",
                  "checking_security",
                  "testing",
                ].indexOf(step);

                const isComplete =
                  buildProgress.status === "done" ||
                  currentIndex > stepIndex * 2 + 1;
                const isCurrent =
                  currentIndex >= stepIndex * 2 &&
                  currentIndex <= stepIndex * 2 + 1;

                return (
                  <div key={step} className="flex items-center">
                    <div
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        isComplete
                          ? "bg-green-500/10 text-green-600"
                          : isCurrent
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-current" />
                      )}
                      <span className="hidden sm:inline">{stepConfig.label.split(" ")[0]}</span>
                    </div>
                    {index < 3 && (
                      <div
                        className={`w-8 h-0.5 ${
                          isComplete ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              }
            )}
          </div>

          {/* Logs */}
          <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs h-48 overflow-auto">
            {buildProgress.logs.length === 0 ? (
              <span className="text-zinc-500">Waiting for build output...</span>
            ) : (
              buildProgress.logs.map((log, i) => (
                <div key={i} className="py-0.5">
                  <span className="text-zinc-500 mr-2">&gt;</span>
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
            {isActive && <span className="animate-pulse">|</span>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isActive && onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {buildProgress.status === "done" && (
              <Button onClick={onComplete}>
                Continue to Results
              </Button>
            )}
            {buildProgress.status === "failed" && (
              <Button variant="destructive" onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
