"use client";

import { useState } from "react";
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
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  const handleFixErrors = async () => {
    if (!generatedCode || !checkResult?.compilation.errors.length) return;

    setIsFixing(true);
    setFixError(null);

    try {
      // Call the fix API
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

      // Re-run checks with the fixed code
      const newCheckResult = await runChecks(fixData.contracts);
      setCheckResult(newCheckResult);
    } catch (error) {
      setFixError(error instanceof Error ? error.message : "Failed to fix errors");
    } finally {
      setIsFixing(false);
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
            <p className="text-green-600">Successfully compiled</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {checkResult.compilation.errors.map((error, i) => (
                  <Alert key={i} variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handleFixErrors}
                  disabled={isFixing}
                >
                  {isFixing ? "Fixing..." : "Fix with AI"}
                </Button>
                {isFixing && (
                  <span className="text-sm text-muted-foreground">
                    AI is analyzing and fixing the errors...
                  </span>
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkResult.security.warnings.length === 0 ? (
            <p className="text-green-600">No security issues detected</p>
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
              {hasWarnings && !hasErrors && (
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
                {canDeploy ? "Ready to deploy!" : "Cannot deploy yet"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {canDeploy
                  ? "Your contract will be deployed to " + selectedNetworkInfo?.name
                  : "Please fix the errors above before deploying"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                ← Edit Code
              </Button>
              <Button onClick={() => setStep("deploy")} disabled={!canDeploy}>
                Deploy Contract →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
