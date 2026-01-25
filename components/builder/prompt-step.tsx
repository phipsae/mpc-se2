"use client";

import { useState } from "react";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function PromptStep() {
  const { prompt, setPrompt, setStep, setQuestions, setPlan, setIsLoading, setLoadingMessage } = useBuilderStore();
  const [localPrompt, setLocalPrompt] = useState(prompt);

  const handleAnalyze = async () => {
    if (!localPrompt.trim()) return;

    setPrompt(localPrompt);
    setIsLoading(true);
    setLoadingMessage("Analyzing your request...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: localPrompt }),
      });

      const data = await response.json();

      if (data.status === "needs_clarification") {
        setQuestions(data.questions);
        setStep("clarification");
      } else if (data.status === "ready") {
        setPlan(data.plan);
        setStep("plan");
      } else {
        // Handle error
        console.error("Unexpected response:", data);
      }
    } catch (error) {
      console.error("Error analyzing prompt:", error);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">What do you want to build?</h1>
        <p className="text-muted-foreground">
          Describe your dApp in detail. The more specific, the better.
        </p>
      </div>

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
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={!localPrompt.trim()}
            >
              Analyze Request →
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
  );
}
