"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Dynamic import for Monaco to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function PreviewStep() {
  const {
    generatedCode,
    setGeneratedCode,
    setStep,
    setCheckResult,
    setIsLoading,
    setLoadingMessage,
  } = useBuilderStore();

  const [activeContract, setActiveContract] = useState(0);
  const [activePage, setActivePage] = useState(0);

  const handleCompileAndCheck = async () => {
    if (!generatedCode) return;

    setIsLoading(true);
    setLoadingMessage("Compiling and running security checks...");

    try {
      // First compile
      const compileResponse = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
        }),
      });

      const compileData = await compileResponse.json();

      // Then run security checks
      const checkResponse = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
          compilationResult: compileData,
        }),
      });

      const checkData = await checkResponse.json();

      setCheckResult(checkData);
      setStep("checks");
    } catch (error) {
      console.error("Error compiling/checking:", error);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const updateContractCode = (value: string | undefined, index: number) => {
    if (!generatedCode || !value) return;
    const newContracts = [...generatedCode.contracts];
    newContracts[index] = { ...newContracts[index], content: value };
    setGeneratedCode({ ...generatedCode, contracts: newContracts });
  };

  const updatePageCode = (value: string | undefined, index: number) => {
    if (!generatedCode || !value) return;
    const newPages = [...generatedCode.pages];
    newPages[index] = { ...newPages[index], content: value };
    setGeneratedCode({ ...generatedCode, pages: newPages });
  };

  if (!generatedCode) {
    return (
      <div className="text-center">
        <p>No code generated. Please go back and try again.</p>
        <Button onClick={() => setStep("plan")} className="mt-4">
          Back to Plan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Review Generated Code</h1>
        <p className="text-muted-foreground">
          You can edit the code before deployment
        </p>
      </div>

      <Tabs defaultValue="contracts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contracts">
            Smart Contracts ({generatedCode.contracts.length})
          </TabsTrigger>
          <TabsTrigger value="pages">
            Frontend Pages ({generatedCode.pages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4">
          {generatedCode.contracts.length > 1 && (
            <div className="flex gap-2">
              {generatedCode.contracts.map((contract, i) => (
                <Badge
                  key={i}
                  variant={activeContract === i ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setActiveContract(i)}
                >
                  {contract.name}
                </Badge>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <span className="text-yellow-500">📄</span>
                {generatedCode.contracts[activeContract]?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Editor
                height="500px"
                language="solidity"
                theme="vs-dark"
                value={generatedCode.contracts[activeContract]?.content}
                onChange={(value) => updateContractCode(value, activeContract)}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          {generatedCode.pages.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {generatedCode.pages.map((page, i) => (
                <Badge
                  key={i}
                  variant={activePage === i ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setActivePage(i)}
                >
                  {page.path}
                </Badge>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <span className="text-blue-500">⚛️</span>
                {generatedCode.pages[activePage]?.path}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Editor
                height="500px"
                language="typescript"
                theme="vs-dark"
                value={generatedCode.pages[activePage]?.content}
                onChange={(value) => updatePageCode(value, activePage)}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Ready to compile?</h4>
              <p className="text-sm text-muted-foreground">
                We&apos;ll compile the contract and run security checks
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("plan")}>
                ← Back to Plan
              </Button>
              <Button onClick={handleCompileAndCheck}>
                Compile & Check →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
