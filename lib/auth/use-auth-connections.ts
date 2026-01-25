"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useCallback, useMemo, useEffect, useState } from "react";

const VERCEL_TOKEN_KEY = "vercel_token";

export interface AuthConnections {
  // GitHub
  isGitHubConnected: boolean;
  githubUser: string | null;
  connectGitHub: () => void;
  disconnectGitHub: () => void;
  githubAccessToken: string | null;

  // Vercel (user-provided token stored in localStorage)
  isVercelConfigured: boolean;
  vercelToken: string | null;
  saveVercelToken: (token: string) => void;
  clearVercelToken: () => void;

  // General
  isLoading: boolean;
}

export function useAuthConnections(): AuthConnections {
  const { data: session, status } = useSession();
  const [vercelToken, setVercelToken] = useState<string | null>(null);
  const [vercelLoading, setVercelLoading] = useState(true);

  const isLoading = status === "loading" || vercelLoading;

  // Load Vercel token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(VERCEL_TOKEN_KEY);
    setVercelToken(stored);
    setVercelLoading(false);
  }, []);

  // GitHub
  const isGitHubConnected = !!session?.githubAccessToken;
  const githubUser = isGitHubConnected ? session?.user?.name || null : null;
  const githubAccessToken = session?.githubAccessToken || null;

  const connectGitHub = useCallback(() => {
    signIn("github", { callbackUrl: window.location.href });
  }, []);

  const disconnectGitHub = useCallback(() => {
    signOut({ callbackUrl: "/" });
  }, []);

  // Vercel token management
  const isVercelConfigured = !!vercelToken;

  const saveVercelToken = useCallback((token: string) => {
    localStorage.setItem(VERCEL_TOKEN_KEY, token);
    setVercelToken(token);
  }, []);

  const clearVercelToken = useCallback(() => {
    localStorage.removeItem(VERCEL_TOKEN_KEY);
    setVercelToken(null);
  }, []);

  return useMemo(
    () => ({
      isGitHubConnected,
      githubUser,
      connectGitHub,
      disconnectGitHub,
      githubAccessToken,
      isVercelConfigured,
      vercelToken,
      saveVercelToken,
      clearVercelToken,
      isLoading,
    }),
    [
      isGitHubConnected,
      githubUser,
      githubAccessToken,
      isVercelConfigured,
      vercelToken,
      saveVercelToken,
      clearVercelToken,
      isLoading,
    ]
  );
}
