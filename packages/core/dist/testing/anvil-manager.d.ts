import { type ChildProcess } from "node:child_process";
export interface AnvilInstance {
    rpcUrl: string;
    port: number;
    process: ChildProcess;
    accounts: {
        address: string;
        privateKey: string;
    }[];
}
export declare class AnvilManager {
    private instances;
    start(projectId: string, opts?: {
        port?: number;
        forkUrl?: string;
    }): Promise<{
        rpcUrl: string;
        port: number;
        accounts: {
            address: string;
            privateKey: string;
        }[];
    }>;
    stop(projectId: string): Promise<void>;
    stopAll(): Promise<void>;
    getInstance(projectId: string): AnvilInstance | undefined;
}
//# sourceMappingURL=anvil-manager.d.ts.map