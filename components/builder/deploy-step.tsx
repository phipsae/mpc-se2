"use client";

import { useEffect, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ConnectButton } from "@rainbow-me/rainbowkit";

type DeploymentPhase = "contract" | "github" | "vercel" | "done";

const PHASE_STEPS = [
  { id: "contract", label: "Deploying Contract", description: "Deploying smart contract to blockchain" },
  { id: "github", label: "Pushing to GitHub", description: "Creating repository and pushing code" },
  { id: "vercel", label: "Deploying to Vercel", description: "Building and deploying frontend" },
  { id: "done", label: "Complete", description: "Your dApp is live!" },
];

export function DeployStep() {
  const { isConnected, address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const {
    step,
    generatedCode,
    checkResult,
    selectedNetwork,
    setStep,
    setDeployment,
    setGithubRepo,
    setVercelDeployment,
    setIsLoading,
    setLoadingMessage,
  } = useBuilderStore();

  const [currentPhase, setCurrentPhase] = useState<DeploymentPhase>("contract");
  const [phaseStatus, setPhaseStatus] = useState<Record<string, "pending" | "loading" | "success" | "error">>({
    contract: "pending",
    github: "pending",
    vercel: "pending",
  });
  const [error, setError] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [contractAbi, setContractAbi] = useState<unknown[] | null>(null);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);
  const [githubRepoName, setGithubRepoName] = useState<string | null>(null);

  const progress = 
    currentPhase === "contract" ? 25 :
    currentPhase === "github" ? 50 :
    currentPhase === "vercel" ? 75 :
    100;

  const deployContract = async () => {
    if (!walletClient || !publicClient || !generatedCode) {
      setError("Wallet not connected or no code to deploy");
      return;
    }

    setPhaseStatus((prev) => ({ ...prev, contract: "loading" }));
    setLoadingMessage("Waiting for transaction signature...");

    try {
      // Get compiled bytecode from the check result or compile again
      const compileResponse = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contracts: generatedCode.contracts }),
      });

      const { bytecode, abi, success, errors } = await compileResponse.json();

      if (!success || !bytecode) {
        throw new Error(errors?.[0] || "Compilation failed");
      }

      // Store ABI for later use
      setContractAbi(abi);

      // Deploy the contract
      const hash = await walletClient.deployContract({
        abi,
        bytecode: `0x${bytecode}`,
        args: [], // TODO: Handle constructor args
      });

      setLoadingMessage("Waiting for transaction confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.contractAddress) {
        setContractAddress(receipt.contractAddress);
        setDeployment({
          contractAddress: receipt.contractAddress,
          transactionHash: hash,
          networkId: selectedNetwork,
          networkName: chain?.name || "Unknown",
          explorerUrl: `${chain?.blockExplorers?.default.url}/address/${receipt.contractAddress}`,
        });
        setPhaseStatus((prev) => ({ ...prev, contract: "success" }));
        setCurrentPhase("github");
      }
    } catch (err) {
      console.error("Deploy error:", err);
      setPhaseStatus((prev) => ({ ...prev, contract: "error" }));
      setError(err instanceof Error ? err.message : "Failed to deploy contract");
    } finally {
      setLoadingMessage("");
    }
  };

  const pushToGitHub = async () => {
    setPhaseStatus((prev) => ({ ...prev, github: "loading" }));
    setLoadingMessage("Creating GitHub repository...");

    try {
      const contractName = generatedCode?.contracts[0]?.name.replace(".sol", "") || "Contract";
      
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedCode,
          contractAddress,
          networkId: selectedNetwork,
          contractName,
          abi: contractAbi,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGithubRepo({ url: data.repoUrl, name: data.repoName });
        setGithubRepoUrl(data.repoUrl);
        setGithubRepoName(data.repoName);
        setPhaseStatus((prev) => ({ ...prev, github: "success" }));
        setCurrentPhase("vercel");
      } else {
        throw new Error(data.error || "Failed to create GitHub repository");
      }
    } catch (err) {
      console.error("GitHub error:", err);
      setPhaseStatus((prev) => ({ ...prev, github: "error" }));
      setError(err instanceof Error ? err.message : "Failed to push to GitHub");
    } finally {
      setLoadingMessage("");
    }
  };

  const deployToVercel = async () => {
    if (!githubRepoUrl || !githubRepoName) {
      setPhaseStatus((prev) => ({ ...prev, vercel: "error" }));
      setError("GitHub repository not found. Cannot deploy to Vercel.");
      return;
    }

    // Get Vercel token from localStorage
    const vercelToken = localStorage.getItem("vercel_token");
    if (!vercelToken) {
      setPhaseStatus((prev) => ({ ...prev, vercel: "error" }));
      setError("Vercel token not found. Please add your Vercel token in the connection settings.");
      return;
    }

    setPhaseStatus((prev) => ({ ...prev, vercel: "loading" }));
    setLoadingMessage("Deploying to Vercel...");

    try {
      const response = await fetch("/api/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoUrl,
          repoName: githubRepoName,
          vercelToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setVercelDeployment({ url: data.deploymentUrl, projectId: data.projectId });
        setPhaseStatus((prev) => ({ ...prev, vercel: "success" }));
        setCurrentPhase("done");
        setStep("results");
      } else {
        throw new Error(data.error || "Failed to deploy to Vercel");
      }
    } catch (err) {
      console.error("Vercel error:", err);
      setPhaseStatus((prev) => ({ ...prev, vercel: "error" }));
      setError(err instanceof Error ? err.message : "Failed to deploy to Vercel");
    } finally {
      setLoadingMessage("");
    }
  };

  // Auto-advance through phases
  useEffect(() => {
    if (currentPhase === "github" && phaseStatus.contract === "success" && phaseStatus.github === "pending") {
      pushToGitHub();
    } else if (currentPhase === "vercel" && phaseStatus.github === "success" && phaseStatus.vercel === "pending") {
      deployToVercel();
    }
  }, [currentPhase, phaseStatus]);

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-muted-foreground">
            You need to connect your wallet to deploy the contract
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <ConnectButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Deploying Your dApp</h1>
        <p className="text-muted-foreground">
          This may take a few minutes
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <Progress value={progress} className="h-3 mb-4" />
          <div className="grid grid-cols-4 gap-2">
            {PHASE_STEPS.map((phase) => (
              <div
                key={phase.id}
                className={`text-center text-sm ${
                  currentPhase === phase.id
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {phase.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phase Status */}
      <div className="space-y-4">
        {PHASE_STEPS.slice(0, -1).map((phase) => (
          <Card
            key={phase.id}
            className={
              phaseStatus[phase.id] === "loading"
                ? "border-primary"
                : phaseStatus[phase.id] === "success"
                ? "border-green-500"
                : phaseStatus[phase.id] === "error"
                ? "border-red-500"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {phaseStatus[phase.id] === "success" && (
                    <span className="text-green-500">✓</span>
                  )}
                  {phaseStatus[phase.id] === "loading" && (
                    <span className="animate-spin">⏳</span>
                  )}
                  {phaseStatus[phase.id] === "error" && (
                    <span className="text-red-500">✗</span>
                  )}
                  {phaseStatus[phase.id] === "pending" && (
                    <span className="text-muted-foreground">○</span>
                  )}
                  {phase.label}
                </span>
                <Badge
                  variant={
                    phaseStatus[phase.id] === "success"
                      ? "default"
                      : phaseStatus[phase.id] === "error"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {phaseStatus[phase.id]}
                </Badge>
              </CardTitle>
              <CardDescription>{phase.description}</CardDescription>
            </CardHeader>
            {phase.id === "contract" && contractAddress && (
              <CardContent>
                <p className="font-mono text-sm break-all">{contractAddress}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setError(null);
                // Retry current phase
                if (currentPhase === "contract") deployContract();
                else if (currentPhase === "github") pushToGitHub();
                else if (currentPhase === "vercel") deployToVercel();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Start Deploy Button */}
      {currentPhase === "contract" && phaseStatus.contract === "pending" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Ready to deploy</h4>
                <p className="text-sm text-muted-foreground">
                  Click the button to start the deployment process
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("checks")}>
                  ← Back
                </Button>
                <Button onClick={deployContract}>
                  Deploy Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
