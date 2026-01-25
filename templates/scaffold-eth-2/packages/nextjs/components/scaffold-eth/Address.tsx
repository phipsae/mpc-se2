"use client";

import { useState } from "react";
import { blo } from "blo";
import { Address as AddressType, getAddress, isAddress } from "viem";
import { useEnsAvatar, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";

type AddressProps = {
  address?: AddressType;
  disableAddressLink?: boolean;
  format?: "short" | "long";
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
};

export const Address = ({ address, disableAddressLink, format, size = "base" }: AddressProps) => {
  const [ensAvatar, setEnsAvatar] = useState<string | null>(null);
  
  const { data: fetchedEns } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { enabled: isAddress(address ?? "") },
  });
  
  const { data: fetchedEnsAvatar } = useEnsAvatar({
    name: fetchedEns ?? undefined,
    chainId: mainnet.id,
    query: { enabled: Boolean(fetchedEns) },
  });

  const checkSumAddress = address ? getAddress(address) : undefined;
  const blockExplorerAddressLink = `https://etherscan.io/address/${address}`;

  const displayAddress = format === "long" 
    ? checkSumAddress 
    : checkSumAddress?.slice(0, 6) + "..." + checkSumAddress?.slice(-4);

  if (!checkSumAddress) {
    return (
      <span className="text-gray-500">-</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0">
        <img
          src={fetchedEnsAvatar || blo(checkSumAddress)}
          alt={checkSumAddress}
          className="rounded-full"
          style={{ width: 24, height: 24 }}
        />
      </div>
      {disableAddressLink ? (
        <span className={`text-${size}`}>{fetchedEns || displayAddress}</span>
      ) : (
        <a
          href={blockExplorerAddressLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-${size} hover:underline`}
        >
          {fetchedEns || displayAddress}
        </a>
      )}
    </div>
  );
};
