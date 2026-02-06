// ============================================================================
// Anvil process manager for local testing
// ============================================================================

import { spawn, type ChildProcess } from "node:child_process";

export interface AnvilInstance {
  rpcUrl: string;
  port: number;
  process: ChildProcess;
  accounts: { address: string; privateKey: string }[];
}

// Default Anvil funded accounts (first 10 from default mnemonic)
const DEFAULT_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
  { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" },
];

function randomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

export class AnvilManager {
  private instances = new Map<string, AnvilInstance>();

  async start(
    projectId: string,
    opts?: { port?: number; forkUrl?: string }
  ): Promise<{ rpcUrl: string; port: number; accounts: { address: string; privateKey: string }[] }> {
    // Stop existing instance for this project
    if (this.instances.has(projectId)) {
      await this.stop(projectId);
    }

    const requestedPort = opts?.port ?? randomPort();
    const args = ["--port", String(requestedPort), "--host", "127.0.0.1"];

    if (opts?.forkUrl) {
      args.push("--fork-url", opts.forkUrl);
    }

    const proc = spawn("anvil", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Wait for anvil to be ready and parse actual port
    const actualPort = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Anvil failed to start within 10s"));
      }, 10000);

      let output = "";
      const onData = (data: Buffer) => {
        output += data.toString();
        const match = output.match(/Listening on 127\.0\.0\.1:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          proc.stdout?.removeListener("data", onData);
          proc.stderr?.removeListener("data", onData);
          resolve(parseInt(match[1], 10));
        }
      };

      proc.stdout?.on("data", onData);
      proc.stderr?.on("data", onData);

      proc.on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start anvil: ${err.message}`));
      });

      proc.on("exit", (code: number | null) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Anvil exited with code ${code}. Output: ${output}`));
        }
      });
    });

    const instance: AnvilInstance = {
      rpcUrl: `http://127.0.0.1:${actualPort}`,
      port: actualPort,
      process: proc,
      accounts: DEFAULT_ACCOUNTS,
    };

    this.instances.set(projectId, instance);

    return {
      rpcUrl: instance.rpcUrl,
      port: instance.port,
      accounts: instance.accounts,
    };
  }

  async stop(projectId: string): Promise<void> {
    const instance = this.instances.get(projectId);
    if (!instance) return;

    instance.process.kill("SIGTERM");

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        instance.process.kill("SIGKILL");
        resolve();
      }, 5000);

      instance.process.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.instances.delete(projectId);
  }

  async stopAll(): Promise<void> {
    const projectIds = [...this.instances.keys()];
    await Promise.all(projectIds.map((id) => this.stop(id)));
  }

  getInstance(projectId: string): AnvilInstance | undefined {
    return this.instances.get(projectId);
  }
}
