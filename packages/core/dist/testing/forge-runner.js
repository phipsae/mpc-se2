// ============================================================================
// Foundry/Forge test runner - extracted from test-runner/server.js
// ============================================================================
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
function runCommand(cmd, args, cwd, timeoutMs = 120000) {
    return new Promise((resolve) => {
        let output = "";
        const proc = spawn(cmd, args, {
            cwd,
            env: { ...process.env },
        });
        proc.stdout?.on("data", (data) => {
            output += data.toString();
        });
        proc.stderr?.on("data", (data) => {
            output += data.toString();
        });
        proc.on("close", (code) => {
            resolve({ output, exitCode: code ?? 1 });
        });
        proc.on("error", (error) => {
            resolve({ output: `Process error: ${error.message}`, exitCode: 1 });
        });
        setTimeout(() => {
            proc.kill();
            resolve({
                output: output + "\n\nTest execution timed out",
                exitCode: 1,
            });
        }, timeoutMs);
    });
}
export function parseForgeOutput(output, success) {
    const tests = [];
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    const passRegex = /\[PASS\]\s+(\w+)\(\)/g;
    const failRegex = /\[FAIL[^\]]*\]\s+(\w+)\(\)(?::\s*(.+))?/g;
    let match;
    while ((match = passRegex.exec(output)) !== null) {
        tests.push({ name: match[1], status: "passed" });
        passed++;
        totalTests++;
    }
    while ((match = failRegex.exec(output)) !== null) {
        tests.push({
            name: match[1],
            status: "failed",
            error: match[2] || "Test failed",
        });
        failed++;
        totalTests++;
    }
    // Summary line
    const summaryMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
    if (summaryMatch) {
        passed = Math.max(passed, parseInt(summaryMatch[1], 10));
        failed = Math.max(failed, parseInt(summaryMatch[2], 10));
        totalTests = passed + failed;
    }
    return {
        success: success && failed === 0,
        totalTests,
        passed,
        failed,
        output,
        tests,
    };
}
function isHardhatTest(content) {
    return (content.includes("describe(") ||
        content.includes("it(") ||
        content.includes('require("chai")') ||
        content.includes('from "hardhat"') ||
        content.includes('from "chai"'));
}
export async function runForgeTests(contracts, tests) {
    const projectId = randomUUID();
    const projectDir = path.join(os.tmpdir(), "forge-tests", projectId);
    try {
        // Create Foundry project structure
        await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
        await fs.mkdir(path.join(projectDir, "test"), { recursive: true });
        // Write foundry.toml
        const foundryConfig = `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"

[rpc_endpoints]
mainnet = "https://eth.llamarpc.com"
`;
        await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);
        // Write contracts
        for (const contract of contracts) {
            await fs.writeFile(path.join(projectDir, "src", contract.name), contract.content);
        }
        // Write tests
        for (const test of tests) {
            if (isHardhatTest(test.content)) {
                return {
                    success: false,
                    totalTests: 0,
                    passed: 0,
                    failed: 0,
                    output: "Error: Test file is in Hardhat/JavaScript format. Please regenerate tests in Foundry format.",
                    tests: [],
                };
            }
            const testName = test.name.endsWith(".t.sol")
                ? test.name
                : test.name.replace(/\.(sol|ts)$/, "") + ".t.sol";
            await fs.writeFile(path.join(projectDir, "test", testName), test.content);
        }
        // Install Foundry libs
        const projectLibs = path.join(projectDir, "lib");
        await fs.mkdir(projectLibs, { recursive: true });
        await runCommand("git", ["init"], projectDir, 10000);
        await runCommand("forge", [
            "install",
            "foundry-rs/forge-std",
            "OpenZeppelin/openzeppelin-contracts",
            "--no-git",
        ], projectDir, 60000);
        // Create remappings
        const remappings = `forge-std/=lib/forge-std/src/
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
`;
        await fs.writeFile(path.join(projectDir, "remappings.txt"), remappings);
        // Run forge test
        const result = await runCommand("forge", ["test", "-vvv"], projectDir);
        return parseForgeOutput(result.output, result.exitCode === 0);
    }
    finally {
        try {
            await fs.rm(projectDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    }
}
//# sourceMappingURL=forge-runner.js.map