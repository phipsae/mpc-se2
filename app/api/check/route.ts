import { NextRequest, NextResponse } from "next/server";

interface SecurityWarning {
  severity: "warning" | "error";
  message: string;
  line?: number;
}

function analyzeSecurityPatterns(source: string): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];
  const lines = source.split("\n");

  // Check for reentrancy vulnerabilities
  if (
    (source.includes(".call{value:") || source.includes(".call{value :")) &&
    !source.includes("ReentrancyGuard") &&
    !source.includes("nonReentrant")
  ) {
    const lineNum = lines.findIndex(
      (l) => l.includes(".call{value:") || l.includes(".call{value :")
    );
    warnings.push({
      severity: "warning",
      message:
        "ETH transfer detected without ReentrancyGuard. Consider using OpenZeppelin's ReentrancyGuard.",
      line: lineNum > -1 ? lineNum + 1 : undefined,
    });
  }

  // Check for unchecked return values
  if (source.match(/\.call\([^)]*\)\s*;/) && !source.includes("require(success")) {
    warnings.push({
      severity: "warning",
      message:
        "Low-level call without checking return value. Consider using require(success, ...) or handle the boolean return.",
    });
  }

  // Check for transfer() or send() usage
  if (source.includes(".transfer(") || source.includes(".send(")) {
    const lineNum = lines.findIndex(
      (l) => l.includes(".transfer(") || l.includes(".send(")
    );
    warnings.push({
      severity: "warning",
      message:
        "Using transfer() or send() can fail with contracts that have complex fallback functions. Consider using call() instead.",
      line: lineNum > -1 ? lineNum + 1 : undefined,
    });
  }

  // Check for tx.origin usage
  if (source.includes("tx.origin")) {
    const lineNum = lines.findIndex((l) => l.includes("tx.origin"));
    warnings.push({
      severity: "warning",
      message:
        "tx.origin usage detected. This can be vulnerable to phishing attacks. Use msg.sender instead.",
      line: lineNum > -1 ? lineNum + 1 : undefined,
    });
  }

  // Check for unchecked math (Solidity <0.8.0 style)
  if (source.match(/pragma solidity\s*\^\s*0\.[0-7]/) && !source.includes("SafeMath")) {
    warnings.push({
      severity: "error",
      message:
        "Using Solidity version below 0.8.0 without SafeMath. This is vulnerable to integer overflow/underflow.",
    });
  }

  // Check for dangerous selfdestruct
  if (source.includes("selfdestruct")) {
    const lineNum = lines.findIndex((l) => l.includes("selfdestruct"));
    warnings.push({
      severity: "warning",
      message:
        "selfdestruct detected. This can be dangerous and is deprecated in newer Solidity versions.",
      line: lineNum > -1 ? lineNum + 1 : undefined,
    });
  }

  // Check for missing access control on critical functions
  if (source.includes("function withdraw") && !source.includes("onlyOwner") && !source.includes("Ownable")) {
    const lineNum = lines.findIndex((l) => l.includes("function withdraw"));
    warnings.push({
      severity: "warning",
      message:
        "Withdraw function detected without onlyOwner modifier. Consider adding access control.",
      line: lineNum > -1 ? lineNum + 1 : undefined,
    });
  }

  return warnings;
}

function estimateGas(bytecode: string): { estimated: string; costEth: string; costUsd: string } {
  // Rough estimation based on bytecode size
  // Actual gas depends on constructor logic, which we can't know without simulation
  const bytecodeSize = bytecode.length / 2; // hex to bytes
  const baseGas = 21000; // Base transaction cost
  const perByteGas = 200; // Approximate cost per byte
  const estimatedGas = baseGas + bytecodeSize * perByteGas + 100000; // Add buffer for constructor

  // Assume 30 gwei gas price (this should be fetched from network in production)
  const gasPriceGwei = 30;
  const costWei = BigInt(estimatedGas) * BigInt(gasPriceGwei) * BigInt(1e9);
  const costEth = Number(costWei) / 1e18;

  // Assume ETH price of $2000 (this should be fetched from an oracle in production)
  const ethPrice = 2000;
  const costUsd = costEth * ethPrice;

  return {
    estimated: estimatedGas.toLocaleString(),
    costEth: `~${costEth.toFixed(4)} ETH`,
    costUsd: `~$${costUsd.toFixed(2)}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts, compilationResult } = body;

    if (!contracts || !contracts.length) {
      return NextResponse.json(
        { error: "No contracts provided" },
        { status: 400 }
      );
    }

    // Analyze security patterns
    const allWarnings: SecurityWarning[] = [];
    for (const contract of contracts) {
      const warnings = analyzeSecurityPatterns(contract.content);
      allWarnings.push(...warnings);
    }

    // Calculate bytecode size
    const bytecode = compilationResult?.bytecode || "";
    const sizeBytes = bytecode ? bytecode.length / 2 : 0;
    const sizeKB = sizeBytes / 1024;

    // Estimate gas
    const gasEstimate = bytecode
      ? estimateGas(bytecode)
      : { estimated: "N/A", costEth: "N/A", costUsd: "N/A" };

    const result = {
      compilation: {
        success: compilationResult?.success ?? true,
        errors: compilationResult?.errors || [],
        warnings: compilationResult?.warnings || [],
      },
      security: {
        warnings: allWarnings,
      },
      gas: gasEstimate,
      size: {
        bytes: sizeBytes,
        kb: `${sizeKB.toFixed(2)} KB`,
        withinLimit: sizeKB < 24, // 24KB EVM limit
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check failed" },
      { status: 500 }
    );
  }
}
