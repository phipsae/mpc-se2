// ============================================================================
// Local deployment to Anvil via forge script
// ============================================================================
import { spawn } from "node:child_process";
function runCommand(cmd, args, cwd, env, timeoutMs = 60000) {
    return new Promise((resolve) => {
        let output = "";
        const proc = spawn(cmd, args, {
            cwd,
            env: { ...process.env, ...env },
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
            resolve({ output: output + "\n\nDeployment timed out", exitCode: 1 });
        }, timeoutMs);
    });
}
export async function deployToAnvil(projectPath, rpcUrl, privateKey) {
    const foundryPath = `${projectPath}/packages/foundry`;
    const result = await runCommand("forge", [
        "script",
        "script/Deploy.s.sol",
        "--rpc-url",
        rpcUrl,
        "--broadcast",
        "-vvv",
    ], foundryPath, { DEPLOYER_PRIVATE_KEY: privateKey.replace(/^0x/, "") });
    if (result.exitCode !== 0) {
        return {
            success: false,
            output: result.output,
            error: "Deployment script failed",
        };
    }
    // Parse deployed contract address from output
    const addressMatch = result.output.match(/deployed at:\s*(0x[a-fA-F0-9]{40})/i);
    const contractAddress = addressMatch?.[1];
    // Also try to find address from broadcast logs
    if (!contractAddress) {
        const broadcastMatch = result.output.match(/Contract Address:\s*(0x[a-fA-F0-9]{40})/i);
        if (broadcastMatch) {
            return {
                success: true,
                contractAddress: broadcastMatch[1],
                output: result.output,
            };
        }
    }
    return {
        success: true,
        contractAddress,
        output: result.output,
    };
}
//# sourceMappingURL=local-deployer.js.map