// ============================================================================
// Security pattern analysis - extracted from app/api/check/route.ts
// ============================================================================
export function analyzeSecurityPatterns(contracts) {
    const warnings = [];
    for (const contract of contracts) {
        const source = contract.content;
        const lines = source.split("\n");
        // Reentrancy vulnerability
        if ((source.includes(".call{value:") || source.includes(".call{value :")) &&
            !source.includes("ReentrancyGuard") &&
            !source.includes("nonReentrant")) {
            const lineNum = lines.findIndex((l) => l.includes(".call{value:") || l.includes(".call{value :"));
            warnings.push({
                severity: "warning",
                message: "ETH transfer detected without ReentrancyGuard. Consider using OpenZeppelin's ReentrancyGuard.",
                contract: contract.name,
                line: lineNum > -1 ? lineNum + 1 : undefined,
            });
        }
        // Unchecked return values
        if (source.match(/\.call\([^)]*\)\s*;/) && !source.includes("require(success")) {
            warnings.push({
                severity: "warning",
                message: "Low-level call without checking return value. Consider using require(success, ...) or handle the boolean return.",
                contract: contract.name,
            });
        }
        // transfer() or send() usage
        if (source.includes(".transfer(") || source.includes(".send(")) {
            const lineNum = lines.findIndex((l) => l.includes(".transfer(") || l.includes(".send("));
            warnings.push({
                severity: "warning",
                message: "Using transfer() or send() can fail with contracts that have complex fallback functions. Consider using call() instead.",
                contract: contract.name,
                line: lineNum > -1 ? lineNum + 1 : undefined,
            });
        }
        // tx.origin usage
        if (source.includes("tx.origin")) {
            const lineNum = lines.findIndex((l) => l.includes("tx.origin"));
            warnings.push({
                severity: "warning",
                message: "tx.origin usage detected. This can be vulnerable to phishing attacks. Use msg.sender instead.",
                contract: contract.name,
                line: lineNum > -1 ? lineNum + 1 : undefined,
            });
        }
        // Old Solidity version
        if (source.match(/pragma solidity\s*\^\s*0\.[0-7]/) &&
            !source.includes("SafeMath")) {
            warnings.push({
                severity: "error",
                message: "Using Solidity version below 0.8.0 without SafeMath. This is vulnerable to integer overflow/underflow.",
                contract: contract.name,
            });
        }
        // selfdestruct
        if (source.includes("selfdestruct")) {
            const lineNum = lines.findIndex((l) => l.includes("selfdestruct"));
            warnings.push({
                severity: "warning",
                message: "selfdestruct detected. This can be dangerous and is deprecated in newer Solidity versions.",
                contract: contract.name,
                line: lineNum > -1 ? lineNum + 1 : undefined,
            });
        }
        // Missing access control on withdraw
        if (source.includes("function withdraw") &&
            !source.includes("onlyOwner") &&
            !source.includes("Ownable")) {
            const lineNum = lines.findIndex((l) => l.includes("function withdraw"));
            warnings.push({
                severity: "warning",
                message: "Withdraw function detected without onlyOwner modifier. Consider adding access control.",
                contract: contract.name,
                line: lineNum > -1 ? lineNum + 1 : undefined,
            });
        }
    }
    return warnings;
}
export function estimateGas(bytecode) {
    const bytecodeSize = bytecode.length / 2;
    const baseGas = 21000;
    const perByteGas = 200;
    const estimatedGas = baseGas + bytecodeSize * perByteGas + 100000;
    const gasPriceGwei = 30;
    const costWei = BigInt(estimatedGas) * BigInt(gasPriceGwei) * BigInt(1e9);
    const costEth = Number(costWei) / 1e18;
    const ethPrice = 2000;
    const costUsd = costEth * ethPrice;
    return {
        estimated: estimatedGas.toLocaleString(),
        costEth: `~${costEth.toFixed(4)} ETH`,
        costUsd: `~$${costUsd.toFixed(2)}`,
    };
}
export function checkSize(bytecode) {
    const sizeBytes = bytecode ? bytecode.length / 2 : 0;
    const sizeKB = sizeBytes / 1024;
    return {
        bytes: sizeBytes,
        kb: `${sizeKB.toFixed(2)} KB`,
        withinLimit: sizeKB < 24,
    };
}
//# sourceMappingURL=analyzer.js.map