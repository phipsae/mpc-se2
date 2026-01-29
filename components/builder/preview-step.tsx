"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Sparkles, X, AlertCircle } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Dynamic import for Monaco to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function PreviewStep() {
  const router = useRouter();
  const {
    generatedCode,
    setGeneratedCode,
    setStep,
    setCheckResult,
    setIsLoading,
    setLoadingMessage,
    isEditMode,
    setIsEditMode,
    plan,
    loadProject,
    currentProjectId,
  } = useBuilderStore();

  const [activeContract, setActiveContract] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const [activeTest, setActiveTest] = useState(0);
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [isModifying, setIsModifying] = useState(false);

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

  const handleCancelEdit = () => {
    if (currentProjectId) {
      // Reload the project to discard changes
      loadProject(currentProjectId);
    } else {
      setIsEditMode(false);
      setStep("results");
    }
  };

  const handleAIModification = async () => {
    if (!modificationPrompt.trim() || !generatedCode) return;

    setIsModifying(true);
    setIsLoading(true);
    setLoadingMessage("AI is modifying your code...");

    try {
      const response = await fetch("/api/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
          pages: generatedCode.pages,
          prompt: modificationPrompt,
        }),
      });

      const data = await response.json();

      if (data.status === "success" && data.fixedCode) {
        // Update the generated code with AI modifications
        setGeneratedCode({
          ...generatedCode,
          contracts: data.fixedCode.contracts || generatedCode.contracts,
          pages: data.fixedCode.pages || generatedCode.pages,
        });
        setModificationPrompt("");
      } else if (data.status === "error") {
        console.error("Modification error:", data.error);
      }
    } catch (error) {
      console.error("Error modifying code:", error);
    } finally {
      setIsModifying(false);
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

  const updateTestCode = (value: string | undefined, index: number) => {
    if (!generatedCode || !value) return;
    const newTests = [...(generatedCode.tests || [])];
    newTests[index] = { ...newTests[index], content: value };
    setGeneratedCode({ ...generatedCode, tests: newTests });
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
      {/* Edit Mode Header */}
      {isEditMode && (
        <Alert className="border-primary/50 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>Edit Mode:</strong> Modifying {plan?.contractName || "your dApp"}. 
              Changes will require recompilation and redeployment.
            </span>
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel Edit
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          {isEditMode ? "Edit Your Code" : "Review Generated Code"}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode 
            ? "Make changes manually or describe what you want to modify" 
            : "You can edit the code before deployment"}
        </p>
      </div>

      {/* AI Modification Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Assisted Modifications
          </CardTitle>
          <CardDescription>
            Describe the changes you want to make and AI will update your code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Example: Add a pause function that only the owner can call, or Change the mint price to 0.1 ETH..."
            value={modificationPrompt}
            onChange={(e) => setModificationPrompt(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <Button 
            onClick={handleAIModification}
            disabled={!modificationPrompt.trim() || isModifying}
            className="w-full"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isModifying ? "Modifying..." : "Apply AI Changes"}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="contracts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contracts">
            Contracts ({generatedCode.contracts.length})
          </TabsTrigger>
          <TabsTrigger value="pages">
            Pages ({generatedCode.pages.length})
          </TabsTrigger>
          <TabsTrigger value="tests">
            Tests ({generatedCode.tests?.length || 0})
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

        <TabsContent value="tests" className="space-y-4">
          {generatedCode.tests && generatedCode.tests.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {generatedCode.tests.map((test, i) => (
                <Badge
                  key={i}
                  variant={activeTest === i ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setActiveTest(i)}
                >
                  {test.name}
                </Badge>
              ))}
            </div>
          )}

          {generatedCode.tests && generatedCode.tests.length > 0 ? (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <span className="text-green-500">🧪</span>
                  {generatedCode.tests[activeTest]?.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Editor
                  height="500px"
                  language="typescript"
                  theme="vs-dark"
                  value={generatedCode.tests[activeTest]?.content}
                  onChange={(value) => updateTestCode(value, activeTest)}
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
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No tests generated yet. Tests will be generated automatically.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">
                {isEditMode ? "Ready to recompile?" : "Ready to compile?"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isEditMode 
                  ? "We'll recompile and verify your changes" 
                  : "We'll compile the contract and run security checks"}
              </p>
            </div>
            <div className="flex gap-2">
              {isEditMode ? (
                <>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel Edit
                  </Button>
                  <Button onClick={handleCompileAndCheck}>
                    Recompile & Check →
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setStep("plan")}>
                    ← Back to Plan
                  </Button>
                  <Button onClick={handleCompileAndCheck}>
                    Compile & Check →
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
