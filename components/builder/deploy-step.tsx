"use client";

import { useEffect, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { AlertCircle } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    isEditMode,
    setIsEditMode,
    deployment: previousDeployment,
    githubRepo: previousGithubRepo,
    plan,
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

    // Verify we're on the expected network
    if (chain?.id !== selectedNetwork) {
      setError(
        `Network mismatch! Your wallet is connected to ${chain?.name || "unknown network"} ` +
        `but you selected to deploy on network ID ${selectedNetwork}. ` +
        `Please switch your wallet to the correct network.`
      );
      setPhaseStatus((prev) => ({ ...prev, contract: "error" }));
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

      // Extract constructor arguments from ABI and provide defaults
      const constructor = abi.find((item: { type: string }) => item.type === "constructor");
      const constructorArgs: unknown[] = [];
      
      if (constructor?.inputs?.length > 0) {
        console.log("Constructor requires arguments:", constructor.inputs);
        setLoadingMessage("Preparing constructor arguments...");
        
        for (const input of constructor.inputs) {
          const paramType = input.type;
          const paramName = input.name?.toLowerCase() || "";
          
          // Provide sensible defaults based on type and name
          if (paramType === "address") {
            // Use deployer's address for owner/admin type params, zero address otherwise
            if (paramName.includes("owner") || paramName.includes("admin") || paramName.includes("initial")) {
              constructorArgs.push(address);
            } else {
              constructorArgs.push(address); // Default to deployer for any address
            }
          } else if (paramType === "string") {
            // Common string params
            if (paramName.includes("name")) {
              constructorArgs.push(generatedCode?.contracts[0]?.name.replace(".sol", "") || "MyToken");
            } else if (paramName.includes("symbol")) {
              constructorArgs.push("TKN");
            } else if (paramName.includes("uri") || paramName.includes("url")) {
              constructorArgs.push("");
            } else {
              constructorArgs.push("");
            }
          } else if (paramType.startsWith("uint")) {
            // Numeric defaults
            if (paramName.includes("supply") || paramName.includes("total")) {
              constructorArgs.push(BigInt("1000000000000000000000000")); // 1 million with 18 decimals
            } else if (paramName.includes("price") || paramName.includes("cost") || paramName.includes("fee")) {
              constructorArgs.push(BigInt("10000000000000000")); // 0.01 ETH
            } else if (paramName.includes("max") || paramName.includes("limit") || paramName.includes("cap")) {
              constructorArgs.push(BigInt("10000"));
            } else {
              constructorArgs.push(BigInt(0));
            }
          } else if (paramType.startsWith("int")) {
            constructorArgs.push(BigInt(0));
          } else if (paramType === "bool") {
            constructorArgs.push(true);
          } else if (paramType === "bytes32") {
            constructorArgs.push("0x0000000000000000000000000000000000000000000000000000000000000000");
          } else if (paramType === "bytes") {
            constructorArgs.push("0x");
          } else if (paramType.endsWith("[]")) {
            constructorArgs.push([]);
          } else {
            // Unknown type - try zero/empty
            constructorArgs.push(paramType.includes("int") ? BigInt(0) : "0x");
          }
        }
        
        console.log("Constructor args:", constructorArgs);
      }

      setLoadingMessage("Waiting for transaction signature...");

      // Deploy the contract
      const hash = await walletClient.deployContract({
        abi,
        bytecode: `0x${bytecode}`,
        args: constructorArgs,
      });

      setLoadingMessage("Waiting for transaction confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Check if transaction was successful
      if (receipt.status === "reverted") {
        throw new Error(
          "Transaction reverted on-chain. This usually means:\n" +
          "• Constructor arguments were invalid\n" +
          "• A require() statement failed\n" +
          "• Not enough gas was provided"
        );
      }

      if (!receipt.contractAddress) {
        throw new Error("No contract address in receipt. Deployment may have failed.");
      }

      // Verify the contract exists on-chain with retries
      setLoadingMessage("Verifying contract on-chain...");
      
      let code: string | undefined;
      let verifyAttempts = 0;
      const maxAttempts = 5;
      
      while (verifyAttempts < maxAttempts) {
        verifyAttempts++;
        try {
          code = await publicClient.getCode({ address: receipt.contractAddress });
          if (code && code !== "0x" && code.length > 2) {
            break; // Contract verified!
          }
        } catch (codeError) {
          console.warn(`Verification attempt ${verifyAttempts} failed:`, codeError);
        }
        
        if (verifyAttempts < maxAttempts) {
          setLoadingMessage(`Verifying contract on-chain (attempt ${verifyAttempts + 1}/${maxAttempts})...`);
          await new Promise((r) => setTimeout(r, 2000)); // Wait 2 seconds before retry
        }
      }
      
      if (!code || code === "0x" || code.length <= 2) {
        throw new Error(
          `Contract verification failed. No bytecode found at ${receipt.contractAddress}.\n\n` +
          "The transaction was mined but no contract exists. Possible causes:\n" +
          "• The constructor reverted silently\n" +
          "• Wrong network selected\n" +
          "• RPC node sync issue\n\n" +
          `Check the transaction: ${chain?.blockExplorers?.default.url}/tx/${hash}`
        );
      }

      console.log(`Contract verified! Bytecode length: ${code.length} bytes`);
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
    } catch (err) {
      console.error("Deploy error:", err);
      setPhaseStatus((prev) => ({ ...prev, contract: "error" }));
      
      // Provide more helpful error messages
      let errorMessage = err instanceof Error ? err.message : "Failed to deploy contract";
      
      if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
        errorMessage = "Transaction was rejected. Please try again and confirm the transaction in your wallet.";
      } else if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas. Please add more ETH to your wallet.";
      } else if (errorMessage.includes("nonce")) {
        errorMessage = "Transaction nonce error. Try refreshing the page and deploying again.";
      }
      
      setError(errorMessage);
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
    setLoadingMessage("Creating Vercel project...");

    try {
      // Show progress messages
      const messages = [
        "Creating Vercel project...",
        "Connecting to GitHub repository...",
        "Triggering deployment...",
        "Building your dApp (this may take a few minutes)...",
      ];
      let messageIndex = 0;
      const messageInterval = setInterval(() => {
        messageIndex = Math.min(messageIndex + 1, messages.length - 1);
        setLoadingMessage(messages[messageIndex]);
      }, 8000);

      const response = await fetch("/api/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoUrl,
          repoName: githubRepoName,
          vercelToken,
        }),
      });

      clearInterval(messageInterval);
      const data = await response.json();

      if (data.success) {
        setVercelDeployment({ url: data.deploymentUrl, projectId: data.projectId });
        setPhaseStatus((prev) => ({ ...prev, vercel: "success" }));
        setCurrentPhase("done");
        // Clear edit mode when deployment is complete
        if (isEditMode) {
          setIsEditMode(false);
        }
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
      {/* Edit Mode Notice */}
      {isEditMode && (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Redeployment Mode</AlertTitle>
          <AlertDescription>
            You are deploying modified code. This will create a <strong>new contract</strong> with a new address. 
            {previousDeployment && (
              <span className="block mt-1 text-xs">
                Previous contract: {previousDeployment.contractAddress.slice(0, 10)}...{previousDeployment.contractAddress.slice(-8)}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          {isEditMode ? "Redeploying Your dApp" : "Deploying Your dApp"}
        </h1>
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
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm break-all">{contractAddress}</p>
                </div>
                {phaseStatus.contract === "success" && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <span>✓</span>
                    <span>Verified on-chain</span>
                  </div>
                )}
                {chain?.blockExplorers?.default.url && (
                  <a
                    href={`${chain.blockExplorers.default.url}/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View on {chain.blockExplorers.default.name || "Explorer"} →
                  </a>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6 space-y-4">
            <p className="text-red-500">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
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
              
              {/* Allow skipping GitHub/Vercel if contract is deployed */}
              {currentPhase === "github" && contractAddress && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setPhaseStatus((prev) => ({ ...prev, github: "error", vercel: "error" }));
                    setCurrentPhase("done");
                    if (isEditMode) setIsEditMode(false);
                    setStep("results");
                  }}
                >
                  Skip GitHub & Vercel
                </Button>
              )}
              
              {currentPhase === "vercel" && githubRepoUrl && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setPhaseStatus((prev) => ({ ...prev, vercel: "error" }));
                    setCurrentPhase("done");
                    if (isEditMode) setIsEditMode(false);
                    setStep("results");
                  }}
                >
                  Skip Vercel Deployment
                </Button>
              )}
            </div>
            
            {/* Helpful tips based on error */}
            {currentPhase === "github" && (
              <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                <p className="font-medium mb-2">Troubleshooting tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Make sure you&apos;re connected to GitHub with the correct account</li>
                  <li>Check if you have permission to create repositories</li>
                  <li>Try disconnecting and reconnecting your GitHub account</li>
                </ul>
              </div>
            )}
            
            {currentPhase === "vercel" && (
              <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                <p className="font-medium mb-2">Troubleshooting tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Make sure your Vercel token is valid and not expired</li>
                  <li>Ensure Vercel is connected to your GitHub account at{" "}
                    <a href="https://vercel.com/account/integrations" target="_blank" rel="noopener noreferrer" className="underline">
                      vercel.com/account/integrations
                    </a>
                  </li>
                  <li>Grant Vercel access to the repository in GitHub integration settings</li>
                  <li>Try generating a new token at vercel.com/account/tokens</li>
                </ul>
              </div>
            )}
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
