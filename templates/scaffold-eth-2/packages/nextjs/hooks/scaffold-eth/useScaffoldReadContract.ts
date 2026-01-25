import { useReadContract } from "wagmi";
import { useTargetNetwork } from "./useTargetNetwork";
import deployedContracts from "~~/contracts/deployedContracts";

type ContractName = keyof (typeof deployedContracts)[number];

export const useScaffoldReadContract = <TContractName extends ContractName>({
  contractName,
  functionName,
  args,
  ...readContractParams
}: {
  contractName: TContractName;
  functionName: string;
  args?: unknown[];
  watch?: boolean;
}) => {
  const { targetNetwork } = useTargetNetwork();
  const deployedContract = deployedContracts[targetNetwork.id]?.[contractName];

  return useReadContract({
    address: deployedContract?.address,
    abi: deployedContract?.abi,
    functionName,
    args,
    chainId: targetNetwork.id,
    query: {
      enabled: !!deployedContract,
    },
    ...readContractParams,
  });
};
