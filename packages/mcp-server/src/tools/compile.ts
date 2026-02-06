import {
  compileContracts,
  analyzeSecurityPatterns,
  estimateGas,
  checkSize,
} from "@mpc-se2/core";

export const compileContractsTool = {
  name: "compile_contracts",
  description:
    "Compile Solidity contracts using solc. Automatically resolves OpenZeppelin v5 imports. Returns ABI, bytecode, errors, and warnings.",
  inputSchema: {
    type: "object" as const,
    properties: {
      contracts: {
        type: "array",
        description: "Contracts to compile",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filename (e.g. MyToken.sol)" },
            content: { type: "string", description: "Full Solidity source code" },
          },
          required: ["name", "content"],
        },
      },
    },
    required: ["contracts"],
  },
  handler: async (args: {
    contracts: { name: string; content: string }[];
  }) => {
    return await compileContracts(args.contracts);
  },
};

export const checkSecurityTool = {
  name: "check_security",
  description:
    "Run security pattern analysis and gas estimation on Solidity contracts. Checks for reentrancy, unchecked calls, tx.origin, etc.",
  inputSchema: {
    type: "object" as const,
    properties: {
      contracts: {
        type: "array",
        description: "Contracts to analyze",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            content: { type: "string" },
          },
          required: ["name", "content"],
        },
      },
      bytecode: {
        type: "string",
        description: "Compiled bytecode for gas estimation (optional)",
      },
    },
    required: ["contracts"],
  },
  handler: async (args: {
    contracts: { name: string; content: string }[];
    bytecode?: string;
  }) => {
    const warnings = analyzeSecurityPatterns(args.contracts);
    const gas = args.bytecode
      ? estimateGas(args.bytecode)
      : { estimated: "N/A", costEth: "N/A", costUsd: "N/A" };
    const size = args.bytecode
      ? checkSize(args.bytecode)
      : { bytes: 0, kb: "0 KB", withinLimit: true };

    return { security: { warnings }, gas, size };
  },
};
