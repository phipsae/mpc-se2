"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FixStatus = "idle" | "analyzing" | "fixing" | "verifying" | "success" | "failed";

async function runChecks(contracts: { name: string; content: string }[]) {
  // Compile first
  const compileRes = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contracts }),
  });
  const compileData = await compileRes.json();

  // Run security checks with compilation result
  const checkRes = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contracts,
      compilationResult: {
        success: compileData.success,
        errors: compileData.errors || [],
        warnings: compileData.warnings || [],
        bytecode: compileData.bytecode || "",
      },
    }),
  });
  const checkData = await checkRes.json();

  return checkData;
}

const NETWORKS = [
  { id: 11155111, name: "Sepolia", type: "testnet" },
  { id: 84532, name: "Base Sepolia", type: "testnet" },
  { id: 11155420, name: "Optimism Sepolia", type: "testnet" },
  { id: 421614, name: "Arbitrum Sepolia", type: "testnet" },
  { id: 1, name: "Ethereum Mainnet", type: "mainnet" },
  { id: 8453, name: "Base", type: "mainnet" },
  { id: 10, name: "Optimism", type: "mainnet" },
  { id: 42161, name: "Arbitrum", type: "mainnet" },
];

export function ChecksStep() {
  const {
    checkResult,
    setCheckResult,
    selectedNetwork,
    setSelectedNetwork,
    setStep,
    generatedCode,
    setGeneratedCode,
  } = useBuilderStore();

  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false);
  
  // Compilation fix state
  const [fixStatus, setFixStatus] = useState<FixStatus>("idle");
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixAttempts, setFixAttempts] = useState(0);

  // Security fix state
  const [securityFixStatus, setSecurityFixStatus] = useState<FixStatus>("idle");
  const [securityFixError, setSecurityFixError] = useState<string | null>(null);
  const [securityFixAttempts, setSecurityFixAttempts] = useState(0);

  const isFixing = fixStatus === "analyzing" || fixStatus === "fixing" || fixStatus === "verifying";
  const isFixingSecurity = securityFixStatus === "analyzing" || securityFixStatus === "fixing" || securityFixStatus === "verifying";

  const handleFixErrors = async () => {
    if (!generatedCode || !checkResult?.compilation.errors.length) return;

    setFixStatus("analyzing");
    setFixError(null);

    try {
      // Stage 1: Analyzing
      await new Promise((r) => setTimeout(r, 500)); // Brief delay for UX
      setFixStatus("fixing");

      // Stage 2: Call the fix API
      const fixRes = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
          errors: checkResult.compilation.errors,
        }),
      });

      const fixData = await fixRes.json();

      if (!fixData.success) {
        throw new Error(fixData.error || "Failed to fix errors");
      }

      // Update the generated code with fixed contracts
      setGeneratedCode({
        ...generatedCode,
        contracts: fixData.contracts,
      });

      // Stage 3: Verifying the fix
      setFixStatus("verifying");
      const newCheckResult = await runChecks(fixData.contracts);
      setCheckResult(newCheckResult);

      // Check if fix was successful
      if (newCheckResult.compilation.success) {
        setFixStatus("success");
        setFixAttempts((prev) => prev + 1);
      } else {
        setFixStatus("failed");
        setFixAttempts((prev) => prev + 1);
        setFixError("Fix applied but compilation still has errors. You can try again.");
      }
    } catch (error) {
      setFixStatus("failed");
      setFixError(error instanceof Error ? error.message : "Failed to fix errors");
    }
  };

  const getFixStatusMessage = () => {
    switch (fixStatus) {
      case "analyzing":
        return "Analyzing compilation errors...";
      case "fixing":
        return "AI is generating fixes...";
      case "verifying":
        return "Verifying the fix compiles correctly...";
      case "success":
        return "Fixed successfully!";
      case "failed":
        return "Fix attempt failed";
      default:
        return "";
    }
  };

  const getSecurityFixStatusMessage = () => {
    switch (securityFixStatus) {
      case "analyzing":
        return "Analyzing security issues...";
      case "fixing":
        return "AI is fixing security issues...";
      case "verifying":
        return "Verifying the fix...";
      case "success":
        return "Security issues fixed!";
      case "failed":
        return "Fix attempt failed";
      default:
        return "";
    }
  };

  const handleFixSecurityWarnings = async () => {
    if (!generatedCode || !checkResult?.security.warnings.length) return;

    setSecurityFixStatus("analyzing");
    setSecurityFixError(null);

    try {
      await new Promise((r) => setTimeout(r, 500));
      setSecurityFixStatus("fixing");

      // Format security warnings for the fix API
      const securityIssues = checkResult.security.warnings.map((w) => 
        `[${w.severity.toUpperCase()}]${w.line ? ` Line ${w.line}:` : ""} ${w.message}`
      );

      const fixRes = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contracts: generatedCode.contracts,
          errors: securityIssues,
          fixType: "security",
        }),
      });

      const fixData = await fixRes.json();

      if (!fixData.success) {
        throw new Error(fixData.error || "Failed to fix security issues");
      }

      setGeneratedCode({
        ...generatedCode,
        contracts: fixData.contracts,
      });

      setSecurityFixStatus("verifying");
      const newCheckResult = await runChecks(fixData.contracts);
      setCheckResult(newCheckResult);

      // Check if security warnings are resolved
      const remainingWarnings = newCheckResult.security.warnings.length;
      const previousWarnings = checkResult.security.warnings.length;

      if (remainingWarnings < previousWarnings) {
        setSecurityFixStatus("success");
        setSecurityFixAttempts((prev) => prev + 1);
        if (remainingWarnings > 0) {
          setSecurityFixError(`Reduced from ${previousWarnings} to ${remainingWarnings} issues. You can try again.`);
        }
      } else if (remainingWarnings === 0) {
        setSecurityFixStatus("success");
        setSecurityFixAttempts((prev) => prev + 1);
      } else {
        setSecurityFixStatus("failed");
        setSecurityFixAttempts((prev) => prev + 1);
        setSecurityFixError("Could not fix all security issues. You can try again or proceed with caution.");
      }
    } catch (error) {
      setSecurityFixStatus("failed");
      setSecurityFixError(error instanceof Error ? error.message : "Failed to fix security issues");
    }
  };

  if (!checkResult) {
    return (
      <div className="text-center">
        <p>No check results available.</p>
        <Button onClick={() => setStep("preview")} className="mt-4">
          Back to Preview
        </Button>
      </div>
    );
  }

  const hasErrors =
    !checkResult.compilation.success ||
    !checkResult.size.withinLimit ||
    checkResult.security.warnings.some((w) => w.severity === "error");

  const hasWarnings = checkResult.security.warnings.some(
    (w) => w.severity === "warning"
  );

  const canDeploy = !hasErrors && (!hasWarnings || acknowledgedWarnings);

  const selectedNetworkInfo = NETWORKS.find((n) => n.id === selectedNetwork);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Pre-Deployment Checks</h1>
        <p className="text-muted-foreground">
          Review the results before deploying
        </p>
      </div>

      {/* Compilation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {checkResult.compilation.success ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-red-500">✗</span>
            )}
            Compilation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkResult.compilation.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-green-600">Successfully compiled</p>
              {fixStatus === "success" && (
                <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                  Fixed by AI
                </Badge>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {checkResult.compilation.errors.map((error, i) => (
                  <Alert key={i} variant="destructive">
                    <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                      {error}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>

              {/* Fix Progress Section */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleFixErrors}
                    disabled={isFixing}
                    className="gap-2"
                  >
                    {isFixing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isFixing ? "Fixing..." : fixAttempts > 0 ? "Try Again" : "Fix with AI"}
                  </Button>

                  {fixStatus !== "idle" && (
                    <div className="flex items-center gap-2 text-sm">
                      {fixStatus === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : fixStatus === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      <span
                        className={
                          fixStatus === "success"
                            ? "text-green-600"
                            : fixStatus === "failed"
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }
                      >
                        {getFixStatusMessage()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Steps */}
                {isFixing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`flex items-center gap-1 ${fixStatus === "analyzing" ? "text-primary font-medium" : "text-green-600"}`}>
                      <span className={`w-2 h-2 rounded-full ${fixStatus === "analyzing" ? "bg-primary animate-pulse" : "bg-green-500"}`} />
                      Analyze
                    </div>
                    <span>→</span>
                    <div className={`flex items-center gap-1 ${fixStatus === "fixing" ? "text-primary font-medium" : fixStatus === "verifying" ? "text-green-600" : ""}`}>
                      <span className={`w-2 h-2 rounded-full ${fixStatus === "fixing" ? "bg-primary animate-pulse" : fixStatus === "verifying" ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      Generate Fix
                    </div>
                    <span>→</span>
                    <div className={`flex items-center gap-1 ${fixStatus === "verifying" ? "text-primary font-medium" : ""}`}>
                      <span className={`w-2 h-2 rounded-full ${fixStatus === "verifying" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
                      Verify
                    </div>
                  </div>
                )}

                {fixAttempts > 0 && !isFixing && (
                  <p className="text-xs text-muted-foreground">
                    Attempted {fixAttempts} {fixAttempts === 1 ? "fix" : "fixes"}
                  </p>
                )}
              </div>

              {fixError && (
                <Alert variant="destructive">
                  <AlertDescription>{fixError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {checkResult.compilation.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Compiler warnings:</p>
              {checkResult.compilation.warnings.map((warning, i) => (
                <Alert key={i}>
                  <AlertDescription className="text-yellow-600">
                    {warning}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {checkResult.security.warnings.length === 0 ? (
              <span className="text-green-500">✓</span>
            ) : hasErrors ? (
              <span className="text-red-500">✗</span>
            ) : (
              <span className="text-yellow-500">⚠</span>
            )}
            Security Analysis
            {securityFixStatus === "success" && checkResult.security.warnings.length === 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                Fixed by AI
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkResult.security.warnings.length === 0 ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-green-600">No security issues detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkResult.security.warnings.map((warning, i) => (
                <Alert
                  key={i}
                  variant={warning.severity === "error" ? "destructive" : "default"}
                >
                  <AlertTitle className="flex items-center gap-2">
                    <Badge
                      variant={
                        warning.severity === "error" ? "destructive" : "secondary"
                      }
                    >
                      {warning.severity}
                    </Badge>
                    {warning.line && <span>Line {warning.line}</span>}
                  </AlertTitle>
                  <AlertDescription>{warning.message}</AlertDescription>
                </Alert>
              ))}

              {/* Security Fix Section */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3 mt-4">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleFixSecurityWarnings}
                    disabled={isFixingSecurity || !checkResult.compilation.success}
                    variant="secondary"
                    className="gap-2"
                  >
                    {isFixingSecurity ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isFixingSecurity ? "Fixing..." : securityFixAttempts > 0 ? "Try Again" : "Fix with AI"}
                  </Button>

                  {securityFixStatus !== "idle" && (
                    <div className="flex items-center gap-2 text-sm">
                      {securityFixStatus === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : securityFixStatus === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      <span
                        className={
                          securityFixStatus === "success"
                            ? "text-green-600"
                            : securityFixStatus === "failed"
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }
                      >
                        {getSecurityFixStatusMessage()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Steps */}
                {isFixingSecurity && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`flex items-center gap-1 ${securityFixStatus === "analyzing" ? "text-primary font-medium" : "text-green-600"}`}>
                      <span className={`w-2 h-2 rounded-full ${securityFixStatus === "analyzing" ? "bg-primary animate-pulse" : "bg-green-500"}`} />
                      Analyze
                    </div>
                    <span>→</span>
                    <div className={`flex items-center gap-1 ${securityFixStatus === "fixing" ? "text-primary font-medium" : securityFixStatus === "verifying" ? "text-green-600" : ""}`}>
                      <span className={`w-2 h-2 rounded-full ${securityFixStatus === "fixing" ? "bg-primary animate-pulse" : securityFixStatus === "verifying" ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      Generate Fix
                    </div>
                    <span>→</span>
                    <div className={`flex items-center gap-1 ${securityFixStatus === "verifying" ? "text-primary font-medium" : ""}`}>
                      <span className={`w-2 h-2 rounded-full ${securityFixStatus === "verifying" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
                      Verify
                    </div>
                  </div>
                )}

                {!checkResult.compilation.success && (
                  <p className="text-xs text-muted-foreground">
                    Fix compilation errors first before fixing security issues
                  </p>
                )}

                {securityFixAttempts > 0 && !isFixingSecurity && (
                  <p className="text-xs text-muted-foreground">
                    Attempted {securityFixAttempts} {securityFixAttempts === 1 ? "fix" : "fixes"}
                  </p>
                )}
              </div>

              {securityFixError && (
                <Alert variant={securityFixStatus === "success" ? "default" : "destructive"}>
                  <AlertDescription>{securityFixError}</AlertDescription>
                </Alert>
              )}

              {hasWarnings && !hasErrors && checkResult.compilation.success && (
                <label className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    checked={acknowledgedWarnings}
                    onChange={(e) => setAcknowledgedWarnings(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">
                    I understand the risks and want to proceed anyway
                  </span>
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {checkResult.size.withinLimit ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-red-500">✗</span>
            )}
            Contract Size
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={
              checkResult.size.withinLimit ? "text-green-600" : "text-red-600"
            }
          >
            {checkResult.size.kb} (limit: 24 KB)
          </p>
          {!checkResult.size.withinLimit && (
            <p className="text-sm text-muted-foreground mt-2">
              Contract is too large. Consider splitting into multiple contracts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gas Estimate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-blue-500">ℹ</span>
            Deployment Cost Estimate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Gas</p>
              <p className="font-mono">{checkResult.gas.estimated}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost (ETH)</p>
              <p className="font-mono">{checkResult.gas.costEth}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost (USD)</p>
              <p className="font-mono">{checkResult.gas.costUsd}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Network Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Network</CardTitle>
          <CardDescription>
            Choose which network to deploy your contract to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedNetwork.toString()}
            onValueChange={(value) => setSelectedNetwork(Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-xs text-muted-foreground">
                Testnets
              </div>
              {NETWORKS.filter((n) => n.type === "testnet").map((network) => (
                <SelectItem key={network.id} value={network.id.toString()}>
                  {network.name}
                </SelectItem>
              ))}
              <div className="px-2 py-1 text-xs text-muted-foreground mt-2">
                Mainnets
              </div>
              {NETWORKS.filter((n) => n.type === "mainnet").map((network) => (
                <SelectItem key={network.id} value={network.id.toString()}>
                  {network.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedNetworkInfo?.type === "mainnet" && (
            <Alert className="mt-4">
              <AlertTitle>Warning: Mainnet Deployment</AlertTitle>
              <AlertDescription>
                You are about to deploy to a mainnet. This will cost real ETH.
                Make sure your contract is thoroughly tested.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">
                {canDeploy ? "Ready for testing!" : "Cannot proceed yet"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {canDeploy
                  ? "Run tests before deploying to " + selectedNetworkInfo?.name
                  : "Please fix the errors above before proceeding"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                ← Edit Code
              </Button>
              <Button onClick={() => setStep("testing")} disabled={!canDeploy}>
                Run Tests →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
