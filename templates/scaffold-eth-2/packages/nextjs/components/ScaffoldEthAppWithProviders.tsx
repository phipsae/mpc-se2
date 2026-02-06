"use client";

import { ReactNode, useEffect, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { WagmiProvider } from "wagmi";
import { createConfig, http } from "wagmi";
import { mainnet, sepolia, baseSepolia, optimismSepolia, arbitrumSepolia } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import scaffoldConfig from "~~/scaffold.config";

// Create wallet connectors
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet, rainbowWallet],
    },
  ],
  {
    appName: "Scaffold-ETH 2 App",
    projectId: scaffoldConfig.walletConnectProjectId,
  }
);

// Create wagmi config
const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, baseSepolia, optimismSepolia, arbitrumSepolia],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Inner component that uses useTheme (must be inside ThemeProvider)
const ScaffoldEthApp = ({ children }: { children: ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <RainbowKitProvider
      theme={mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()}
    >
      {children}
    </RainbowKitProvider>
  );
};

export const ScaffoldEthAppWithProviders = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ScaffoldEthApp>{children}</ScaffoldEthApp>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
};
