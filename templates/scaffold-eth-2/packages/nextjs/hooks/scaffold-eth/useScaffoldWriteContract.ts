import { useWriteContract } from "wagmi";
import { useTargetNetwork } from "./useTargetNetwork";
import deployedContracts from "~~/contracts/deployedContracts";

type ContractName = keyof (typeof deployedContracts)[number];

export const useScaffoldWriteContract = <TContractName extends ContractName>(
  contractName: TContractName
) => {
  const { targetNetwork } = useTargetNetwork();
  const deployedContract = deployedContracts[targetNetwork.id]?.[contractName];
  const { writeContractAsync, ...rest } = useWriteContract();

  const writeContractAsyncWithParams = async ({
    functionName,
    args,
    value,
  }: {
    functionName: string;
    args?: unknown[];
    value?: bigint;
  }) => {
    if (!deployedContract) {
      throw new Error(`Contract ${contractName} not found on network ${targetNetwork.id}`);
    }

    return writeContractAsync({
      address: deployedContract.address,
      abi: deployedContract.abi,
      functionName,
      args,
      value,
    });
  };

  return {
    writeContractAsync: writeContractAsyncWithParams,
    ...rest,
  };
};
