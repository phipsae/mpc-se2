"use client";

import { Address } from "viem";
import { useBalance } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

type BalanceProps = {
  address?: Address;
  className?: string;
};

export const Balance = ({ address, className = "" }: BalanceProps) => {
  const { targetNetwork } = useTargetNetwork();
  
  const { data: balance, isLoading } = useBalance({
    address,
    chainId: targetNetwork.id,
  });

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-300 h-6 w-20 rounded ${className}`} />
    );
  }

  if (!balance) {
    return <span className={className}>0 ETH</span>;
  }

  const formattedBalance = parseFloat(balance.formatted).toFixed(4);

  return (
    <span className={className}>
      {formattedBalance} {balance.symbol}
    </span>
  );
};
