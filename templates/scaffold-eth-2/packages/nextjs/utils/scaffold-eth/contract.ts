import { Abi, Address } from "viem";

export type GenericContractsDeclaration = {
  [chainId: number]: {
    [contractName: string]: {
      address: Address;
      abi: Abi;
    };
  };
};

export type InheritedFunctions = { readonly [key: string]: string };
