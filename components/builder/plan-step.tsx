"use client";

import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function PlanStep() {
  const {
    prompt,
    answers,
    plan,
    setStep,
    setGeneratedCode,
    setIsLoading,
    setLoadingMessage,
  } = useBuilderStore();

  const handleGenerate = async () => {
    setIsLoading(true);
    setLoadingMessage("Generating smart contract and frontend code...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, answers, plan }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedCode(data.code);
        setStep("preview");
      } else {
        console.error("Generation failed:", data.error);
      }
    } catch (error) {
      console.error("Error generating code:", error);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Here&apos;s the Plan</h1>
        <p className="text-muted-foreground">
          Review what we&apos;ll build before generating the code
        </p>
      </div>

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
            Frontend Pages
          </CardTitle>
          <CardDescription>
            React pages using Scaffold-ETH 2 components
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
              <h4 className="font-medium">Ready to generate?</h4>
              <p className="text-sm text-muted-foreground">
                This will create the Solidity contract and React components
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("prompt")}>
                ← Edit Requirements
              </Button>
              <Button onClick={handleGenerate}>Generate Code →</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
