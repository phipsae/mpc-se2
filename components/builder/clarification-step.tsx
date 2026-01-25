"use client";

import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClarificationStep() {
  const {
    prompt,
    questions,
    answers,
    setAnswer,
    setStep,
    setPlan,
    setIsLoading,
    setLoadingMessage,
  } = useBuilderStore();

  const handleSubmit = async () => {
    setIsLoading(true);
    setLoadingMessage("Processing your answers...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          answers,
          isFollowUp: true,
        }),
      });

      const data = await response.json();

      if (data.status === "ready") {
        setPlan(data.plan);
        setStep("plan");
      } else {
        console.error("Unexpected response:", data);
      }
    } catch (error) {
      console.error("Error processing answers:", error);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const allAnswered = questions.every(
    (q) => !q.required || answers[q.id] !== undefined
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">A few more details</h1>
        <p className="text-muted-foreground">
          Help us understand exactly what you need
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clarification Questions</CardTitle>
          <CardDescription>
            Please answer the following questions to help us build exactly what
            you want.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label htmlFor={question.id}>
                {question.question}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </Label>

              {question.type === "text" && (
                <Input
                  id={question.id}
                  value={(answers[question.id] as string) || ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                  placeholder="Enter your answer..."
                />
              )}

              {question.type === "number" && (
                <Input
                  id={question.id}
                  type="number"
                  value={(answers[question.id] as number) || ""}
                  onChange={(e) => setAnswer(question.id, Number(e.target.value))}
                  placeholder="Enter a number..."
                />
              )}

              {question.type === "select" && question.options && (
                <Select
                  value={(answers[question.id] as string) || ""}
                  onValueChange={(value) => setAnswer(question.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {question.type === "boolean" && (
                <Select
                  value={
                    answers[question.id] === undefined
                      ? ""
                      : answers[question.id]
                      ? "yes"
                      : "no"
                  }
                  onValueChange={(value) =>
                    setAnswer(question.id, value === "yes")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep("prompt")}>
              ← Back
            </Button>
            <Button onClick={handleSubmit} disabled={!allAnswered}>
              Continue →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
