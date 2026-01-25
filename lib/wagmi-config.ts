import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  mainnet,
  sepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
} from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "AI dApp Builder",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [
    sepolia,
    baseSepolia,
    optimismSepolia,
    arbitrumSepolia,
    mainnet,
    base,
    optimism,
    arbitrum,
  ],
  ssr: true,
});
