"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function ResultsStep() {
  const router = useRouter();
  const { deployment, githubRepo, vercelDeployment, reset, saveCurrentProject } = useBuilderStore();
  const hasSaved = useRef(false);

  // Auto-save the project when reaching results
  useEffect(() => {
    if (!hasSaved.current) {
      saveCurrentProject();
      hasSaved.current = true;
    }
  }, [saveCurrentProject]);

  const handleStartOver = () => {
    reset();
    router.push("/");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold mb-2">Your dApp is Live!</h1>
        <p className="text-muted-foreground">
          Here&apos;s everything you need to get started
        </p>
      </div>

      {/* Contract Address */}
      {deployment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📄</span>
              Smart Contract
            </CardTitle>
            <CardDescription>
              Deployed to {deployment.networkName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Contract Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm break-all">
                  {deployment.contractAddress}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(deployment.contractAddress)}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Transaction Hash</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm break-all">
                  {deployment.transactionHash}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(deployment.transactionHash)}
                >
                  Copy
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(deployment.explorerUrl, "_blank")}
            >
              View on Block Explorer →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* GitHub Repository */}
      {githubRepo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🐙</span>
              GitHub Repository
            </CardTitle>
            <CardDescription>
              Your complete Scaffold-ETH 2 project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Repository URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm">
                  {githubRepo.url}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(githubRepo.url)}
                >
                  Copy
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(githubRepo.url, "_blank")}
            >
              Open Repository →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Vercel Deployment */}
      {vercelDeployment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>▲</span>
              Live Website
            </CardTitle>
            <CardDescription>
              Your dApp frontend is live on Vercel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Deployment URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm">
                  {vercelDeployment.url}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(vercelDeployment.url)}
                >
                  Copy
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => window.open(vercelDeployment.url, "_blank")}
            >
              Visit Your dApp →
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* What's Next */}
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s Next?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              <span>
                Clone your GitHub repository and run <code className="bg-muted px-1 rounded">yarn install</code> to set up locally
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              <span>
                Customize the frontend by editing files in <code className="bg-muted px-1 rounded">packages/nextjs/app</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              <span>
                Verify your contract on the block explorer for transparency
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">4.</span>
              <span>
                Consider getting a professional audit before using in production
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={handleStartOver}>
          Create Another dApp
        </Button>
      </div>
    </div>
  );
}
