"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "@/lib/store";
import { useAuthConnections } from "@/lib/auth/use-auth-connections";

export default function Home() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [prompt, setPrompt] = useState("");
  const [vercelTokenInput, setVercelTokenInput] = useState("");
  const { setPrompt: setStorePrompt, setStep } = useBuilderStore();

  // Auth connections
  const {
    isGitHubConnected,
    githubUser,
    connectGitHub,
    isVercelConfigured,
    saveVercelToken,
    clearVercelToken,
    isLoading: isAuthLoading,
  } = useAuthConnections();

  const handleSaveVercelToken = () => {
    if (vercelTokenInput.trim()) {
      saveVercelToken(vercelTokenInput.trim());
      setVercelTokenInput("");
    }
  };

  const handleStartBuilding = () => {
    if (!prompt.trim()) return;
    setStorePrompt(prompt);
    setStep("prompt");
    router.push("/builder");
  };

  const allConnected = isConnected && isGitHubConnected && isVercelConfigured;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏗️</span>
            <span className="font-bold text-xl">AI dApp Builder</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            Build dApps with Natural Language
          </h1>
          <p className="text-muted-foreground text-lg">
            Describe your dApp, we&apos;ll generate the smart contracts, deploy them,
            and create a frontend. All in minutes.
          </p>
        </div>

        {/* Connection Status */}
        <Card className="w-full mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Connection Status</CardTitle>
            <CardDescription>
              Connect all services to start building
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🔗</span>
                <span>Wallet</span>
              </div>
              {isConnected ? (
                <Badge variant="default" className="bg-green-600">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not Connected</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🐙</span>
                <span>GitHub</span>
              </div>
              {isGitHubConnected ? (
                <Badge variant="default" className="bg-green-600">
                  {githubUser || "Connected"}
                </Badge>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={connectGitHub}
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? "Loading..." : "Connect GitHub"}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>▲</span>
                  <span>Vercel</span>
                </div>
                {isAuthLoading ? (
                  <Badge variant="secondary">Checking...</Badge>
                ) : isVercelConfigured ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">Configured</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearVercelToken}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary">Not configured</Badge>
                )}
              </div>
              {!isVercelConfigured && !isAuthLoading && (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Paste your Vercel token..."
                    value={vercelTokenInput}
                    onChange={(e) => setVercelTokenInput(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button 
                    size="sm" 
                    className="h-8"
                    onClick={handleSaveVercelToken}
                    disabled={!vercelTokenInput.trim()}
                  >
                    Save
                  </Button>
                </div>
              )}
              {!isVercelConfigured && !isAuthLoading && (
                <p className="text-xs text-muted-foreground">
                  Get your token at{" "}
                  <a 
                    href="https://vercel.com/account/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    vercel.com/account/tokens
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Prompt Input */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">Describe Your dApp</CardTitle>
            <CardDescription>
              Be as specific as possible. Include details about functionality,
              token economics, access control, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example: Create an NFT collection called 'Cool Cats' with a max supply of 10,000, mint price of 0.05 ETH, and only the owner can withdraw funds..."
              className="min-h-[150px] resize-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <Button
              className="w-full"
              size="lg"
              onClick={handleStartBuilding}
              disabled={!prompt.trim()}
            >
              {allConnected ? "Generate dApp →" : "Start Building →"}
            </Button>
            {!allConnected && (
              <p className="text-sm text-muted-foreground text-center">
                You can start building now and connect services later
              </p>
            )}
          </CardContent>
        </Card>

        {/* Example Prompts */}
        <div className="mt-8 w-full">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Example prompts:
          </h3>
          <div className="grid gap-2">
            {[
              "Create an ERC-20 token called 'MyToken' with 1 million supply and a transfer fee of 1%",
              "Build an NFT marketplace where users can list, buy, and sell NFTs with royalty support",
              "Create a staking contract where users can stake ETH and earn rewards over time",
            ].map((example, i) => (
              <button
                key={i}
                className="text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setPrompt(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Built with Scaffold-ETH 2 • Powered by Claude AI
        </div>
      </footer>
    </main>
  );
}
